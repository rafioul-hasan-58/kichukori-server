import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            resendOtp: jest.fn(),
            register: jest.fn(),
            verifyOtp: jest.fn(),
            login: jest.fn(),
            refreshTokens: jest.fn(),
            forgotPassword: jest.fn(),
            verifyResetOtp: jest.fn(),
            resetPassword: jest.fn(),
            authenticateGoogleToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {},
        },
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('resendOtp', () => {
    it('should call authService.resendOtp with correct dto', async () => {
      const dto = { email: 'user@example.com' };
      const expectedResponse = {
        message: 'OTP verification code resent successfully.',
        email: 'user@example.com',
      };
      const resendSpy = jest
        .spyOn(authService, 'resendOtp')
        .mockResolvedValue(expectedResponse);

      const result = await controller.resendOtp(dto);

      expect(resendSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
