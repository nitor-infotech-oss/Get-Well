import { Test, TestingModule } from '@nestjs/testing';
import { CallOrchestrationController } from '../call-orchestration.controller';
import { CallOrchestrationService } from '../call-orchestration.service';

describe('CallOrchestrationController', () => {
  let controller: CallOrchestrationController;
  let service: jest.Mocked<CallOrchestrationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallOrchestrationController],
      providers: [
        {
          provide: CallOrchestrationService,
          useValue: {
            initiateCall: jest.fn(),
            handlePatientAction: jest.fn(),
            endCall: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CallOrchestrationController);
    service = module.get(CallOrchestrationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateCall', () => {
    it('should call service.initiateCall and return result', async () => {
      const mockResult = {
        sessionId: 'sess-001',
        meetingId: 'mtg-123',
        attendeeId: 'att-456',
        joinToken: 'token-789',
        mediaRegion: 'us-east-1',
        mediaPlacement: {},
      };

      service.initiateCall.mockResolvedValue(mockResult);

      const dto = {
        locationId: 'room-101',
        callerId: 'nurse-001',
        callerName: 'Nurse Joy',
      };

      const result = await controller.initiateCall(dto);
      expect(result).toEqual(mockResult);
      expect(service.initiateCall).toHaveBeenCalledWith(dto);
    });
  });

  describe('handlePatientAction', () => {
    it('should process webhook and return ok', async () => {
      service.handlePatientAction.mockResolvedValue(undefined);

      const dto = {
        action: 'ACCEPTED' as const,
        meetingId: 'mtg-123',
        locationId: 'room-101',
        time: '2026-02-15T10:00:00Z',
      };

      const result = await controller.handlePatientAction(dto);
      expect(result).toEqual({ status: 'ok' });
      expect(service.handlePatientAction).toHaveBeenCalledWith(dto);
    });
  });

  describe('endCall', () => {
    it('should call service.endCall and return terminated', async () => {
      service.endCall.mockResolvedValue(undefined);

      const result = await controller.endCall('sess-001');
      expect(result).toEqual({ status: 'terminated' });
      expect(service.endCall).toHaveBeenCalledWith('sess-001');
    });
  });
});
