import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import * as https from 'https';

type SendPayload = {
  FromEmailAddress: string;
  Destination: { ToAddresses: string[] };
  Content: {
    Simple: {
      Subject: { Data: string; Charset: string };
      Body: {
        Text: { Data: string; Charset: string };
        Html: { Data: string; Charset: string };
      };
    };
  };
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly fromEmail: string;
  private readonly yandexCloudEnabled: boolean;
  private readonly authMethod: 'postbox' | 'iam' | null;
  private readonly sesClient?: SESv2Client;
  private readonly yandexCloudFromEmail?: string;
  private readonly yandexIamToken?: string;
  private readonly mailApiEndpoint?: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('email.yandexCloudFromEmail') ??
      'noreply@iwent.ru';

    const yandexCloudFromEmail = this.configService.get<string>('email.yandexCloudFromEmail');
    const yandexCloudAccessKeyId = this.configService.get<string>('email.yandexCloudAccessKeyId');
    const yandexCloudSecretAccessKey = this.configService.get<string>('email.yandexCloudSecretAccessKey');
    const yandexCloudApiEndpoint = this.configService.get<string>('email.yandexCloudApiEndpoint') || 'https://postbox.cloud.yandex.net';
    const yandexIamToken = this.configService.get<string>('email.yandexCloudIamToken');
    this.mailApiEndpoint = this.configService.get<string>('email.yandexCloudMailApiEndpoint') || 'https://mail-api.cloud.yandex.net';

    this.yandexCloudFromEmail = yandexCloudFromEmail ?? undefined;
    this.yandexIamToken = yandexIamToken ?? undefined;
    this.authMethod = null;

    if (yandexCloudAccessKeyId && yandexCloudSecretAccessKey && yandexCloudFromEmail) {
      this.sesClient = new SESv2Client({
        region: 'ru-central1',
        endpoint: yandexCloudApiEndpoint,
        credentials: {
          accessKeyId: yandexCloudAccessKeyId,
          secretAccessKey: yandexCloudSecretAccessKey,
        },
      });
      this.yandexCloudEnabled = true;
      this.authMethod = 'postbox';
      this.logger.log(`✅ Yandex Cloud Email (Postbox) enabled, from: ${yandexCloudFromEmail}`);
    } else if (yandexIamToken && yandexCloudFromEmail) {
      this.yandexCloudEnabled = true;
      this.authMethod = 'iam';
      this.logger.log(`✅ Yandex Cloud Email (Mail API + IAM) enabled, from: ${yandexCloudFromEmail}`);
    } else {
      this.yandexCloudEnabled = false;
      this.logger.warn(
        `❌ Yandex Cloud Email is not configured. Set either: (1) YANDEX_CLOUD_ACCESS_KEY_ID, YANDEX_CLOUD_SECRET_ACCESS_KEY, YANDEX_CLOUD_FROM_EMAIL for Postbox, or (2) YANDEX_IAM_TOKEN and YANDEX_CLOUD_FROM_EMAIL for Mail API (see docs/EMAIL_VERIFICATION_SETUP.md).`,
      );
    }
  }

  isEnabled() {
    return this.yandexCloudEnabled;
  }

  getAuthMethod(): 'postbox' | 'iam' | null {
    return this.authMethod;
  }

  private buildSendPayload(email: string, subject: string, html: string, text: string): SendPayload {
    return {
      FromEmailAddress: this.yandexCloudFromEmail!,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
        },
      },
    };
  }

  private async sendViaPostbox(email: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.sesClient || !this.yandexCloudFromEmail) {
      throw new Error('Yandex Cloud Postbox is not configured');
    }
    const command = new SendEmailCommand(this.buildSendPayload(email, subject, html, text));
    const response = await this.sesClient.send(command);
    this.logger.log(`✅ Yandex Postbox email sent. Message ID: ${response.MessageId || 'N/A'}`);
  }

  private sendViaMailApi(email: string, subject: string, html: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.yandexIamToken || !this.yandexCloudFromEmail || !this.mailApiEndpoint) {
        reject(new Error('Yandex Cloud Mail API (IAM) is not configured'));
        return;
      }
      const url = new URL(this.mailApiEndpoint);
      const basePath = (url.pathname === '' || url.pathname === '/') ? '' : url.pathname.replace(/\/$/, '');
      const path = `${basePath}/v2/email/outbound-emails`.replace(/\/\/+/g, '/') || '/v2/email/outbound-emails';
      const body = JSON.stringify(this.buildSendPayload(email, subject, html, text));
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: path.startsWith('/') ? path : `/${path}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.yandexIamToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            this.logger.log(`✅ Yandex Mail API email sent to ${email}`);
            resolve();
          } else {
            const err = new Error(`Yandex Mail API error: ${res.statusCode} ${data}`);
            this.logger.error(`[MailerService] ${err.message}`);
            reject(err);
          }
        });
      });
      req.on('error', (err) => {
        this.logger.error(`[MailerService] Mail API request error: ${err.message}`);
        reject(err);
      });
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Yandex Mail API request timeout'));
      });
      req.write(body, 'utf8');
      req.end();
    });
  }

  private async sendViaYandexCloud(email: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.yandexCloudEnabled || !this.yandexCloudFromEmail) {
      throw new Error('Yandex Cloud Email is not configured');
    }
    this.logger.log(`[MailerService] Sending to ${email} via ${this.authMethod === 'postbox' ? 'Postbox' : 'Mail API (IAM)'}`);
    if (this.authMethod === 'postbox') {
      await this.sendViaPostbox(email, subject, html, text);
    } else {
      await this.sendViaMailApi(email, subject, html, text);
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    this.logger.log(`📧 sendVerificationEmail called: email=${email}, token length=${token.length}`);
    if (!this.isEnabled()) {
      const errorMsg = `Email service is not configured. Cannot send verification email to ${email}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    /**
     * Только код, без ссылок, и текст по-английски.
     *
     * Подтверждение — это шесть цифр, которые человек вводит в приложении
     * (см. OtpInput). Ссылки в письме были лишними с самого перехода на код:
     * одна вела на бэкенд, вторая — на EMAIL_VERIFICATION_REDIRECT_URL,
     * который на проде так и остался localhost:8081, то есть в письме живому
     * пользователю лежал заведомо нерабочий адрес. Срок жизни кода — 15 минут
     * (AuthService.OTP_TTL_MS), а в письме почему-то были обещаны сутки.
     */
    const htmlContent = `
      <p>Hello!</p>
      <p>Thanks for signing up. Enter this code in the app to confirm your email address:</p>
      <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; background-color: #f5f5f5; padding: 16px 20px; border-radius: 8px; display: inline-block;">${token}</p>
      <p>The code is valid for 15 minutes.</p>
      <p style="color: #666; font-size: 13px;">If you did not sign up for iWent, just ignore this email.</p>
    `;
    const textContent = `Hello!\n\nThanks for signing up. Enter this code in the app to confirm your email address:\n\n${token}\n\nThe code is valid for 15 minutes.\n\nIf you did not sign up for iWent, just ignore this email.`;
    try {
      await this.sendViaYandexCloud(email, 'Confirm your email address', htmlContent, textContent);
      this.logger.log(`✅ Verification email sent to ${email}`);
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
    // Тоже только код: с 06.09.2026 сброс пароля работает по шести цифрам,
    // которые вводятся в приложении, а не по ссылке с длинным токеном.
    const htmlContent = `
      <p>Hello!</p>
      <p>We received a request to reset your iWent password. Enter this code in the app to set a new one:</p>
      <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; background-color: #f5f5f5; padding: 16px 20px; border-radius: 8px; display: inline-block;">${token}</p>
      <p>The code is valid for 15 minutes.</p>
      <p style="color: #666; font-size: 13px;">If you did not request a password reset, just ignore this email — your password stays unchanged.</p>
    `;
    const textContent = `Hello!\n\nWe received a request to reset your iWent password. Enter this code in the app to set a new one:\n\n${token}\n\nThe code is valid for 15 minutes.\n\nIf you did not request a password reset, just ignore this email - your password stays unchanged.`;
    try {
      await this.sendViaYandexCloud(email, 'Reset your password', htmlContent, textContent);
      this.logger.log(`✅ Password reset email sent to ${email}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to send password reset email to ${email}:`, error?.message || error);
      throw error;
    }
  }
}
