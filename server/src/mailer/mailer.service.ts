import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly fromEmail: string;
  private readonly backendBaseUrl: string;
  private readonly verificationRedirectUrl: string;
  private readonly resetRedirectUrl: string;
  private readonly yandexCloudEnabled: boolean;
  private readonly sesClient?: SESv2Client;
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

    // Проверяем Yandex Cloud Email API (используем статический ключ доступа)
    const yandexCloudAccessKeyId = this.configService.get<string>('email.yandexCloudAccessKeyId');
    const yandexCloudSecretAccessKey = this.configService.get<string>('email.yandexCloudSecretAccessKey');
    const yandexCloudFromEmail = this.configService.get<string>('email.yandexCloudFromEmail');
    const yandexCloudApiEndpoint = this.configService.get<string>('email.yandexCloudApiEndpoint') || 'https://postbox.cloud.yandex.net';
    
    if (yandexCloudAccessKeyId && yandexCloudSecretAccessKey && yandexCloudFromEmail) {
      this.yandexCloudFromEmail = yandexCloudFromEmail;
      
      // Создаем AWS SESv2 клиент с кастомным endpoint для Yandex Cloud Postbox
      this.sesClient = new SESv2Client({
        region: 'ru-central1',
        endpoint: yandexCloudApiEndpoint,
        credentials: {
          accessKeyId: yandexCloudAccessKeyId,
          secretAccessKey: yandexCloudSecretAccessKey,
        },
      });
      
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
    if (!this.yandexCloudEnabled || !this.sesClient || !this.yandexCloudFromEmail) {
      throw new Error('Yandex Cloud Email API is not configured');
    }

    this.logger.log(`[MailerService] ✅ Using Yandex Cloud Email API (AWS SDK) to send email to ${email}`);
    this.logger.log(`[MailerService] From: ${this.yandexCloudFromEmail}, To: ${email}`);

    try {
      const command = new SendEmailCommand({
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
      });

      const response = await this.sesClient.send(command);
      this.logger.log(`✅ Yandex Cloud email sent. Message ID: ${response.MessageId || 'N/A'}`);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      this.logger.error(`[MailerService] ❌ Yandex Cloud error: ${errorMessage}`);
      this.logger.error(`[MailerService] Error details:`, error);
      throw new Error(`Yandex Cloud API error: ${errorMessage}`);
    }
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

