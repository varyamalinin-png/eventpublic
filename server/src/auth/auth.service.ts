import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { MailerService } from '../mailer/mailer.service';
import { randomBytes } from 'crypto';
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
    console.log(`[AuthService] register called for email: ${dto.email}, username: ${dto.username}`);
    const [existingEmail, existingUsername] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      this.usersService.findByUsername(dto.username),
    ]);

    if (existingEmail) {
      console.log(`[AuthService] Email already registered: ${dto.email}, existing user id: ${existingEmail.id}, emailVerified: ${existingEmail.emailVerified}`);
      throw new BadRequestException('Email already registered');
    }
    if (existingUsername) {
      console.log(`[AuthService] Username already taken: ${dto.username}`);
      throw new BadRequestException('Username already taken');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createUser({
      email: dto.email,
      username: dto.username,
      passwordHash,
      name: dto.name,
      accountType: dto.accountType,
      emailVerified: false,
    });

    // КРИТИЧЕСКИ ВАЖНО: Всегда требуем подтверждение email
    // Если mailer не настроен, выбрасываем ошибку
    if (!this.mailer.isEnabled()) {
      throw new BadRequestException('Email service is not configured. Please contact support.');
    }

    // Создаем токен верификации и отправляем письмо
    const token = await this.createEmailVerificationToken(user.id);
    try {
      await this.mailer.sendVerificationEmail(user.email, token);
    } catch (error: any) {
      // Логируем ошибку отправки письма, но не прерываем регистрацию
      // Пользователь может запросить повторную отправку письма позже
      console.error('[AuthService] Failed to send verification email:', error?.message || error);
      throw new BadRequestException('Failed to send verification email. Please try again later or contact support.');
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
      message: 'Registration successful. Please check your inbox and verify your email address to complete registration.',
    };
  }

  async validateCredentials(email: string, password: string) {
    console.log(`[AuthService] validateCredentials called for email: ${email}`);
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      console.log(`[AuthService] User not found for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    
    console.log(`[AuthService] User found: id=${user.id}, emailVerified=${user.emailVerified}, hasPasswordHash=${!!user.passwordHash}`);
    console.log(`[AuthService] 🔍 DEBUG: emailVerified type: ${typeof user.emailVerified}, value: ${JSON.stringify(user.emailVerified)}`);
    console.log(`[AuthService] 🔍 DEBUG: emailVerified === true: ${user.emailVerified === true}`);
    console.log(`[AuthService] 🔍 DEBUG: emailVerified === false: ${user.emailVerified === false}`);
    console.log(`[AuthService] 🔍 DEBUG: !user.emailVerified: ${!user.emailVerified}`);
    
    if (!user.passwordHash) {
      console.log(`[AuthService] User has no password hash for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    console.log(`[AuthService] Password verification result: ${isValid}`);
    
    if (!isValid) {
      console.log(`[AuthService] Invalid password for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // КРИТИЧЕСКИ ВАЖНО: Проверяем подтверждение email перед входом
    // Если email не подтвержден, автоматически отправляем токен верификации
    console.log(`[AuthService] 🔍 Checking email verification: emailVerified = ${user.emailVerified}`);
    if (!user.emailVerified) {
      console.log(`[AuthService] ⚠️ Email NOT verified - entering verification flow`);
      console.log(`[AuthService] Email not verified for user: ${user.id}, email: ${email}, sending verification token automatically`);
      
      // Автоматически отправляем токен верификации
      const mailerEnabled = this.mailer.isEnabled();
      console.log(`[AuthService] Mailer enabled check: ${mailerEnabled}`);
      
      // Отправляем письмо асинхронно (не блокируем вход)
      if (mailerEnabled) {
        // НЕ ждем отправки письма - отправляем в фоне, чтобы не блокировать вход
        this.createEmailVerificationToken(user.id)
          .then(token => {
            console.log(`[AuthService] ✅ Token created for user ${user.id}, sending email in background...`);
            // Отправляем письмо асинхронно, не ждем результата
            this.mailer.sendVerificationEmail(user.email, token)
              .then(() => {
                console.log(`[AuthService] ✅ Verification email sent to ${user.email}`);
                this.logger.log(`✅ Verification email sent to ${user.email}`);
              })
              .catch((error: any) => {
                console.error(`[AuthService] ❌ Failed to send verification email:`, error?.message || error);
                this.logger.error(`❌ Failed to send verification email: ${error?.message || error}`);
              });
          })
          .catch((error: any) => {
            console.error(`[AuthService] ❌ Failed to create verification token:`, error?.message || error);
            this.logger.error(`❌ Failed to create verification token: ${error?.message || error}`);
          });
      }
      
      // Всегда блокируем вход, если email не верифицирован (но письмо отправляется в фоне)
      throw new UnauthorizedException('Email address is not verified. A verification email has been sent to your inbox. Please check your email and verify your address before logging in.');
    }

    console.log(`[AuthService] ✅ Credentials validated successfully for user: ${user.id}, email: ${email}`);
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

  async verifyEmailToken(token: string): Promise<SanitizedUser> {
    console.log(`[AuthService] verifyEmailToken called, token length: ${token?.length || 0}, token: ${token?.substring(0, 10)}...`);
    
    if (!token || !token.trim()) {
      console.error(`[AuthService] Token is empty or invalid`);
      throw new BadRequestException('Verification token is required');
    }

    const trimmedToken = token.trim();
    console.log(`[AuthService] Searching for token in database...`);
    
    const record = await this.prisma.emailVerificationToken.findUnique({ 
      where: { token: trimmedToken } 
    });
    
    console.log(`[AuthService] Token record found:`, record ? `userId=${record.userId}, expiresAt=${record.expiresAt}` : 'not found');
    
    if (!record) {
      console.error(`[AuthService] Token not found in database. Token: ${trimmedToken.substring(0, 20)}...`);
      
      // Попробуем найти все активные токены для отладки
      const allActiveTokens = await this.prisma.emailVerificationToken.findMany({
        where: {
          expiresAt: {
            gt: new Date(), // Активные токены
          },
        },
        take: 5,
      });
      
      console.log(`[AuthService] Found ${allActiveTokens.length} active tokens in database:`);
      allActiveTokens.forEach((t, idx) => {
        console.log(`[AuthService] Token ${idx + 1}: userId=${t.userId}, token=${t.token.substring(0, 20)}..., expiresAt=${t.expiresAt}`);
      });
      
      // НЕ используем частичное совпадение токенов - это небезопасно
      // Токен должен совпадать полностью для безопасности
      // console.log(`[AuthService] Token not found. Partial matching disabled for security.`);
      
      throw new BadRequestException('Verification token is invalid or expired');
    }
    
    const now = new Date();
    console.log(`[AuthService] Checking expiration. Token expires at: ${record.expiresAt}, Current time: ${now}, Is expired: ${record.expiresAt < now}`);
    
    if (record.expiresAt < now) {
      console.error(`[AuthService] Token expired. Expires at: ${record.expiresAt}, Current time: ${now}`);
      throw new BadRequestException('Verification token is invalid or expired');
    }

    console.log(`[AuthService] Token is valid, deleting all tokens for user ${record.userId} and marking email as verified`);
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } });
    
    const verifiedUser = await this.usersService.markEmailVerified(record.userId);
    if (!verifiedUser) {
      console.error(`[AuthService] Failed to mark email as verified - user not found: ${record.userId}`);
      throw new BadRequestException('User not found');
    }
    
    console.log(`[AuthService] ✅ Email verified successfully for user ${record.userId}`);
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
    console.log(`[AuthService] resendVerificationEmail called for: ${email}`);
    
    const user = await this.usersService.findByEmail(email);
    console.log(`[AuthService] User found:`, user ? `id=${user.id}, emailVerified=${user.emailVerified}` : 'not found');
    
    if (!user) {
      // Пользователь не найден - возможно, он еще не зарегистрирован
      // Проверяем, настроен ли mailer, чтобы дать более точное сообщение
      const mailerEnabled = this.mailer.isEnabled();
      console.log(`[AuthService] User not found, mailer enabled: ${mailerEnabled}`);
      
      if (!mailerEnabled) {
        throw new BadRequestException('Email service is not configured. Please contact support.');
      }
      
      // Возвращаем сообщение, которое не раскрывает, существует ли email
      // но дает понять, что если email не зарегистрирован, письмо не придет
      return { 
        success: true, 
        message: 'If this email is registered and not yet verified, a verification link has been sent. Please check your inbox. If you haven\'t registered yet, please create an account first.' 
      };
    }

    // КРИТИЧЕСКИ ВАЖНО: Отправляем токен ВСЕГДА, даже если email уже подтвержден
    // Это нужно, если пользователь забыл пароль и не может войти
    // Токен можно использовать для сброса пароля или повторного входа
    if (user.emailVerified) {
      console.log(`[AuthService] ⚠️ User email already verified for user: ${user.id}, email: ${user.email}`);
      console.log(`[AuthService] ⚠️ BUT sending verification token anyway (user may need password reset or token for login)`);
    } else {
      console.log(`[AuthService] User email NOT verified for user: ${user.id}, email: ${user.email}`);
    }
    
    const mailerEnabled = this.mailer.isEnabled();
    console.log(`[AuthService] Mailer enabled: ${mailerEnabled}`);
    
    if (!mailerEnabled) {
      console.error(`[AuthService] Mailer is not enabled, throwing error`);
      throw new BadRequestException('Email service is not configured. Please contact support.');
    }

    console.log(`[AuthService] Creating verification token for user ${user.id} (emailVerified=${user.emailVerified})`);
    const token = await this.createEmailVerificationToken(user.id);
    console.log(`[AuthService] ✅ Token created successfully, length: ${token.length}, first 20 chars: ${token.substring(0, 20)}...`);
    
    try {
      console.log(`[AuthService] 📧 Calling mailer.sendVerificationEmail(${user.email}, token)...`);
      await this.mailer.sendVerificationEmail(user.email, token);
      console.log(`[AuthService] ✅✅✅ Verification email sent successfully to ${user.email} (emailVerified=${user.emailVerified})`);
      this.logger.log(`✅ Verification email sent to ${user.email} (emailVerified=${user.emailVerified})`);
      return { 
        success: true, 
        message: user.emailVerified 
          ? 'Verification email sent. Please check your inbox (including spam folder). You can use this token if you need to reset your password or verify your account again.' 
          : 'Verification email sent. Please check your inbox (including spam folder) and verify your email address.'
      };
    } catch (error: any) {
      console.error(`[AuthService] ❌❌❌ Failed to send verification email to ${user.email}:`, error?.message || error);
      console.error(`[AuthService] Error code: ${error?.code}`);
      console.error(`[AuthService] Error command: ${error?.command}`);
      console.error(`[AuthService] Error response: ${error?.response}`);
      console.error(`[AuthService] Error stack:`, error?.stack);
      this.logger.error(`❌ Failed to send verification email to ${user.email}: ${error?.message || error}`);
      
      // Более детальное сообщение об ошибке
      let errorMessage = 'Failed to send verification email. ';
      if (error?.code === 'EAUTH') {
        errorMessage += 'SMTP authentication failed. Please check your email credentials.';
      } else if (error?.code === 'ECONNECTION') {
        errorMessage += 'Cannot connect to SMTP server. Please check your SMTP settings.';
      } else if (error?.response) {
        errorMessage += `SMTP server error: ${error.response}`;
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

  private async createEmailVerificationToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    console.log(`[AuthService] Creating verification token for user ${userId}, token length: ${token.length}, token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`);
    
    // НЕ удаляем старые токены - они могут быть еще активны
    // Пользователь может запросить повторную отправку, но старый токен все еще должен работать
    // await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    
    console.log(`[AuthService] Token created and saved to database for user ${userId}`);
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
