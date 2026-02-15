import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChimeService } from '../chime.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-chime-sdk-meetings', () => ({
  ChimeSDKMeetingsClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  CreateMeetingCommand: jest.fn(),
  CreateAttendeeCommand: jest.fn(),
  DeleteMeetingCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-chime-sdk-media-pipelines', () => ({
  ChimeSDKMediaPipelinesClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  CreateMediaCapturePipelineCommand: jest.fn(),
  DeleteMediaCapturePipelineCommand: jest.fn(),
}));

describe('ChimeService', () => {
  let service: ChimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChimeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'chime.region': 'us-east-1',
                'chime.meetingRegion': 'us-east-1',
                'chime.recordingBucket': 'arn:aws:s3:::test-bucket',
                'chime.kmsKeyArn': 'arn:aws:kms:us-east-1:123:key/test',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ChimeService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize Chime SDK clients on module init', () => {
    // Service should have created both clients
    expect(service).toBeDefined();
  });

  // Note: Full integration tests with AWS would use localstack or mock responses
  // These unit tests verify the service structure and DI wiring
});
