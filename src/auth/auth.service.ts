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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
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
      firstName: user.firstName as string | null,
      lastName: user.lastName as string | null,
      email: user.email,
      activeRole: user.activeRole as 'BUYER' | 'SELLER' | 'ADMIN',
      roles: user.roles as ('BUYER' | 'SELLER' | 'ADMIN')[],
    };
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

    const tokenPayload = {
      id: user.id,
      email: user.email,
      activeRole: user.activeRole as 'BUYER' | 'SELLER' | 'ADMIN',
    };
    const accessToken = this.jwtService.sign(tokenPayload);
    return {
      accessToken,
    };
  }
}
