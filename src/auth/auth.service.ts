import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../modules/users/users.repository';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.schema';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../modules/mail/mail.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.usersRepository.findByEmail(payload.email);

    if (existing) {
      if (existing.isEmailVerified) {
        throw new ConflictException(
          'This email is already in use and verified!',
        );
      }

      const hashedPassword = await bcrypt.hash(payload.password, 12);
      await this.prisma.user.update({
        where: { email: payload.email },
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          password: hashedPassword,
          activeRole: payload.activeRole,
          roles: [payload.activeRole],
        },
      });
    } else {
      const hashedPassword = await bcrypt.hash(payload.password, 12);
      await this.usersRepository.create({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        password: hashedPassword,
        activeRole: payload.activeRole,
        roles: [payload.activeRole],
        isEmailVerified: false,
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save/upsert OTP
    await this.prisma.otp.upsert({
      where: { email: payload.email },
      update: {
        code: otpCode,
        expiresAt,
      },
      create: {
        email: payload.email,
        code: otpCode,
        expiresAt,
      },
    });

    // Send styled email
    await this.mailService.sendOtp(payload.email, otpCode);

    return {
      message: 'OTP verification code sent to your email address.',
      email: payload.email,
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    const otpRecord = await this.prisma.otp.findUnique({
      where: { email: payload.email },
    });

    if (!otpRecord) {
      throw new UnauthorizedException(
        'No verification request found for this email',
      );
    }

    if (otpRecord.code !== payload.otp) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new UnauthorizedException('Verification code has expired');
    }

    const user = await this.usersRepository.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Mark user as verified
    await this.prisma.user.update({
      where: { email: payload.email },
      data: { isEmailVerified: true },
    });

    // Delete used OTP
    await this.prisma.otp.delete({
      where: { email: payload.email },
    });

    // Return session tokens
    return this.generateTokens(user);
  }

  private async generateTokens(user: User) {
    const tokenPayload = {
      id: user.id,
      email: user.email,
      activeRole: user.activeRole,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload);

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', {
        infer: true,
      }),
    });

    return { accessToken, refreshToken };
  }

  async login(payload: LoginDto) {
    const user = await this.usersRepository.findByEmail(payload.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password!');
    }

    const isMatch = await bcrypt.compare(payload.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password!');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(token: string) {
    try {
      const secret = this.configService.get('JWT_REFRESH_SECRET', {
        infer: true,
      });
      const payload = await this.jwtService.verifyAsync<{
        id: string;
        email: string;
      }>(token, {
        secret,
      });

      const user = await this.usersRepository.findById(payload.id);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
