import { IsString, IsEmail, IsNotEmpty, MinLength, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'nurse.joy@hospital.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Joy' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'nurse', enum: ['nurse', 'admin', 'supervisor'] })
  @IsIn(['nurse', 'admin', 'supervisor'])
  @IsOptional()
  role?: 'nurse' | 'admin' | 'supervisor';

  @ApiProperty({ example: 'EMP-12345', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
