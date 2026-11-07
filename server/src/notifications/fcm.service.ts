import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Пуши на Android — зеркало ApnsService, тот же публичный интерфейс
 * (sendToUser), только адресат другой: FCM вместо APNs.
 *
 * Как и у APNs, здесь нет библиотеки. Нужны ровно две вещи: подписать
 * служебный JWT ключом сервисного аккаунта, обменять его на access-токен и
 * сходить одним POST в HTTP v1 API. Всё это умеет встроенный crypto.
 *
 * Отдельное сообщение про `notification`: ключ отдаём именно в этом поле, а не
 * только в `data`. Иначе Android не покажет баннер, когда приложение закрыто —
 * data-only сообщение будит код, которого в этот момент нет.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  private readonly projectId?: string;
  private readonly clientEmail?: string;
  private readonly privateKey?: string;

  /** Google выдаёт access-токен на час; держим его и не ходим за ним на каждый пуш. */
  private cachedToken?: { value: string; expiresAt: number };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.projectId = this.config.get<string>('FCM_PROJECT_ID');
    this.clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL');
    // Ключ лежит в .env одной строкой, переносы записаны как \n — возвращаем.
    this.privateKey = this.config.get<string>('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!this.isConfigured()) {
      this.logger.warn(
        'FCM не настроен (нужны FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY) — пуши на Android отправляться не будут',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey);
  }

  /**
   * Отправляет уведомление на все android-устройства пользователя.
   * Ошибки наружу не идут: неудачный пуш не должен ронять то действие,
   * которое его породило.
   */
  async sendToUser(
    userId: string,
    build: (language: string) => { title: string; body: string } | null,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId, platform: 'android' },
      });
      if (!tokens.length) return;

      await Promise.all(
        tokens.map(async (row) => {
          const text = build(row.language);
          if (!text) return;
          await this.send(row.token, text, data);
        }),
      );
    } catch (error) {
      this.logger.error(`Не удалось отправить пуш на Android пользователю ${userId}`, error as Error);
    }
  }

  private async send(
    deviceToken: string,
    text: { title: string; body: string },
    data: Record<string, unknown>,
  ): Promise<void> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return;

    // FCM принимает в data только строки, а зовут нас с чем угодно.
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    const body = JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: text.title, body: text.body },
        data: stringData,
        android: {
          priority: 'HIGH',
          notification: { sound: 'default' },
        },
      },
    });

    let response: Response;
    try {
      response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body,
        },
      );
    } catch (error) {
      this.logger.warn(`FCM недоступен: ${(error as Error).message}`);
      return;
    }

    if (response.ok) return;

    const payload = await response.text().catch(() => '');
    this.logger.warn(`FCM ответил ${response.status}: ${payload.slice(0, 300)}`);

    // UNREGISTERED — приложение удалили или токен перевыпустили.
    // INVALID_ARGUMENT на сам токен — строка не является токеном FCM.
    // В обоих случаях запись мертва; остальные коды (5xx, квоты) временные,
    // и живое устройство по ним стирать нельзя.
    const dead =
      response.status === 404 ||
      (response.status === 400 && /INVALID_ARGUMENT/.test(payload) && /token/i.test(payload));

    if (dead) {
      await this.prisma.pushToken
        .deleteMany({ where: { token: deviceToken } })
        .catch(() => undefined);
    }
  }

  /** Служебный JWT сервисного аккаунта, обменянный на access-токен Google. */
  private async getAccessToken(): Promise<string | undefined> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const iat = Math.floor(now / 1000);
    const header = this.b64({ alg: 'RS256', typ: 'JWT' });
    const claims = this.b64({
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    });

    let assertion: string;
    try {
      const signature = crypto
        .sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), this.privateKey as string)
        .toString('base64url');
      assertion = `${header}.${claims}.${signature}`;
    } catch (error) {
      this.logger.error(`Не удалось подписать служебный JWT: ${(error as Error).message}`);
      return undefined;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.error(`Google не выдал access-токен (${response.status}): ${text.slice(0, 200)}`);
        return undefined;
      }

      const json = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) return undefined;

      this.cachedToken = {
        value: json.access_token,
        expiresAt: now + (json.expires_in ?? 3600) * 1000,
      };
      return json.access_token;
    } catch (error) {
      this.logger.error(`Не удалось получить access-токен: ${(error as Error).message}`);
      return undefined;
    }
  }

  private b64(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
