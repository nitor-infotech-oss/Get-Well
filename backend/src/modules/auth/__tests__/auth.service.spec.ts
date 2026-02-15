import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should register a new user and return JWT', async () => {
      userRepo.findOne.mockResolvedValue(null); // No existing user
      userRepo.create.mockReturnValue({
        id: 'user-001',
        email: 'nurse@hospital.org',
        firstName: 'Joy',
        lastName: 'Smith',
        role: 'nurse',
        displayName: 'Joy Smith',
      });
      userRepo.save.mockResolvedValue({
        id: 'user-001',
        email: 'nurse@hospital.org',
        firstName: 'Joy',
        lastName: 'Smith',
        role: 'nurse',
        displayName: 'Joy Smith',
      });

      const result = await service.register({
        email: 'nurse@hospital.org',
        password: 'SecureP@ss123',
        firstName: 'Joy',
        lastName: 'Smith',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('nurse@hospital.org');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'existing@hospital.org',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return JWT for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 12);

      userRepo.findOne.mockResolvedValue({
        id: 'user-001',
        email: 'nurse@hospital.org',
        password: hashedPassword,
        firstName: 'Joy',
        lastName: 'Smith',
        role: 'nurse',
        displayName: 'Joy Smith',
        isActive: true,
      });

      const result = await service.login({
        email: 'nurse@hospital.org',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-001',
          email: 'nurse@hospital.org',
          role: 'nurse',
        }),
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 12);

      userRepo.findOne.mockResolvedValue({
        id: 'user-001',
        password: hashedPassword,
        isActive: true,
      });

      await expect(
        service.login({
          email: 'nurse@hospital.org',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@hospital.org',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
