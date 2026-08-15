import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { MailerService } from '../mailer/mailer.service';
import { randomBytes, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

type JwtPayload = { sub: string; username: string };

type SanitizedUser = Awaited<ReturnType<UsersService['findById']>>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient?: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    const clientId = this.configService.get<string>('google.clientId');
    const clientSecret = this.configService.get<string>('google.clientSecret');
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId, clientSecret);
    }
  }

  async register(dto: RegisterDto) {
    this.logger.log(`Register called for email: ${dto.email}`);
    const normalizedPhone = dto.phone.replace(/[^\d+]/g, '');

    const [existingEmail, existingUsername, existingPhone] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      this.usersService.findByUsername(dto.username),
      this.prisma.user.findUnique({ where: { phone: normalizedPhone } }),
    ]);

    if (existingEmail) {
      this.logger.debug(`Email already registered: ${dto.email}`);
      throw new BadRequestException('Email already registered');
    }
    if (existingUsername) {
      this.logger.debug(`Username already taken: ${dto.username}`);
      throw new BadRequestException('Username already taken');
    }
    if (existingPhone) {
      throw new BadRequestException('Phone already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createUser({
      email: dto.email,
      username: dto.username,
      // храним в нормализованном виде, иначе «+7 999…» и «+7(999)…» станут разными номерами
      phone: normalizedPhone,
      passwordHash,
      name: dto.name,
      accountType: dto.accountType,
      emailVerified: false,
    });

    // Создаем токен верификации и отправляем письмо при регистрации
    const token = await this.createEmailVerificationToken(user.id);
    let verificationEmailSent = false;
    try {
      await this.mailer.sendVerificationEmail(user.email, token);
      this.logger.log(`✅ Verification email sent to ${user.email} during registration`);
      verificationEmailSent = true;
    } catch (error: any) {
      // Логируем ошибку, но не прерываем регистрацию
      // Пользователь может запросить повторную отправку письма позже
      this.logger.error('[AuthService] Failed to send verification email during registration:', error?.message || error);
      if (!this.mailer.isEnabled()) {
        this.logger.warn('[AuthService] Email service is not configured (YANDEX_CLOUD_* env vars). Set YANDEX_CLOUD_ACCESS_KEY_ID, YANDEX_CLOUD_SECRET_ACCESS_KEY, YANDEX_CLOUD_FROM_EMAIL.');
      }
    }

    // НЕ возвращаем токены до подтверждения email
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        emailVerified: false,
      },
      requiresEmailVerification: true,
      verificationEmailSent,
      message: verificationEmailSent
        ? 'Registration successful. Please check your inbox and verify your email address to complete registration.'
        : 'Registration successful. Verification email could not be sent (email service not configured or error). Use "Resend verification" later or contact support.',
    };
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // КЛАССИЧЕСКАЯ СХЕМА: Проверяем подтверждение email перед входом
    if (!user.emailVerified) {
      this.logger.log(`Email not verified for user: ${user.id}, sending verification email`);
      
      // Создаем токен и отправляем письмо СИНХРОННО
      try {
        const token = await this.createEmailVerificationToken(user.id);
        await this.mailer.sendVerificationEmail(user.email, token);
        this.logger.log(`✅ Verification email sent to ${user.email}`);
      } catch (error: any) {
        this.logger.error(`Failed to send verification email: ${error?.message || error}`);
        // Даже если письмо не отправилось, блокируем вход
      }
      
      throw new UnauthorizedException('Email address is not verified. A verification email has been sent to your inbox. Please check your email and verify your address before logging in.');
    }

    return user;
  }

  async login(user: { id: string; username: string }) {
    const tokens = await this.issueTokens(user.id, user.username);
    const profile = await this.usersService.findById(user.id);
    return { user: profile, ...tokens };
  }

  private async issueTokens(userId: string, username: string) {
    const payload = { sub: userId, username } satisfies JwtPayload;
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('auth.refreshTokenTtl'),
    });

    await this.saveRefreshToken(userId, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const hash = await argon2.hash(token);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hash,
        expiresAt: new Date(
          Date.now() + this.parseTtl(this.configService.get<string>('auth.refreshTokenTtl')),
        ),
      },
    });
  }

  async refreshTokens(userId: string, token: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const matched = await Promise.all(tokens.map((t) => argon2.verify(t.token, token)));
    const hasValid = matched.includes(true);

    if (!hasValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const issued = await this.issueTokens(user.id, user.username);
    return { user, ...issued };
  }

  async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Код проверяется только в паре с email. Раньше искали по глобально уникальному
   * токену — для длинной hex-строки это допустимо, для шести цифр нет: таким кодом
   * можно было бы подтвердить чужой аккаунт.
   */
  async verifyEmailToken(email: string, code: string): Promise<SanitizedUser> {
    if (!code || !code.trim()) {
      throw new BadRequestException('Verification code is required');
    }
    if (!email || !email.trim()) {
      throw new BadRequestException('Email is required');
    }

    // Пользователь может вставить код с пробелами — убираем всё, кроме цифр.
    const normalized = code.replace(/\D/g, '');
    if (normalized.length !== 6) {
      throw new BadRequestException('Verification code is invalid or expired');
    }

    const user = await this.usersService.findByEmail(email.trim());
    // Одно и то же сообщение и для несуществующего адреса, и для неверного кода:
    // иначе по ответу можно перебирать зарегистрированные почты.
    const invalid = () => new BadRequestException('Verification code is invalid or expired');
    if (!user) throw invalid();

    const record = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw invalid();

    if (record.expiresAt < new Date()) {
      await this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      throw invalid();
    }

    if (record.attempts >= AuthService.OTP_MAX_ATTEMPTS) {
      await this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    if (record.token !== normalized) {
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid();
    }

    await this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    const verifiedUser = await this.usersService.markEmailVerified(user.id);
    if (!verifiedUser) {
      throw new BadRequestException('User not found');
    }

    this.logger.log(`Email verified successfully for user ${user.id}`);
    return verifiedUser;
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Avoid leaking whether email exists
      return { success: true };
    }

    const token = await this.createPasswordResetToken(user.id);
    await this.mailer.sendPasswordResetEmail(email, token);
    return { success: true };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      const mailerEnabled = this.mailer.isEnabled();
      if (!mailerEnabled) {
        throw new BadRequestException('Email service is not configured. Please contact support.');
      }
      // Возвращаем сообщение, которое не раскрывает, существует ли email
      return {
        success: true,
        message: 'If this email is registered and not yet verified, a verification link has been sent. Please check your inbox. If you haven\'t registered yet, please create an account first.'
      };
    }

    const mailerEnabled = this.mailer.isEnabled();
    if (!mailerEnabled) {
      throw new BadRequestException('Email service is not configured. Please contact support.');
    }

    // Не чаще раза в две минуты. Возвращаем остаток секунд, чтобы клиент
    // показал таймер, а не просто заблокировал кнопку вслепую.
    const cooldownMs = await this.getResendCooldownMs(user.id);
    if (cooldownMs > 0) {
      throw new BadRequestException({
        message: 'Please wait before requesting a new code',
        retryAfterSeconds: Math.ceil(cooldownMs / 1000),
      });
    }

    const token = await this.createEmailVerificationToken(user.id);

    try {
      await this.mailer.sendVerificationEmail(user.email, token);
      this.logger.log(`Verification email sent to ${user.email}`);
      return {
        success: true,
        message: user.emailVerified
          ? 'Verification email sent. Please check your inbox (including spam folder). You can use this token if you need to reset your password or verify your account again.'
          : 'Verification email sent. Please check your inbox (including spam folder) and verify your email address.'
      };
    } catch (error: any) {
      this.logger.error(`Failed to send verification email to ${user.email}: ${error?.message || error}`);

      let errorMessage = 'Failed to send verification email. ';
      if (error?.message?.includes('Yandex Cloud')) {
        errorMessage += error.message;
      } else if (error?.message?.includes('Network error')) {
        errorMessage += error.message;
      } else {
        errorMessage += error?.message || 'Unknown error';
      }

      throw new BadRequestException(`${errorMessage} Please check your email configuration or contact support.`);
    }
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.usersService.updatePassword(record.userId, passwordHash);
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    return user;
  }

  async loginWithGoogle(idToken: string) {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.get<string>('google.clientId') ?? undefined,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Google token payload is invalid');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? payload.email.split('@')[0];
    const avatarUrl = payload.picture;

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      const existingByEmail = await this.usersService.findByEmail(email);
      if (existingByEmail) {
        user = await this.usersService.linkGoogleAccount(existingByEmail.id, googleId);
      } else {
        const baseUsername = email.split('@')[0];
        const username = await this.usersService.ensureUniqueUsername(baseUsername);
        user = await this.usersService.createUser({
          email,
          username,
          name,
          avatarUrl: avatarUrl ?? undefined,
          googleId,
          emailVerified: true,
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException('Unable to sign in with Google');
    }

    const tokens = await this.issueTokens(user.id, user.username);
    const profile = await this.usersService.findById(user.id);
    return { user: profile, ...tokens };
  }

  // Шесть цифр живут 15 минут. Прежний hex-токен жил сутки — для длинной
  // случайной строки это нормально, для шестизначного кода срок надо резать:
  // чем дольше он валиден, тем больше времени на перебор.
  private static readonly OTP_TTL_MS = 15 * 60 * 1000;
  // Не чаще одного письма в две минуты.
  private static readonly OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
  private static readonly OTP_MAX_ATTEMPTS = 5;

  private generateOtp(): string {
    // randomInt из crypto, а не Math.random: код — секрет.
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Сколько миллисекунд осталось до следующей разрешённой отправки (0 — можно слать). */
  private async getResendCooldownMs(userId: string): Promise<number> {
    const last = await this.prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!last) return 0;
    const elapsed = Date.now() - last.createdAt.getTime();
    return Math.max(0, AuthService.OTP_RESEND_COOLDOWN_MS - elapsed);
  }

  private async createEmailVerificationToken(userId: string) {
    const token = this.generateOtp();

    // Прежние коды гасим: иначе одновременно живут несколько валидных,
    // и счётчик попыток обходится переключением между ними.
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + AuthService.OTP_TTL_MS),
      },
    });

    return token;
  }

  private async createPasswordResetToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return token;
  }

  private parseTtl(ttl: string | undefined): number {
    if (!ttl) return 7 * 24 * 60 * 60 * 1000;
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return parseInt(ttl, 10) * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
      default:
        return value * 24 * 60 * 60 * 1000;
    }
  }
}
