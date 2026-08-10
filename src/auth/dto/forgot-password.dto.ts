import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The email address of the user requesting password reset',
    example: 'harry@gmail.com',
  })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;
}
