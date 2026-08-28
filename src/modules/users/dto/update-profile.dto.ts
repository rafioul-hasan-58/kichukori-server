import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'Harry',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Kane',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Profile image file to upload',
    required: false,
  })
  @IsOptional()
  profileImage?: any;

  @ApiProperty({
    description: 'Latitude of the user location',
    example: 23.8103,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    description: 'Longitude of the user location',
    example: 90.4125,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;
}
