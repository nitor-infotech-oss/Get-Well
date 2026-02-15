import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for initiating a call from the Nurse Console.
 * This kicks off the entire "Digital Knock" workflow.
 */
export class InitiateCallDto {
  @ApiProperty({
    description: 'Physical room/location identifier for the target patient TV',
    example: 'room-123',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Nurse user identifier (not PHI)',
    example: 'nurse-usr-456',
  })
  @IsString()
  @IsNotEmpty()
  callerId: string;

  @ApiProperty({
    description: 'Nurse display name shown on the TV prompt',
    example: 'Nurse Joy',
  })
  @IsString()
  @IsNotEmpty()
  callerName: string;

  @ApiProperty({
    description: 'Call type: regular or override (emergency)',
    enum: ['regular', 'override'],
    default: 'regular',
  })
  @IsIn(['regular', 'override'])
  @IsOptional()
  callType?: 'regular' | 'override' = 'regular';

  @ApiProperty({
    description: 'Preferred Chime media region (auto-detected if omitted)',
    example: 'us-east-1',
    required: false,
  })
  @IsString()
  @IsOptional()
  mediaRegion?: string;
}
