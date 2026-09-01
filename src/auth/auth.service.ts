import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../modules/users/users.repository';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.schema';
import { User, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../modules/mail/mail.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { OAuth2Client } from 'google-auth-library';

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

  async resendOtp(payload: ResendOtpDto) {
    const user = await this.usersRepository.findByEmail(payload.email);

    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
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
      message: 'OTP verification code resent successfully.',
      email: payload.email,
    };
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

    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google Login. Please sign in with Google.',
      );
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

  async forgotPassword(payload: ForgotPasswordDto) {
    const user = await this.usersRepository.findByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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

    await this.mailService.sendPasswordResetOtp(payload.email, otpCode);

    return {
      message:
        'Password reset OTP verification code sent to your email address.',
      email: payload.email,
    };
  }

  async verifyResetOtp(payload: VerifyResetOtpDto) {
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
      throw new NotFoundException('User with this email does not exist');
    }

    await this.prisma.otp.delete({
      where: { email: payload.email },
    });

    const resetToken = await this.jwtService.signAsync(
      {
        id: user.id,
        email: user.email,
        activeRole: user.activeRole,
        purpose: 'reset-password',
      },
      {
        expiresIn: '10m',
      },
    );

    return {
      message: 'OTP verified successfully.',
      resetToken,
    };
  }

  async resetPassword(userId: string, password: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message: 'Password reset successfully.',
    };
  }

  async authenticateGoogleToken(idToken: string, activeRole?: Role) {
    const clientId = this.configService.get('OAUTH_CLIENT_ID', {
      infer: true,
    });
    if (!clientId) {
      throw new Error('Google Client ID is not configured');
    }
    const client = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
    } = payload;

    if (!email) {
      throw new UnauthorizedException('Email not provided by Google');
    }

    // Check if user exists by googleId first
    let user = await this.prisma.user.findFirst({
      where: { googleId },
    });

    // If not found, check by email (to link account if they registered with email previously)
    if (!user) {
      user = await this.usersRepository.findByEmail(email);

      if (user) {
        // Link Google ID to existing user and mark email as verified
        user = await this.prisma.user.update({
          where: { email },
          data: {
            googleId,
            isEmailVerified: true,
          },
        });
      } else {
        // First time Google registration: activeRole is required
        if (!activeRole) {
          throw new BadRequestException(
            'Active role is required for first-time registration via Google',
          );
        }

        // Create new user without password
        user = await this.usersRepository.create({
          email,
          googleId,
          firstName: firstName || null,
          lastName: lastName || null,
          isEmailVerified: true,
          activeRole,
          roles: [activeRole],
        });
      }
    }

    return this.generateTokens(user);
  }
}
