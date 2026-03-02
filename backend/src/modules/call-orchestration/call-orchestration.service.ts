import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '../../config/redis.config';
import {
  REDIS_KEYS,
  CALL_TIMEOUT_MS,
  AUDIT_EVENTS,
} from '../../common/constants/app.constants';
import { CallStatus, CallType } from '../../common/enums';
import { ChimeService } from '../chime/chime.service';
import { GetwellStayService } from '../getwell-stay/getwell-stay.service';
import { DeviceGateway } from '../websocket/device.gateway';
import { CallSession } from './interfaces/call-session.interface';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { PatientActionDto } from '../getwell-stay/dto/patient-action.dto';
import { RecordingMetadata } from './entities/recording-metadata.entity';

/**
 * Call Orchestration Service — the "brain" of the Digital Knock workflow.
 *
 * Implements the complete state machine:
 *   INITIATING → RINGING → ACCEPTED → CONNECTED → TERMINATED
 *                        → DECLINED
 *                        → IGNORED (timeout)
 *                        → FAILED (error at any point)
 *
 * All session state is stored in Redis for <2s latency requirement.
 */
@Injectable()
export class CallOrchestrationService {
  private readonly logger = new Logger(CallOrchestrationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(RecordingMetadata)
    private readonly recordingMetadataRepo: Repository<RecordingMetadata>,
    private readonly chimeService: ChimeService,
    private readonly getwellStayService: GetwellStayService,
    private readonly deviceGateway: DeviceGateway,
  ) {}

  /**
   * Step 1: Nurse initiates a call.
   * Creates Chime meeting, signals TV, starts timeout timer.
   *
   * Returns the meeting session info for the Nurse Console to join.
   */
  async initiateCall(dto: InitiateCallDto): Promise<{
    sessionId: string;
    meetingId: string;
    attendeeId: string;
    joinToken: string;
    mediaRegion: string;
    mediaPlacement: Record<string, string>;
  }> {
    const { locationId, callerId, callerName, callType, mediaRegion } = dto;

    // ── Pre-flight: Check device is online (skip in development for demo flow) ──
    const deviceOnline = await this.deviceGateway.isDeviceOnline(locationId);
    if (!deviceOnline) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn({
          message: 'Call rejected — camera device offline',
          locationId,
          callerId,
          event: AUDIT_EVENTS.CALL_FAILED,
        });
        throw new ServiceUnavailableException(
          `Camera device at location ${locationId} is offline`,
        );
      }
      this.logger.warn({
        message:
          'Development: no device registered for location — call allowed for demo',
        locationId,
      });
    }

    // ── Check for existing active call at this location ──
    const existingSession = await this.getActiveSessionByLocation(locationId);
    if (existingSession) {
      throw new BadRequestException(
        `Location ${locationId} already has an active call (session: ${existingSession.sessionId})`,
      );
    }

    const sessionId = randomUUID();

    this.logger.log({
      message: 'Initiating call',
      sessionId,
      locationId,
      callerId,
      callType,
      event: AUDIT_EVENTS.CALL_ATTEMPT,
    });

    try {
      // ── Step 1: Create Chime Meeting + Nurse Attendee ──
      const meetingSession = await this.chimeService.createMeetingSession(
        locationId,
        callerId,
        mediaRegion,
      );

      // ── Step 2: Start recording (Phase 1 requirement) — only when S3 bucket configured ──
      let pipelineId: string | undefined;
      if (this.chimeService.isRecordingEnabled()) {
        try {
          pipelineId = await this.chimeService.startRecording(
            meetingSession.meeting.meetingId,
          );
        } catch (err) {
          // Recording failure is non-blocking — log and continue; call proceeds without recording
          this.logger.error({
            message: 'Failed to start recording pipeline (non-blocking)',
            meetingId: meetingSession.meeting.meetingId,
            error: (err as Error).message,
          });
        }
      }

      // ── Build session object ──
      const session: CallSession = {
        sessionId,
        meetingId: meetingSession.meeting.meetingId,
        locationId,
        callerId,
        callerName,
        callType: callType as CallType,
        status: CallStatus.INITIATING,
        mediaRegion: meetingSession.meeting.mediaRegion,
        pipelineId,
        nurseAttendeeId: meetingSession.attendee.attendeeId,
        nurseJoinToken: meetingSession.attendee.joinToken,
        createdAt: new Date().toISOString(),
      };

      // ── Store session in Redis ──
      await this.saveSession(session);

      // Map meetingId → sessionId for webhook lookups
      await this.redis.set(
        `${REDIS_KEYS.MEETING_MAP}${session.meetingId}`,
        sessionId,
        'EX',
        3600, // 1h TTL
      );

      // Store media placement for patient-accept flow
      await this.redis.set(
        `meeting:placement:${session.meetingId}`,
        JSON.stringify(meetingSession.meeting.mediaPlacement),
        'EX',
        3600,
      );

      // ── Step 3: Notify the patient (via WebSocket or GetWell Stay) ──
      // First try WebSocket notification for patient browser (demo POC)
      const patientOnline = this.deviceGateway.isPatientOnline(locationId);
      if (patientOnline) {
        this.deviceGateway.notifyPatientIncomingCall(locationId, {
          meetingId: meetingSession.meeting.meetingId,
          callerName,
          callType: callType || 'regular',
          sessionId,
        });
        this.logger.log({
          message: 'Patient notified via WebSocket (browser)',
          locationId,
        });
      } else {
        // Fallback: Signal via GetWell Stay TV (production flow)
        try {
          await this.getwellStayService.startCall(
            locationId,
            meetingSession.meeting.meetingId,
            callerName,
            callType as 'regular' | 'override',
          );
        } catch (err: any) {
          // In development, GetWell Stay may not be configured — allow call to continue
          this.logger.warn({
            message: 'GetWell Stay start_call failed (non-blocking in dev)',
            locationId,
            error: err?.message || String(err),
          });
          if (process.env.NODE_ENV === 'production') throw err;
        }
      }

      // Update status to RINGING
      session.status = CallStatus.RINGING;
      session.ringingAt = new Date().toISOString();
      await this.saveSession(session);

      // Notify Nurse Console of status change
      this.deviceGateway.emitCallStatusUpdate(
        locationId,
        session.meetingId,
        CallStatus.RINGING,
      );

      this.logger.log({
        message: 'Call ringing',
        sessionId,
        meetingId: session.meetingId,
        locationId,
        event: AUDIT_EVENTS.CALL_RINGING,
      });

      // ── Step 3b: Emergency Override → auto-join camera immediately ──
      if (callType === 'override') {
        await this.handleCallAccepted(session);
      } else {
        // Start timeout timer for regular calls
        this.startCallTimeout(sessionId, session.meetingId, locationId);
      }

      return {
        sessionId,
        meetingId: meetingSession.meeting.meetingId,
        attendeeId: meetingSession.attendee.attendeeId,
        joinToken: meetingSession.attendee.joinToken,
        mediaRegion: meetingSession.meeting.mediaRegion,
        mediaPlacement: meetingSession.meeting.mediaPlacement as any,
      };
    } catch (error) {
      this.logger.error({
        message: 'Call initiation failed',
        sessionId,
        locationId,
        error: error.message,
        event: AUDIT_EVENTS.CALL_FAILED,
      });
      throw error;
    }
  }

  /**
   * Step 4: Handle patient action webhook from the TV system.
   * POST /api/ipc/client/action → ACCEPTED | DECLINED | IGNORED
   */
  async handlePatientAction(dto: PatientActionDto): Promise<void> {
    const { action, meetingId, locationId } = dto;

    // Look up session by meetingId
    const sessionId = await this.redis.get(
      `${REDIS_KEYS.MEETING_MAP}${meetingId}`,
    );
    if (!sessionId) {
      this.logger.warn({
        message: 'Webhook received for unknown meeting',
        meetingId,
        locationId,
      });
      return;
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      this.logger.warn({
        message: 'Session not found for webhook',
        sessionId,
        meetingId,
      });
      return;
    }

    this.logger.log({
      message: `Patient action received: ${action}`,
      sessionId,
      meetingId,
      locationId,
    });

    switch (action) {
      case 'ACCEPTED':
        await this.handleCallAccepted(session);
        break;
      case 'DECLINED':
        await this.handleCallDeclined(session);
        break;
      case 'IGNORED':
        await this.handleCallIgnored(session);
        break;
      default:
        this.logger.warn({
          message: `Unknown patient action: ${action}`,
          sessionId,
          meetingId,
        });
    }
  }

  /**
   * Handle ACCEPTED — Create camera attendee, signal device to join.
   * Used by the TV webhook flow (production).
   */
  private async handleCallAccepted(session: CallSession): Promise<void> {
    session.status = CallStatus.ACCEPTED;
    session.acceptedAt = new Date().toISOString();
    await this.saveSession(session);

    this.logger.log({
      message: 'Call accepted — creating camera attendee',
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      event: AUDIT_EVENTS.CALL_ACCEPTED,
    });

    // Create attendee for the camera device
    const deviceAttendee = await this.chimeService.createAttendee(
      session.meetingId,
      `device-${session.locationId}`,
    );

    session.deviceAttendeeId = deviceAttendee.attendeeId;
    session.deviceJoinToken = deviceAttendee.joinToken;

    // Signal camera device to join the meeting via WebSocket
    const joined = await this.deviceGateway.signalDeviceJoinMeeting(
      session.locationId,
      {
        type: 'JOIN_MEETING',
        meetingId: session.meetingId,
        attendeeInfo: {
          attendeeId: deviceAttendee.attendeeId,
          joinToken: deviceAttendee.joinToken,
        },
        meetingInfo: {
          mediaRegion: session.mediaRegion,
          mediaPlacement: {}, // Will be populated from meeting data
        },
      },
    );

    if (joined) {
      session.status = CallStatus.CONNECTED;
      session.connectedAt = new Date().toISOString();

      this.logger.log({
        message: 'Call connected — device joined meeting',
        sessionId: session.sessionId,
        meetingId: session.meetingId,
        event: AUDIT_EVENTS.CALL_CONNECTED,
      });
    } else {
      session.status = CallStatus.FAILED;
      this.logger.error({
        message: 'Failed to signal device — call failed',
        sessionId: session.sessionId,
        event: AUDIT_EVENTS.CALL_FAILED,
      });
    }

    await this.saveSession(session);
    this.deviceGateway.emitCallStatusUpdate(
      session.locationId,
      session.meetingId,
      session.status,
    );
  }

  /**
   * Patient accepts call from browser — creates patient attendee and
   * returns Chime credentials for the patient to join the meeting directly.
   * This is the demo POC flow replacing the TV webhook + camera device.
   */
  async patientAcceptCall(
    meetingId: string,
    locationId: string,
  ): Promise<{
    meetingId: string;
    attendeeId: string;
    joinToken: string;
    mediaRegion: string;
    mediaPlacement: Record<string, string>;
  }> {
    // Look up session by meetingId
    const sessionId = await this.redis.get(
      `${REDIS_KEYS.MEETING_MAP}${meetingId}`,
    );
    if (!sessionId) {
      throw new BadRequestException(
        `No active call found for meeting ${meetingId}`,
      );
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new BadRequestException(
        `Session not found for meeting ${meetingId}`,
      );
    }

    if (session.status !== CallStatus.RINGING) {
      throw new BadRequestException(
        `Call is not in RINGING state (current: ${session.status})`,
      );
    }

    this.logger.log({
      message: 'Patient accepted call from browser',
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      locationId,
      event: AUDIT_EVENTS.CALL_ACCEPTED,
    });

    // Update status
    session.status = CallStatus.ACCEPTED;
    session.acceptedAt = new Date().toISOString();
    await this.saveSession(session);

    // Notify nurse console of acceptance
    this.deviceGateway.emitCallStatusUpdate(
      session.locationId,
      session.meetingId,
      CallStatus.ACCEPTED,
    );

    // Create a Chime attendee for the patient
    const patientAttendee = await this.chimeService.createAttendee(
      session.meetingId,
      `patient-${locationId}`,
    );

    session.deviceAttendeeId = patientAttendee.attendeeId;
    session.deviceJoinToken = patientAttendee.joinToken;
    session.status = CallStatus.CONNECTED;
    session.connectedAt = new Date().toISOString();
    await this.saveSession(session);

    // Notify nurse console of connection
    this.deviceGateway.emitCallStatusUpdate(
      session.locationId,
      session.meetingId,
      CallStatus.CONNECTED,
    );

    this.logger.log({
      message: 'Patient attendee created — call connected',
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      attendeeId: patientAttendee.attendeeId,
      event: AUDIT_EVENTS.CALL_CONNECTED,
    });

    // Return the meeting info + patient attendee credentials
    // so the patient browser can join the Chime meeting
    return {
      meetingId: session.meetingId,
      attendeeId: patientAttendee.attendeeId,
      joinToken: patientAttendee.joinToken,
      mediaRegion: session.mediaRegion,
      mediaPlacement: await this.getMeetingMediaPlacement(session),
    };
  }

  /**
   * Patient declines call from browser.
   */
  async patientDeclineCall(meetingId: string): Promise<void> {
    const sessionId = await this.redis.get(
      `${REDIS_KEYS.MEETING_MAP}${meetingId}`,
    );
    if (!sessionId) return;

    const session = await this.getSession(sessionId);
    if (!session || session.status !== CallStatus.RINGING) return;

    await this.handleCallDeclined(session);
  }

  /**
   * Get the media placement info for a session (from the original meeting data).
   * In a real production system this would be cached in the session.
   */
  private async getMeetingMediaPlacement(
    session: CallSession,
  ): Promise<Record<string, string>> {
    // We need to retrieve the mediaPlacement from the stored session
    // For the POC, we store it in Redis when the meeting is created
    const placementData = await this.redis.get(
      `meeting:placement:${session.meetingId}`,
    );
    if (placementData) {
      return JSON.parse(placementData);
    }
    // Fallback — empty (shouldn't happen if we store it during creation)
    return {};
  }

  /**
   * Handle DECLINED — Tear down meeting, notify nurse.
   */
  private async handleCallDeclined(session: CallSession): Promise<void> {
    session.status = CallStatus.DECLINED;
    session.terminatedAt = new Date().toISOString();
    await this.saveSession(session);

    this.logger.log({
      message: 'Call declined by patient',
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      event: AUDIT_EVENTS.CALL_DECLINED,
    });

    // Tear down Chime meeting
    await this.teardownCall(session);
  }

  /**
   * Handle IGNORED — Same as declined, but with different status.
   */
  private async handleCallIgnored(session: CallSession): Promise<void> {
    session.status = CallStatus.IGNORED;
    session.terminatedAt = new Date().toISOString();
    await this.saveSession(session);

    this.logger.log({
      message: 'Call ignored by patient (timeout)',
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      event: AUDIT_EVENTS.CALL_TIMEOUT,
    });

    await this.teardownCall(session);
  }

  /**
   * Step 6: End an active call.
   * Called by the nurse or automatically on disconnect.
   */
  async endCall(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    session.status = CallStatus.TERMINATED;
    session.terminatedAt = new Date().toISOString();
    await this.saveSession(session);

    this.logger.log({
      message: 'Call terminated',
      sessionId,
      meetingId: session.meetingId,
      locationId: session.locationId,
      durationMs: session.connectedAt
        ? Date.now() - new Date(session.connectedAt).getTime()
        : 0,
      event: AUDIT_EVENTS.CALL_TERMINATED,
    });

    await this.teardownCall(session);
  }

  /**
   * Full teardown: stop recording, delete meeting, end TV session, signal device.
   */
  private async teardownCall(session: CallSession): Promise<void> {
    try {
      // Stop recording pipeline
      if (session.pipelineId) {
        await this.chimeService.stopRecording(session.pipelineId).catch((err) =>
          this.logger.error({
            message: 'Failed to stop recording',
            error: (err as Error).message,
          }),
        );

        // Persist recording metadata for HIPAA audit and retrieval
        await this.persistRecordingMetadata(session).catch((err) =>
          this.logger.error({
            message: 'Failed to persist recording metadata (non-blocking)',
            sessionId: session.sessionId,
            error: (err as Error).message,
          }),
        );
      }

      // Delete Chime meeting
      await this.chimeService.deleteMeeting(session.meetingId).catch((err) =>
        this.logger.error({
          message: 'Failed to delete meeting',
          error: (err as Error).message,
        }),
      );

      // Signal camera device to leave
      await this.deviceGateway.signalDeviceLeaveMeeting(session.locationId, {
        type: 'LEAVE_MEETING',
        meetingId: session.meetingId,
      });

      // Restore TV to previous state via GetWell Stay API
      await this.getwellStayService
        .endCall(session.locationId, session.meetingId)
        .catch((err) =>
          this.logger.error({
            message: 'Failed to send end_call to GetWell Stay',
            error: err.message,
          }),
        );

      // Notify Nurse Console
      this.deviceGateway.emitCallStatusUpdate(
        session.locationId,
        session.meetingId,
        session.status,
      );

      // Notify patient browser that call ended
      this.deviceGateway.notifyPatientCallEnded(
        session.locationId,
        session.meetingId,
      );

      // Clean up Redis
      await this.redis.del(`${REDIS_KEYS.MEETING_MAP}${session.meetingId}`);
      await this.redis.del(`meeting:placement:${session.meetingId}`);
    } catch (error) {
      this.logger.error({
        message: 'Error during call teardown',
        sessionId: session.sessionId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Persist recording metadata for HIPAA audit. Chime writes to S3 under captures/{pipelineId}/.
   */
  private async persistRecordingMetadata(session: CallSession): Promise<void> {
    if (!session.pipelineId) return;

    const meta = this.recordingMetadataRepo.create({
      sessionId: session.sessionId,
      meetingId: session.meetingId,
      pipelineId: session.pipelineId,
      locationId: session.locationId,
      callerId: session.callerId,
      startedAt: session.createdAt ? new Date(session.createdAt) : null,
      endedAt: session.terminatedAt ? new Date(session.terminatedAt) : null,
      s3Prefix: `captures/${session.pipelineId}`,
    });
    await this.recordingMetadataRepo.save(meta);

    this.logger.log({
      message: 'Recording metadata persisted',
      sessionId: session.sessionId,
      pipelineId: session.pipelineId,
    });
  }

  // ── Redis Session Helpers ──

  private async saveSession(session: CallSession): Promise<void> {
    await this.redis.set(
      `${REDIS_KEYS.CALL_SESSION}${session.sessionId}`,
      JSON.stringify(session),
      'EX',
      7200, // 2h TTL
    );
  }

  async getSession(sessionId: string): Promise<CallSession | null> {
    const data = await this.redis.get(`${REDIS_KEYS.CALL_SESSION}${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  private async getActiveSessionByLocation(
    _locationId: string,
  ): Promise<CallSession | null> {
    // Scan for active sessions at this location
    // In production, maintain a location → sessionId index in Redis
    // For now, this is a simplified implementation
    return null;
  }

  /**
   * Start a timeout timer for regular calls.
   * If the patient doesn't respond within CALL_TIMEOUT_MS, auto-decline.
   */
  private startCallTimeout(
    sessionId: string,
    meetingId: string,
    locationId: string,
  ): void {
    setTimeout(async () => {
      const session = await this.getSession(sessionId);
      if (session && session.status === CallStatus.RINGING) {
        this.logger.log({
          message: 'Call timeout — patient did not respond',
          sessionId,
          meetingId,
          locationId,
          event: AUDIT_EVENTS.CALL_TIMEOUT,
        });
        await this.handleCallIgnored(session);
      }
    }, CALL_TIMEOUT_MS);
  }
}
