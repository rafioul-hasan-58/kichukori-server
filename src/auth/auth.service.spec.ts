import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../modules/users/users.repository';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../modules/mail/mail.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: UsersRepository;
  let prismaService: PrismaService;
  let mailService: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendOtp: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            otp: {
              upsert: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    prismaService = module.get<PrismaService>(PrismaService);
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resendOtp', () => {
    it('should throw NotFoundException if user is not found', async () => {
      jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue(null);

      await expect(
        service.resendOtp({ email: 'unknown@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user email is already verified', async () => {
      jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue({
        id: '1',
        email: 'verified@example.com',
        isEmailVerified: true,
      } as User);

      await expect(
        service.resendOtp({ email: 'verified@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate OTP, upsert in db, send email, and return success message', async () => {
      jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue({
        id: '1',
        email: 'unverified@example.com',
        isEmailVerified: false,
      } as User);
      const upsertSpy = jest
        .spyOn(prismaService.otp, 'upsert')
        .mockResolvedValue({
          id: 'otp-id',
          email: 'unverified@example.com',
          code: '123456',
          expiresAt: new Date(),
          createdAt: new Date(),
        });
      const sendOtpSpy = jest
        .spyOn(mailService, 'sendOtp')
        .mockResolvedValue(undefined);

      const result = await service.resendOtp({
        email: 'unverified@example.com',
      });

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'OTP verification code resent successfully.',
        email: 'unverified@example.com',
      });
    });
  });
});
