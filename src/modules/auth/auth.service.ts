import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { User } from '../users/user.entity';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  //registration

  async register(dto: RegisterDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ ...dto, password: hashed });
    await this.userRepo.save(user);
    return this.sanitize(user);
  }

  //login

  async login(dto: LoginDto, res: Response) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    this.attachTokens(res, user);
    return this.sanitize(user);
  }

  //Refresh Token

  async refresh(refreshToken: string, res: Response) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.userRepo.findOneOrFail({
        where: { id: payload.sub },
      });
      this.attachTokens(res, user);
      return this.sanitize(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // logout

  logout(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  //profile

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const exists = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (exists && exists.id !== userId)
        throw new ConflictException('Email already in use');
    }
    await this.userRepo.update(userId, dto);
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return this.sanitize(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
    return { message: 'Password updated successfully' };
  }

  // helpers

  private attachTokens(res: Response, user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const cookieOpts = {
      httpOnly: true,
      secure: this.config.get('nodeEnv') === 'production',
    };

    res.cookie(
      'access_token',
      this.jwt.sign(payload, {
        secret: this.config.get('jwt.accessSecret'),
        expiresIn: this.config.get('jwt.accessExpires'),
      }),
      { ...cookieOpts, maxAge: 15 * 60 * 1000 },
    );

    res.cookie(
      'refresh_token',
      this.jwt.sign(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpires'),
      }),
      { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 },
    );
  }

  private sanitize(user: User) {
    const { password: _, ...safe } = user as any;
    return safe;
  }
}
