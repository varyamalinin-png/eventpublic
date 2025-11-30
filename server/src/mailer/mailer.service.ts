import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly fromEmail: string;
  private readonly backendBaseUrl: string;
  private readonly verificationRedirectUrl: string;
  private readonly resetRedirectUrl: string;
  private readonly yandexCloudEnabled: boolean;
  private readonly yandexCloudIamToken?: string;
  private readonly yandexCloudApiEndpoint: string;
  private readonly yandexCloudFromEmail?: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('email.yandexCloudFromEmail') ??
      'noreply@iventapp.ru';
    this.backendBaseUrl =
      this.configService.get<string>('app.backendBaseUrl') ?? 'http://localhost:4000';
    this.verificationRedirectUrl =
      this.configService.get<string>('email.verificationRedirectUrl') ??
      'https://example.com/verify-email';
    this.resetRedirectUrl =
      this.configService.get<string>('email.passwordResetRedirectUrl') ??
      'https://example.com/reset-password';

    // Проверяем Yandex Cloud Email API
    const yandexCloudIamToken = this.configService.get<string>('email.yandexCloudIamToken');
    const yandexCloudFromEmail = this.configService.get<string>('email.yandexCloudFromEmail');
    this.yandexCloudApiEndpoint = this.configService.get<string>('email.yandexCloudApiEndpoint') || 'https://mail-api.cloud.yandex.net';
    
    if (yandexCloudIamToken && yandexCloudFromEmail) {
      this.yandexCloudIamToken = yandexCloudIamToken;
      this.yandexCloudFromEmail = yandexCloudFromEmail;
      this.yandexCloudEnabled = true;
      this.logger.log(`✅ Yandex Cloud Email API enabled (from: ${yandexCloudFromEmail})`);
    } else {
      this.yandexCloudEnabled = false;
      this.logger.error(`❌ Yandex Cloud Email API is not configured. Emails will not be sent.`);
    }
  }

  isEnabled() {
    return this.yandexCloudEnabled;
  }

  private async sendViaYandexCloud(email: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.yandexCloudEnabled || !this.yandexCloudIamToken || !this.yandexCloudFromEmail) {
      throw new Error('Yandex Cloud Email API is not configured');
    }

    const yandexCloudUrl = `${this.yandexCloudApiEndpoint}/v2/email/outbound-emails`;
    const url = new URL(yandexCloudUrl);

    const requestBody = {
      FromEmailAddress: this.yandexCloudFromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
          },
        },
      },
    };

    this.logger.log(`[MailerService] ✅ Using Yandex Cloud Email API to send email to ${email}`);
    this.logger.log(`[MailerService] URL: ${yandexCloudUrl}`);
    this.logger.log(`[MailerService] From: ${this.yandexCloudFromEmail}, To: ${email}`);

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.yandexCloudIamToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              this.logger.log(`✅ Yandex Cloud email sent. Message ID: ${result.MessageId || 'N/A'}`);
              resolve();
            } catch (parseError) {
              this.logger.error(`[MailerService] ❌ Failed to parse response: ${data}`);
              reject(new Error(`Failed to parse Yandex Cloud API response: ${data}`));
            }
          } else {
            let errorMessage = `Yandex Cloud API error: ${res.statusCode} ${res.statusMessage || 'Unknown'}`;
            
            try {
              const errorJson = JSON.parse(data);
              errorMessage += ` - ${errorJson.message || errorJson.Code || data}`;
            } catch {
              errorMessage += ` - ${data}`;
            }
            
            this.logger.error(`[MailerService] ❌ Yandex Cloud error: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        });
      });

      req.on('error', (error: any) => {
        this.logger.error(`[MailerService] ❌ Yandex Cloud network error: ${error.message}`);
        this.logger.error(`[MailerService] Error code: ${error.code}`);
        this.logger.error(`[MailerService] Error details:`, error);
        
        // Детальная диагностика DNS ошибок
        if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
          const detailedError = `DNS resolution failed for ${url.hostname}. This might be due to network restrictions on Railway. Possible solutions:
1. Check if Railway region allows access to Yandex Cloud domains
2. Consider using a different email service provider
3. Contact Railway support about DNS resolution for .yandex.net domains`;
          this.logger.error(`[MailerService] ${detailedError}`);
          reject(new Error(`DNS resolution failed: Cannot resolve ${url.hostname}. Railway may block access to Yandex Cloud domains. Please check network settings or use alternative email service.`));
        } else {
          reject(new Error(`Network error: Unable to connect to Yandex Cloud API. ${error.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const timeoutError = new Error('Yandex Cloud API request timeout');
        this.logger.error(`[MailerService] ❌ Yandex Cloud error: ${timeoutError.message}`);
        reject(timeoutError);
      });

      req.write(postData);
      req.end();
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    this.logger.log(`📧 sendVerificationEmail called: email=${email}, token length=${token.length}`);
    
    if (!this.isEnabled()) {
      const errorMsg = `Email service is not configured. Cannot send verification email to ${email}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const verifyLink = `${this.backendBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    const callToActionLink = `${this.verificationRedirectUrl}?token=${encodeURIComponent(token)}`;
    
    this.logger.log(`[MailerService] verifyLink: ${verifyLink}`);
    this.logger.log(`[MailerService] callToActionLink: ${callToActionLink}`);
    this.logger.log(`[MailerService] fromEmail: ${this.fromEmail}`);

    const htmlContent = `
      <p>Здравствуйте!</p>
      <p>Спасибо за регистрацию. Пожалуйста, подтвердите ваш e-mail, перейдя по ссылке:</p>
      <p><a href="${verifyLink}">Подтвердить e-mail</a></p>
      <p>Если вы открываете письмо на телефоне, можно использовать альтернативную ссылку:</p>
      <p><a href="${callToActionLink}">${callToActionLink}</a></p>
      <p>Или скопируйте токен и вставьте его в приложении:</p>
      <p style="font-family: monospace; font-size: 14px; background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${token}</p>
      <p>Ссылка действительна 24 часа.</p>
    `;

    const textContent = `Здравствуйте!\n\nСпасибо за регистрацию. Пожалуйста, подтвердите ваш e-mail, используя токен:\n\n${token}\n\nИли перейдите по ссылке: ${verifyLink}\n\nСсылка действительна 24 часа.`;

    try {
      await this.sendViaYandexCloud(email, 'Подтвердите ваш e-mail', htmlContent, textContent);
      this.logger.log(`✅ Verification email sent via Yandex Cloud Email API to ${email}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to send verification email to ${email}: ${error?.message || error}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    if (!this.isEnabled()) {
      this.logger.error(`Email service is not configured. Cannot send password reset email to ${email}`);
      throw new Error('Email service is not configured');
    }

    const resetLink = `${this.resetRedirectUrl}?token=${encodeURIComponent(token)}`;

    const htmlContent = `
      <p>Здравствуйте!</p>
      <p>Мы получили запрос на сброс пароля. Вы можете задать новый пароль, перейдя по ссылке:</p>
      <p><a href="${resetLink}">Сбросить пароль</a></p>
      <p>Если вы не запрашивали изменение пароля, просто проигнорируйте это письмо.</p>
    `;

    const textContent = `Здравствуйте!\n\nМы получили запрос на сброс пароля. Вы можете задать новый пароль, используя токен:\n\n${token}\n\nИли перейдите по ссылке: ${resetLink}\n\nЕсли вы не запрашивали изменение пароля, просто проигнорируйте это письмо.`;

    try {
      await this.sendViaYandexCloud(email, 'Сброс пароля', htmlContent, textContent);
      this.logger.log(`✅ Password reset email sent via Yandex Cloud Email API to ${email}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to send password reset email to ${email}:`, error?.message || error);
      throw error;
    }
  }
}

