import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add recording_metadata table for S3 recording audit and retrieval.
 * HIPAA: No PHI — sessionId, meetingId, locationId, callerId only.
 */
export class AddRecordingMetadata1739100000000 implements MigrationInterface {
  name = 'AddRecordingMetadata1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "recording_metadata" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sessionId" character varying NOT NULL,
        "meetingId" character varying NOT NULL,
        "pipelineId" character varying,
        "locationId" character varying NOT NULL,
        "callerId" character varying NOT NULL,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "s3Prefix" character varying(512),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recording_metadata" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_recording_metadata_sessionId" ON "recording_metadata" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_recording_metadata_meetingId" ON "recording_metadata" ("meetingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_recording_metadata_locationId" ON "recording_metadata" ("locationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_recording_metadata_createdAt" ON "recording_metadata" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recording_metadata"`);
  }
}
