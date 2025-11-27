import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly fromEmail: string;
  private readonly backendBaseUrl: string;
  private readonly verificationRedirectUrl: string;
  private readonly resetRedirectUrl: string;
  private readonly sendgridEnabled: boolean;
  private readonly resendEnabled: boolean;
  private readonly smtpEnabled: boolean;
  private readonly transporter?: nodemailer.Transporter;
  private readonly resend?: Resend;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('email.fromEmail') ?? 
      this.configService.get<string>('email.smtpUser') ??
      'no-reply@example.com';
    this.backendBaseUrl =
      this.configService.get<string>('app.backendBaseUrl') ?? 'http://localhost:4000';
    this.verificationRedirectUrl =
      this.configService.get<string>('email.verificationRedirectUrl') ??
      'https://example.com/verify-email';
    this.resetRedirectUrl =
      this.configService.get<string>('email.passwordResetRedirectUrl') ??
      'https://example.com/reset-password';

    // Проверяем SendGrid
    const sendgridApiKey = this.configService.get<string>('email.sendgridApiKey');
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      this.sendgridEnabled = true;
      this.logger.log('SendGrid email service enabled');
    } else {
      this.sendgridEnabled = false;
    }

    // Проверяем Resend
    const resendApiKey = this.configService.get<string>('email.resendApiKey');
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.resendEnabled = true;
      this.logger.log('Resend email service enabled');
    } else {
      this.resendEnabled = false;
    }

    // Проверяем SMTP
    const smtpHost = this.configService.get<string>('email.smtpHost');
    const smtpPort = this.configService.get<number>('email.smtpPort');
    const smtpUser = this.configService.get<string>('email.smtpUser');
    const smtpPassword = this.configService.get<string>('email.smtpPassword');
    const smtpSecure = this.configService.get<boolean>('email.smtpSecure', true);

    this.logger.log(`SMTP config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser ? '***' : 'not set'}, password=${smtpPassword ? '***' : 'not set'}, secure=${smtpSecure}`);
    
    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true для 465, false для других портов
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        // Добавляем TLS опции для Gmail
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.smtpEnabled = true;
      this.logger.log(`✅ SMTP email service enabled (${smtpHost}:${smtpPort})`);
      
      // Проверяем соединение при старте (неблокирующе, в фоне)
      // Не ждем результата, чтобы не блокировать запуск приложения
      // Railway может блокировать исходящие соединения для verify, но отправка писем может работать
      this.transporter.verify((error, success) => {
        if (error) {
          this.logger.warn(`⚠️ SMTP connection verification failed (this is OK, emails may still work): ${error.message}`);
        } else {
          this.logger.log(`✅ SMTP connection verified successfully`);
        }
      });
    } else {
      this.smtpEnabled = false;
      if (!this.sendgridEnabled && !this.resendEnabled) {
        this.logger.warn('⚠️ Neither SendGrid, Resend nor SMTP is configured. Emails will not be sent.');
      }
    }
  }

  isEnabled() {
    return this.sendgridEnabled || this.resendEnabled || this.smtpEnabled;
  }

  async sendVerificationEmail(email: string, token: string) {
    console.log(`[MailerService] sendVerificationEmail called: email=${email}, token length=${token?.length || 0}`);
    this.logger.log(`📧 sendVerificationEmail called for: ${email}`);
    
    if (!this.isEnabled()) {
      const errorMsg = `Skipping verification email for ${email} - mailer is not enabled`;
      console.error(`[MailerService] ${errorMsg}`);
      this.logger.error(errorMsg);
      return;
    }

    console.log(`[MailerService] Mailer is enabled, preparing email content`);
    const verifyLink = `${this.backendBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    const callToActionLink = `${this.verificationRedirectUrl}?token=${encodeURIComponent(token)}`;
    
    console.log(`[MailerService] verifyLink: ${verifyLink}`);
    console.log(`[MailerService] callToActionLink: ${callToActionLink}`);
    console.log(`[MailerService] fromEmail: ${this.fromEmail}`);

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

    try {
      this.logger.log(`📧 Sending verification email to ${email}...`);
      
      if (this.resendEnabled && this.resend) {
        this.logger.log(`Using Resend to send email to ${email}`);
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject: 'Подтвердите ваш e-mail',
          html: htmlContent,
        });
        this.logger.log(`✅ Verification email sent via Resend to ${email}. ID: ${result.data?.id}`);
      } else if (this.sendgridEnabled) {
        this.logger.log(`Using SendGrid to send email to ${email}`);
        await sgMail.send({
          to: email,
          from: this.fromEmail,
          subject: 'Подтвердите ваш e-mail',
          html: htmlContent,
        });
        this.logger.log(`✅ Verification email sent via SendGrid to ${email}`);
      } else if (this.smtpEnabled && this.transporter) {
        this.logger.log(`Using SMTP (${this.configService.get<string>('email.smtpHost')}) to send email to ${email}`);
        console.log(`[MailerService] SMTP transporter exists: ${!!this.transporter}`);
        console.log(`[MailerService] Sending email from: ${this.fromEmail} to: ${email}`);
        console.log(`[MailerService] Email subject: Подтвердите ваш e-mail`);
        console.log(`[MailerService] Token in email: ${token.substring(0, 20)}...`);
        
        try {
          const info = await this.transporter.sendMail({
            from: this.fromEmail,
            to: email,
            subject: 'Подтвердите ваш e-mail',
            html: htmlContent,
            text: `Здравствуйте!\n\nСпасибо за регистрацию. Пожалуйста, подтвердите ваш e-mail, используя токен:\n\n${token}\n\nИли перейдите по ссылке: ${verifyLink}\n\nСсылка действительна 24 часа.`,
          });
          
          console.log(`[MailerService] ✅ Email sent successfully! MessageId: ${info.messageId}`);
          console.log(`[MailerService] Response: ${JSON.stringify(info.response)}`);
          this.logger.log(`✅ Verification email sent via SMTP to ${email}. MessageId: ${info.messageId}, Response: ${info.response}`);
        } catch (sendError: any) {
          console.error(`[MailerService] ❌ SMTP sendMail error:`, sendError);
          console.error(`[MailerService] Error code: ${sendError.code}`);
          console.error(`[MailerService] Error command: ${sendError.command}`);
          console.error(`[MailerService] Error response: ${sendError.response}`);
          console.error(`[MailerService] Full error:`, JSON.stringify(sendError, null, 2));
          throw sendError;
        }
      } else {
        this.logger.error(`❌ Cannot send email: mailer is not properly configured`);
        console.error(`[MailerService] SMTP enabled: ${this.smtpEnabled}, transporter exists: ${!!this.transporter}`);
        throw new Error('Email service is not configured');
      }
    } catch (error: any) {
      this.logger.error(`❌ Failed to send verification email to ${email}:`, error?.message || error);
      this.logger.error(`Error details:`, error);
      // Пробрасываем ошибку дальше, чтобы она была видна в auth.service
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    if (!this.isEnabled()) {
      this.logger.debug(`Skipping password reset email for ${email}`);
      return;
    }

    const resetLink = `${this.resetRedirectUrl}?token=${encodeURIComponent(token)}`;

    const htmlContent = `
      <p>Здравствуйте!</p>
      <p>Мы получили запрос на сброс пароля. Вы можете задать новый пароль, перейдя по ссылке:</p>
      <p><a href="${resetLink}">Сбросить пароль</a></p>
      <p>Если вы не запрашивали изменение пароля, просто проигнорируйте это письмо.</p>
    `;

    try {
      this.logger.log(`📧 Sending password reset email to ${email}...`);
      
      if (this.sendgridEnabled) {
        await sgMail.send({
          to: email,
          from: this.fromEmail,
          subject: 'Сброс пароля',
          html: htmlContent,
        });
        this.logger.log(`✅ Password reset email sent via SendGrid to ${email}`);
      } else if (this.smtpEnabled && this.transporter) {
        const info = await this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Сброс пароля',
          html: htmlContent,
        });
        this.logger.log(`✅ Password reset email sent via SMTP to ${email}. MessageId: ${info.messageId}`);
      } else {
        this.logger.error(`❌ Cannot send email: mailer is not properly configured`);
        throw new Error('Email service is not configured');
      }
    } catch (error: any) {
      this.logger.error(`❌ Failed to send password reset email to ${email}:`, error?.message || error);
      this.logger.error(`Error details:`, error);
      throw error;
    }
  }
}

