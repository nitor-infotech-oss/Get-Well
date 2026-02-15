import { IsString, IsNotEmpty, IsIn, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for the patient action webhook received from the TV system.
 * Endpoint: POST /api/ipc/client/action
 */
export class PatientActionDto {
  @ApiProperty({
    description: 'Patient response to the incoming call',
    enum: ['ACCEPTED', 'DECLINED', 'IGNORED'],
    example: 'ACCEPTED',
  })
  @IsIn(['ACCEPTED', 'DECLINED', 'IGNORED'])
  action: 'ACCEPTED' | 'DECLINED' | 'IGNORED';

  @ApiProperty({
    description: 'ISO 8601 timestamp of the patient action',
    example: '2026-02-15T10:00:00Z',
  })
  @IsISO8601()
  time: string;

  @ApiProperty({
    description: 'Physical room/location identifier',
    example: 'room-123',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Meeting ID correlating to the call session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  meetingId: string;
}
