import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { CallOrchestrationService } from '../call-orchestration.service';
import { ChimeService } from '../../chime/chime.service';
import { GetwellStayService } from '../../getwell-stay/getwell-stay.service';
import { DeviceGateway } from '../../websocket/device.gateway';
import { REDIS_CLIENT } from '../../../config/redis.config';
import { CallStatus } from '../../../common/enums';

describe('CallOrchestrationService', () => {
  let service: CallOrchestrationService;
  let chimeService: jest.Mocked<ChimeService>;
  let getwellStayService: jest.Mocked<GetwellStayService>;
  let deviceGateway: jest.Mocked<DeviceGateway>;
  let redisClient: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Mock Redis
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallOrchestrationService,
        {
          provide: ChimeService,
          useValue: {
            createMeetingSession: jest.fn(),
            createAttendee: jest.fn(),
            startRecording: jest.fn(),
            stopRecording: jest.fn(),
            deleteMeeting: jest.fn(),
          },
        },
        {
          provide: GetwellStayService,
          useValue: {
            startCall: jest.fn(),
            endCall: jest.fn(),
          },
        },
        {
          provide: DeviceGateway,
          useValue: {
            isDeviceOnline: jest.fn(),
            signalDeviceJoinMeeting: jest.fn(),
            signalDeviceLeaveMeeting: jest.fn(),
            emitCallStatusUpdate: jest.fn(),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get(CallOrchestrationService);
    chimeService = module.get(ChimeService);
    getwellStayService = module.get(GetwellStayService);
    deviceGateway = module.get(DeviceGateway);
  });

  describe('initiateCall', () => {
    const callDto = {
      locationId: 'room-101',
      callerId: 'nurse-001',
      callerName: 'Nurse Joy',
      callType: 'regular' as const,
    };

    it('should reject call if device is offline', async () => {
      deviceGateway.isDeviceOnline.mockResolvedValue(false);

      await expect(service.initiateCall(callDto)).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(chimeService.createMeetingSession).not.toHaveBeenCalled();
      expect(getwellStayService.startCall).not.toHaveBeenCalled();
    });

    it('should create Chime meeting and signal TV when device is online', async () => {
      deviceGateway.isDeviceOnline.mockResolvedValue(true);
      redisClient.get.mockResolvedValue(null); // No active session

      chimeService.createMeetingSession.mockResolvedValue({
        meeting: {
          meetingId: 'mtg-123',
          mediaRegion: 'us-east-1',
          mediaPlacement: {
            audioHostUrl: 'https://audio.example.com',
            audioFallbackUrl: '',
            signalingUrl: '',
            turnControlUrl: '',
            screenDataUrl: '',
            screenSharingUrl: '',
            screenViewingUrl: '',
            eventIngestionUrl: '',
          },
        },
        attendee: {
          attendeeId: 'att-456',
          externalUserId: 'nurse-001',
          joinToken: 'token-789',
        },
      });

      chimeService.startRecording.mockResolvedValue('pipe-abc');

      const result = await service.initiateCall(callDto);

      // Verify Chime meeting was created
      expect(chimeService.createMeetingSession).toHaveBeenCalledWith(
        'room-101',
        'nurse-001',
        undefined,
      );

      // Verify recording was started
      expect(chimeService.startRecording).toHaveBeenCalledWith('mtg-123');

      // Verify TV was signaled (Digital Knock)
      expect(getwellStayService.startCall).toHaveBeenCalledWith(
        'room-101',
        'mtg-123',
        'Nurse Joy',
        'regular',
      );

      // Verify response
      expect(result.meetingId).toBe('mtg-123');
      expect(result.joinToken).toBe('token-789');
      expect(result.attendeeId).toBe('att-456');
    });

    it('should continue even if recording fails (non-blocking)', async () => {
      deviceGateway.isDeviceOnline.mockResolvedValue(true);
      redisClient.get.mockResolvedValue(null);

      chimeService.createMeetingSession.mockResolvedValue({
        meeting: {
          meetingId: 'mtg-123',
          mediaRegion: 'us-east-1',
          mediaPlacement: {} as any,
        },
        attendee: {
          attendeeId: 'att-456',
          externalUserId: 'nurse-001',
          joinToken: 'token-789',
        },
      });

      // Recording fails
      chimeService.startRecording.mockRejectedValue(
        new Error('Pipeline creation failed'),
      );

      const result = await service.initiateCall(callDto);

      // Call should still succeed
      expect(result.meetingId).toBe('mtg-123');
      expect(getwellStayService.startCall).toHaveBeenCalled();
    });
  });

  describe('handlePatientAction', () => {
    const session = {
      sessionId: 'sess-001',
      meetingId: 'mtg-123',
      locationId: 'room-101',
      callerId: 'nurse-001',
      callerName: 'Nurse Joy',
      callType: 'regular',
      status: CallStatus.RINGING,
      mediaRegion: 'us-east-1',
      nurseAttendeeId: 'att-456',
      nurseJoinToken: 'token-789',
      createdAt: new Date().toISOString(),
      ringingAt: new Date().toISOString(),
    };

    it('should signal device to join when patient accepts', async () => {
      redisClient.get
        .mockResolvedValueOnce('sess-001')                // meetingMap lookup
        .mockResolvedValueOnce(JSON.stringify(session))    // session lookup
        ;

      chimeService.createAttendee.mockResolvedValue({
        attendeeId: 'device-att-001',
        externalUserId: 'device-room-101',
        joinToken: 'device-token-001',
      });

      deviceGateway.signalDeviceJoinMeeting.mockResolvedValue(true);

      await service.handlePatientAction({
        action: 'ACCEPTED',
        meetingId: 'mtg-123',
        locationId: 'room-101',
        time: new Date().toISOString(),
      });

      // Device attendee should be created
      expect(chimeService.createAttendee).toHaveBeenCalledWith(
        'mtg-123',
        'device-room-101',
      );

      // Device should be signaled to join
      expect(deviceGateway.signalDeviceJoinMeeting).toHaveBeenCalledWith(
        'room-101',
        expect.objectContaining({ type: 'JOIN_MEETING', meetingId: 'mtg-123' }),
      );
    });

    it('should tear down meeting when patient declines', async () => {
      redisClient.get
        .mockResolvedValueOnce('sess-001')
        .mockResolvedValueOnce(JSON.stringify(session));

      // Ensure teardown methods resolve
      chimeService.deleteMeeting.mockResolvedValue(undefined);
      getwellStayService.endCall.mockResolvedValue(undefined);
      deviceGateway.signalDeviceLeaveMeeting.mockResolvedValue(undefined);
      redisClient.set.mockResolvedValue('OK');
      redisClient.del.mockResolvedValue(1);

      await service.handlePatientAction({
        action: 'DECLINED',
        meetingId: 'mtg-123',
        locationId: 'room-101',
        time: new Date().toISOString(),
      });

      // Meeting should be deleted
      expect(chimeService.deleteMeeting).toHaveBeenCalledWith('mtg-123');

      // TV should be restored
      expect(getwellStayService.endCall).toHaveBeenCalledWith('room-101', 'mtg-123');

      // Device should not be signaled to join
      expect(deviceGateway.signalDeviceJoinMeeting).not.toHaveBeenCalled();
    });

    it('should ignore webhook for unknown meeting', async () => {
      redisClient.get.mockResolvedValue(null); // No mapping found

      await service.handlePatientAction({
        action: 'ACCEPTED',
        meetingId: 'unknown-mtg',
        locationId: 'room-999',
        time: new Date().toISOString(),
      });

      // Nothing should happen
      expect(chimeService.createAttendee).not.toHaveBeenCalled();
      expect(deviceGateway.signalDeviceJoinMeeting).not.toHaveBeenCalled();
    });
  });

  describe('endCall', () => {
    it('should throw if session not found', async () => {
      redisClient.get.mockResolvedValue(null);

      await expect(service.endCall('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should perform full teardown on end call', async () => {
      const session = {
        sessionId: 'sess-001',
        meetingId: 'mtg-123',
        locationId: 'room-101',
        pipelineId: 'pipe-abc',
        status: CallStatus.CONNECTED,
        connectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      redisClient.get.mockResolvedValue(JSON.stringify(session));

      // Ensure teardown methods resolve properly
      chimeService.stopRecording.mockResolvedValue(undefined);
      chimeService.deleteMeeting.mockResolvedValue(undefined);
      deviceGateway.signalDeviceLeaveMeeting.mockResolvedValue(undefined);
      getwellStayService.endCall.mockResolvedValue(undefined);
      redisClient.set.mockResolvedValue('OK');
      redisClient.del.mockResolvedValue(1);

      await service.endCall('sess-001');

      // Recording should stop
      expect(chimeService.stopRecording).toHaveBeenCalledWith('pipe-abc');

      // Meeting should be deleted
      expect(chimeService.deleteMeeting).toHaveBeenCalledWith('mtg-123');

      // Device should leave
      expect(deviceGateway.signalDeviceLeaveMeeting).toHaveBeenCalledWith(
        'room-101',
        expect.objectContaining({ type: 'LEAVE_MEETING' }),
      );

      // TV should be restored
      expect(getwellStayService.endCall).toHaveBeenCalledWith('room-101', 'mtg-123');

      // Redis mapping should be cleaned up
      expect(redisClient.del).toHaveBeenCalled();
    });
  });
});
