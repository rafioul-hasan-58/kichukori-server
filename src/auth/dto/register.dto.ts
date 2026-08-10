import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'Harry',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Kane',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'harry@gmail.com',
  })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Password of the user (minimum 6 characters)',
    example: '12345678',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @ApiProperty({
    description: 'The active role of the user (BUYER or SELLER)',
    enum: Role,
    example: Role.BUYER,
    required: false,
    default: Role.BUYER,
  })
  @IsEnum(Role, {
    message: 'activeRole must be a valid role (BUYER, SELLER, ADMIN)',
  })
  @IsOptional()
  activeRole: Role = Role.BUYER;
}
