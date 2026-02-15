import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMeetingDto {
  @ApiProperty({
    description: 'Physical room/location identifier',
    example: 'room-123',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Caller (nurse) user identifier — NOT the patient name',
    example: 'nurse-usr-456',
  })
  @IsString()
  @IsNotEmpty()
  callerId: string;

  @ApiProperty({
    description: 'Preferred media region (optional, auto-detected if omitted)',
    example: 'us-east-1',
    required: false,
  })
  @IsString()
  @IsOptional()
  mediaRegion?: string;
}
