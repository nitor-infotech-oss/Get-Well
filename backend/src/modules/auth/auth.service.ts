import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/** Default dev user so login works out of the box (dev only). */
const DEV_SEED_EMAIL = 'nurse1@rhythmx.dev';
const DEV_SEED_PASSWORD = 'Test1234!';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV !== 'development') return;

    const existing = await this.userRepository.findOne({
      where: { email: DEV_SEED_EMAIL },
    });

    const hashed = await bcrypt.hash(DEV_SEED_PASSWORD, 12);

    if (!existing) {
      await this.userRepository.save(
        this.userRepository.create({
          email: DEV_SEED_EMAIL,
          password: hashed,
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'nurse',
          displayName: 'Jane Doe',
        }),
      );
      this.logger.log('Dev seed: created default user (nurse1@rhythmx.dev)');
    } else {
      existing.password = hashed;
      await this.userRepository.save(existing);
      this.logger.log('Dev seed: reset default user password to Test1234!');
    }
  }

  /**
   * Register a new user (nurse/admin).
   */
  async register(dto: RegisterDto): Promise<{ accessToken: string; user: Partial<User> }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role || 'nurse',
      displayName: `${dto.firstName} ${dto.lastName}`,
      employeeId: dto.employeeId,
    });

    await this.userRepository.save(user);

    this.logger.log({
      message: 'User registered',
      userId: user.id,
      role: user.role,
      // No email logged — PII concern
    });

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }

  /**
   * Authenticate user and return JWT.
   */
  async login(dto: LoginDto): Promise<{ accessToken: string; user: Partial<User> }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log({
      message: 'User logged in',
      userId: user.id,
    });

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }

  /**
   * Get user profile by ID.
   */
  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      displayName: user.displayName,
      employeeId: user.employeeId,
    };
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}
