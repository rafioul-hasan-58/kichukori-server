import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    description: 'The email address of the user requesting OTP resend',
    example: 'harry@gmail.com',
  })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;
}
