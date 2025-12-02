import { Body, Controller, Get, Post, UseGuards, Request, Query, Res, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { UsersService } from '../users/users.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.revokeRefreshTokens(req.user.userId);
    return { success: true };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const payload = await this.authService.verifyRefreshToken(dto.refreshToken);
    return this.authService.refreshTokens(payload.sub, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    this.logger.log(`📧 Verify email request received, token length: ${dto.token?.length || 0}`);
    try {
      const user = await this.authService.verifyEmailToken(dto.token);
      if (!user) {
        this.logger.error(`❌ Email verification returned null user`);
        throw new BadRequestException('Failed to verify email. User not found.');
      }
      this.logger.log(`✅ Email verified successfully for user: ${user.id}`);
      
      // КРИТИЧЕСКИ ВАЖНО: После верификации email автоматически выдаем токены
      // чтобы пользователь мог сразу войти в систему без повторного логина
      const tokens = await this.authService.login({ id: user.id, username: user.username });
      
      return { 
        user: tokens.user, 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: 'Email verified successfully' 
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to verify email:`, error?.message || error);
      throw error;
    }
  }

  @Get('verify-email')
  async verifyEmailRedirect(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.status(400).send('Verification token is required');
    }
    const redirectBase =
      this.configService.get<string>('email.verificationRedirectUrl') ??
      this.configService.get<string>('app.backendBaseUrl');
    try {
      await this.authService.verifyEmailToken(token);
      if (redirectBase) {
        const url = new URL(redirectBase);
        url.searchParams.set('status', 'success');
        return res.redirect(url.toString());
      }
      return res.send('Email verified successfully. You can close this window.');
    } catch (error) {
      if (redirectBase) {
        const url = new URL(redirectBase);
        url.searchParams.set('status', 'error');
        return res.redirect(url.toString());
      }
      return res.status(400).send('Verification link is invalid or expired.');
    }
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: RequestPasswordResetDto) {
    this.logger.log(`📧 Resend verification requested for email: ${dto.email}`);
    try {
      const result = await this.authService.resendVerificationEmail(dto.email);
      this.logger.log(`✅ Resend verification completed for: ${dto.email}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Failed to resend verification for ${dto.email}:`, error?.message || error);
      // Если mailer не настроен, возвращаем более понятную ошибку
      if (error?.message?.includes('not configured') || error?.message?.includes('Email service')) {
        throw new BadRequestException('Email service is not configured on the server. Please contact support or check server configuration.');
      }
      throw error;
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const user = await this.authService.resetPassword(dto.token, dto.password);
    return { user, message: 'Password updated successfully' };
  }

  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Get('email-status')
  async checkEmailStatus() {
    const isEnabled = this.mailerService.isEnabled();
    const fromEmail = this.configService.get<string>('email.yandexCloudFromEmail') || 'noreply@iventapp.ru';
    const yandexCloudEnabled = !!(this.configService.get<string>('email.yandexCloudIamToken') && this.configService.get<string>('email.yandexCloudFromEmail'));
    
    return {
      enabled: isEnabled,
      method: yandexCloudEnabled ? 'Yandex Cloud Email API' : 'none',
      configured: yandexCloudEnabled,
      fromEmail: fromEmail,
    };
  }

  @Post('test-email')
  async testEmail(@Body() dto: { email: string }) {
    this.logger.log(`📧 Test email requested for: ${dto.email}`);
    
    if (!dto.email) {
      throw new BadRequestException('Email is required');
    }

    const isEnabled = this.mailerService.isEnabled();
    if (!isEnabled) {
      throw new BadRequestException('Email service is not configured');
    }

    try {
      // Создаем тестовый токен
      const testToken = 'test-token-' + Date.now();
      
      // Отправляем тестовое письмо
      await this.mailerService.sendVerificationEmail(dto.email, testToken);
      
      return {
        success: true,
        message: `Test email sent successfully to ${dto.email}. Please check your inbox.`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to send test email:`, error?.message || error);
      throw new BadRequestException(`Failed to send test email: ${error?.message || 'Unknown error'}`);
    }
  }

  @Post('temp-verify-user')
  async tempVerifyUser(@Body() body?: { email?: string; id?: string }) {
    // ВРЕМЕННЫЙ endpoint для верификации пользователя
    try {
      const email = body?.email || 'varya.malinina.2003@mail.ru';
      const id = body?.id || 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';

      this.logger.log(`[TempVerify] Verifying user: email=${email}, id=${id}`);

      const result = await this.usersService.verifyUserByEmailOrId(email, id);

      return {
        success: true,
        message: 'User verified successfully',
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`[TempVerify] Error: ${error.message}`);
      throw error;
    }
  }

  @Post('temp-delete-all-users')
  async tempDeleteAllUsers() {
    // ВРЕМЕННЫЙ endpoint для удаления всех пользователей
    try {
      this.logger.log(`[TempDelete] Deleting all users...`);
      const result = await this.usersService.deleteAllUsers();
      return {
        success: true,
        message: 'All users deleted successfully',
        deleted: result.count,
      };
    } catch (error: any) {
      this.logger.error(`[TempDelete] Error: ${error.message}`);
      throw error;
    }
  }
}
