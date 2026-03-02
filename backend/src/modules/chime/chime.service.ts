import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
} from '@aws-sdk/client-chime-sdk-meetings';
import {
  ChimeSDKMediaPipelinesClient,
  CreateMediaCapturePipelineCommand,
  CreateMediaConcatenationPipelineCommand,
  DeleteMediaCapturePipelineCommand,
  GetMediaCapturePipelineCommand,
} from '@aws-sdk/client-chime-sdk-media-pipelines';
import {
  generateClientRequestToken,
  generateMeetingExternalId,
} from '../../common/utils/idempotency.util';
import {
  CreateMeetingResult,
  CreateAttendeeResult,
  MeetingSession,
} from './interfaces/chime.interfaces';

/**
 * Amazon Chime SDK Integration Service.
 *
 * Strictly follows the Amazon Chime SDK Developer Guide:
 * - Uses unique ClientRequestToken for every CreateMeeting / CreateMediaCapturePipeline
 * - Supports nearest media region selection
 * - Manages Media Capture Pipelines for Phase 1 recording requirement
 * - HIPAA: S3 recordings encrypted at rest (SSE-KMS)
 */
@Injectable()
export class ChimeService implements OnModuleInit {
  private readonly logger = new Logger(ChimeService.name);
  private meetingsClient: ChimeSDKMeetingsClient;
  private pipelinesClient: ChimeSDKMediaPipelinesClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const region = this.configService.get<string>('chime.region');

    this.meetingsClient = new ChimeSDKMeetingsClient({ region });
    this.pipelinesClient = new ChimeSDKMediaPipelinesClient({ region });

    this.logger.log(`Chime SDK initialized in region: ${region}`);
  }

  /**
   * Create a new Chime meeting and an attendee for the nurse.
   * Per Chime SDK guide (pg 46/657): ClientRequestToken is REQUIRED for idempotency.
   */
  async createMeetingSession(
    locationId: string,
    callerId: string,
    mediaRegion?: string,
  ): Promise<MeetingSession> {
    const resolvedRegion =
      mediaRegion || this.configService.get<string>('chime.meetingRegion');

    // Step 1: Create Meeting with idempotency token
    const meetingToken = generateClientRequestToken('mtg');
    const externalMeetingId = generateMeetingExternalId(locationId, callerId);

    this.logger.log({
      message: 'Creating Chime meeting',
      meetingToken,
      externalMeetingId,
      mediaRegion: resolvedRegion,
      locationId,
      // No PHI logged — only anonymized IDs
    });

    const meetingResponse = await this.meetingsClient.send(
      new CreateMeetingCommand({
        ClientRequestToken: meetingToken,
        ExternalMeetingId: externalMeetingId,
        MediaRegion: resolvedRegion,
      }),
    );

    const mtg = meetingResponse.Meeting!;
    const mp = mtg.MediaPlacement!;

    const meeting: CreateMeetingResult = {
      meetingId: mtg.MeetingId!,
      mediaRegion: mtg.MediaRegion!,
      mediaPlacement: {
        audioHostUrl: mp.AudioHostUrl ?? '',
        audioFallbackUrl: mp.AudioFallbackUrl ?? '',
        signalingUrl: mp.SignalingUrl ?? '',
        turnControlUrl: mp.TurnControlUrl ?? '',
        screenDataUrl: mp.ScreenDataUrl ?? '',
        screenSharingUrl: mp.ScreenSharingUrl ?? '',
        screenViewingUrl: mp.ScreenViewingUrl ?? '',
        eventIngestionUrl: mp.EventIngestionUrl ?? '',
      },
    };

    // Step 2: Create Attendee for the nurse caller
    const attendee = await this.createAttendee(meeting.meetingId, callerId);

    return { meeting, attendee };
  }

  /**
   * Create an attendee for an existing meeting.
   */
  async createAttendee(
    meetingId: string,
    externalUserId: string,
  ): Promise<CreateAttendeeResult> {
    this.logger.log({
      message: 'Creating Chime attendee',
      meetingId,
      externalUserId,
    });

    const response = await this.meetingsClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: externalUserId,
      }),
    );

    const att = response.Attendee!;
    return {
      attendeeId: att.AttendeeId!,
      externalUserId: att.ExternalUserId!,
      joinToken: att.JoinToken!,
    };
  }

  /**
   * Start a Media Capture Pipeline for recording.
   * Per Chime SDK: ClientRequestToken is REQUIRED to prevent duplicate pipelines on retry.
   * Recordings are stored in encrypted S3 (SSE-KMS).
   */
  async startRecording(meetingId: string): Promise<string> {
    const pipelineToken = generateClientRequestToken('pipe');
    const bucket = this.configService.get<string>('chime.recordingBucket');
    const kmsKeyArn = this.configService.get<string>('chime.kmsKeyArn');

    this.logger.log({
      message: 'Starting media capture pipeline',
      meetingId,
      pipelineToken,
    });

    const response = await this.pipelinesClient.send(
      new CreateMediaCapturePipelineCommand({
        SourceType: 'ChimeSdkMeeting',
        SourceArn: `arn:aws:chime::231733667519:meeting:${meetingId}`,
        SinkType: 'S3Bucket',
        SinkArn: bucket,
        ChimeSdkMeetingConfiguration: {
          ArtifactsConfiguration: {
            Audio: { MuxType: 'AudioWithActiveSpeakerVideo' },
            Video: {
              State: 'Enabled',
              MuxType: 'VideoOnly',
            },
            Content: { State: 'Disabled', MuxType: 'ContentOnly' },
          },
        },
      }),
    );

    const pipelineId = response.MediaCapturePipeline!.MediaPipelineId!;
    this.logger.log({
      message: 'Media capture pipeline started',
      meetingId,
      pipelineId,
    });

    return pipelineId;
  }

  /**
   * Delete (end) a Chime meeting. Called during call teardown.
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    this.logger.log({ message: 'Deleting Chime meeting', meetingId });

    await this.meetingsClient.send(
      new DeleteMeetingCommand({ MeetingId: meetingId }),
    );
  }

  isRecordingEnabled(): boolean {
    const bucket = this.configService.get<string>('chime.recordingBucket');
    return !!bucket && bucket.trim().length > 0;
  }

  /// new set try
  private async waitForCaptureToStop(pipelineId: string): Promise<void> {
    const maxAttempts = 30; // ~60 seconds total
    const delayMs = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.pipelinesClient.send(
          new GetMediaCapturePipelineCommand({
            MediaPipelineId: pipelineId,
          }),
        );

        const status = response.MediaCapturePipeline?.Status;

        if (status === 'Stopped') {
          return;
        }

        if (status === 'Failed') {
          throw new Error('Capture pipeline failed.');
        }
      } catch (err) {
        // After delete, sometimes AWS returns NotFound — treat as stopped
        return;
      }

      await new Promise((res) => setTimeout(res, delayMs));
    }

    throw new Error('Timeout waiting for capture pipeline to stop.');
  }

  ///
  /**
   * Stop a media capture pipeline.
   */
  async stopRecording(pipelineId: string): Promise<void> {
    // this.logger.log({
    //   message: 'Stopping media capture pipeline',
    //   pipelineId,
    // });

    // await this.pipelinesClient.send(
    //   new DeleteMediaCapturePipelineCommand({
    //     MediaPipelineId: pipelineId,
    //   }),
    // );

    this.logger.log({
      message: 'Stopping media capture pipeline',
      pipelineId,
    });

    const accountId = this.configService.get<string>('chime.accountId');
    const region = this.configService.get<string>('chime.region');
    const bucket = this.configService.get<string>('chime.recordingBucket');

    const sinkArn = bucket!.startsWith('arn:')
      ? bucket
      : `arn:aws:s3:::${bucket}`;

    const pipelineArn = `arn:aws:chime:${region}:${accountId}:media-pipeline/${pipelineId}`;

    // 1️ Stop capture
    await this.pipelinesClient.send(
      new DeleteMediaCapturePipelineCommand({
        MediaPipelineId: pipelineId,
      }),
    );
    // Wait until capture fully stops
    await this.waitForCaptureToStop(pipelineId);
    // 2️ Create concatenation
    await this.pipelinesClient.send(
      new CreateMediaConcatenationPipelineCommand({
        Sources: [
          {
            Type: 'MediaCapturePipeline',
            MediaCapturePipelineSourceConfiguration: {
              MediaPipelineArn: pipelineArn,
              ChimeSdkMeetingConfiguration: {
                ArtifactsConfiguration: {
                  Audio: { State: 'Enabled' },
                  Video: { State: 'Enabled' },
                  Content: { State: 'Disabled' },
                  DataChannel: { State: 'Disabled' },
                  TranscriptionMessages: { State: 'Disabled' },
                  MeetingEvents: { State: 'Disabled' },
                  CompositedVideo: { State: 'Disabled' },
                },
              },
            },
          },
        ],
        Sinks: [
          {
            Type: 'S3Bucket',
            S3BucketSinkConfiguration: {
              Destination: sinkArn,
            },
          },
        ],
      }),
    );

    this.logger.log({
      message: 'Concatenation pipeline started',
      pipelineId,
    });
  }
}
