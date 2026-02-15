/**
 * Interfaces for the Amazon Chime SDK integration module.
 * All types mirror the Chime SDK Developer Guide specifications.
 */

export interface CreateMeetingParams {
  /** Unique token for idempotent meeting creation (REQUIRED by Chime SDK) */
  clientRequestToken: string;
  /** External meeting ID for correlation with internal call sessions */
  externalMeetingId: string;
  /** AWS region for the meeting (e.g., us-east-1, us-gov-west-1) */
  mediaRegion: string;
}

export interface CreateMeetingResult {
  meetingId: string;
  mediaRegion: string;
  mediaPlacement: {
    audioHostUrl: string;
    audioFallbackUrl: string;
    signalingUrl: string;
    turnControlUrl: string;
    screenDataUrl: string;
    screenSharingUrl: string;
    screenViewingUrl: string;
    eventIngestionUrl: string;
  };
}

export interface CreateAttendeeParams {
  meetingId: string;
  /** Unique token for idempotent attendee creation */
  externalUserId: string;
}

export interface CreateAttendeeResult {
  attendeeId: string;
  externalUserId: string;
  joinToken: string;
}

export interface MeetingSession {
  meeting: CreateMeetingResult;
  attendee: CreateAttendeeResult;
}

export interface MediaCapturePipelineParams {
  /** Unique token for idempotent pipeline creation (REQUIRED) */
  clientRequestToken: string;
  meetingId: string;
  /** S3 bucket ARN for recording artifacts */
  s3BucketArn: string;
  /** KMS key ARN for encryption at rest */
  kmsKeyArn?: string;
}
