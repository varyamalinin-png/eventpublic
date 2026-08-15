import { Body, Controller, Get, Post, UseGuards, Request, Query, Res, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
    this.logger.log(`Verify email request received`);
    try {
      // Код и email проверяются внутри verifyEmailToken; там же выдаётся
      // единое сообщение для пустого/неверного кода, чтобы не палить причину отказа.
      if (!dto.code || !dto.code.trim() || !dto.email) {
        this.logger.error(`❌ Empty code or email received`);
        throw new BadRequestException('Verification code is required');
      }
      const user = await this.authService.verifyEmailToken(dto.email, dto.code);
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
  async verifyEmailRedirect(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    if (!token || !email) {
      // Ссылки, выписанные до перехода на короткий код, приходят без адреса —
      // подтвердить их уже нечем, пользователю нужен новый код.
      return res.status(400).send('Verification link is invalid or outdated. Request a new code.');
    }
    try {
      await this.authService.verifyEmailToken(email, token);
      // После успешной верификации показываем страницу успеха
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verified</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Email успешно подтверждён!</h1>
            <p>Ваш email адрес был успешно подтверждён. Теперь вы можете закрыть это окно и вернуться в приложение.</p>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Failed</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: #333;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #f5576c; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Ошибка подтверждения</h1>
            <p>Ссылка для подтверждения недействительна или истекла. Пожалуйста, запросите новую ссылку в приложении.</p>
          </div>
        </body>
        </html>
      `);
    }
  }

  @Get('verify')
  async verifyRedirect(
    @Query('status') status: string,
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    // Обработка редиректа после верификации email
    // Если есть токен, обрабатываем его
    if (token && email) {
      try {
        await this.authService.verifyEmailToken(email, token);
        // После успешной верификации редиректим на страницу успеха
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Email Verified</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
              }
              h1 { color: #4CAF50; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Email успешно подтверждён!</h1>
              <p>Ваш email адрес был успешно подтверждён. Теперь вы можете закрыть это окно и вернуться в приложение.</p>
            </div>
          </body>
          </html>
        `);
      } catch (error) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verification Failed</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: #333;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
              }
              h1 { color: #f5576c; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Ошибка подтверждения</h1>
              <p>Ссылка для подтверждения недействительна или истекла. Пожалуйста, запросите новую ссылку в приложении.</p>
            </div>
          </body>
          </html>
        `);
      }
    }
    
    // Если есть только status, показываем соответствующее сообщение
    if (status === 'success') {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verified</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Email успешно подтверждён!</h1>
            <p>Ваш email адрес был успешно подтверждён. Теперь вы можете закрыть это окно и вернуться в приложение.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    if (status === 'error') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Failed</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: #333;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #f5576c; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Ошибка подтверждения</h1>
            <p>Ссылка для подтверждения недействительна или истекла. Пожалуйста, запросите новую ссылку в приложении.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    // Если нет ни token, ни status, возвращаем 404
    return res.status(404).send('Not Found');
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
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
    const fromEmail = this.configService.get<string>('email.yandexCloudFromEmail') || 'noreply@iwent.ru';
    const method = this.mailerService.getAuthMethod?.() === 'postbox' ? 'Yandex Cloud Postbox' : this.mailerService.getAuthMethod?.() === 'iam' ? 'Yandex Cloud Mail API (IAM)' : 'none';
    return {
      enabled: isEnabled,
      method,
      configured: isEnabled,
      fromEmail,
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

}
