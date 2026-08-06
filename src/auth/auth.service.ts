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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.usersRepository.findByEmail(payload.email);

    if (existing) {
      throw new ConflictException('This email is already in use!');
    }
    const hashedPassword = await bcrypt.hash(payload.password, 12);

    const user = await this.usersRepository.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: hashedPassword,
      activeRole: payload.activeRole,
      roles: [payload.activeRole],
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      activeRole: user.activeRole,
      roles: user.roles as ('BUYER' | 'SELLER' | 'ADMIN')[],
    };
  }

  private async generateTokens(user: User) {
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.activeRole as 'BUYER' | 'SELLER' | 'ADMIN',
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
