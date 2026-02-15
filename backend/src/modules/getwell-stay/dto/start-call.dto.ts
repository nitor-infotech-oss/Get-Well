import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartCallDto {
  @ApiProperty({
    description: 'Physical room/location identifier mapped to the TV',
    example: 'room-123',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Chime meeting ID for this call session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  meetingId: string;

  @ApiProperty({
    description: 'Display name shown on the TV (nurse name)',
    example: 'Nurse Joy',
  })
  @IsString()
  @IsNotEmpty()
  callerName: string;

  @ApiProperty({
    description: 'Call type: regular (requires acceptance) or override (emergency auto-answer)',
    enum: ['regular', 'override'],
    example: 'regular',
  })
  @IsIn(['regular', 'override'])
  callType: 'regular' | 'override';
}
