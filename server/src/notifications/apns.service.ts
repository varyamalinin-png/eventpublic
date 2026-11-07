import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as http2 from 'http2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Отправка пуш-уведомлений в APNs напрямую, без сторонних сервисов.
 *
 * Почему не Expo Push: EAS-проекта у приложения нет, сборки делаются локально
 * в Xcode, а у нас есть свой сервер. Идти через Expo означало бы завести
 * EAS-проект и отдать ключ APNs третьей стороне — ради HTTP-запроса, который
 * мы делаем сами.
 *
 * Почему без библиотек: APNs — это HTTP/2-запрос с заголовком authorization,
 * где токен это JWT, подписанный ES256. Node умеет и то и другое из коробки:
 * http2 и crypto.sign с dsaEncoding 'ieee-p1363' (именно этот формат подписи
 * ждёт JOSE; по умолчанию Node отдаёт DER, и APNs такой токен не примет).
 *
 * Если ключ не настроен — сервис молча ничего не делает, о чём сообщает ОДИН
 * раз при старте. Это осознанно: приложение должно работать и до того, как
 * ключ появится, а не падать на каждом уведомлении.
 */
@Injectable()
export class ApnsService implements OnModuleDestroy {
  private readonly logger = new Logger(ApnsService.name);

  private readonly keyId?: string;
  private readonly teamId?: string;
  private readonly bundleId?: string;
  private readonly privateKey?: string;
  /**
   * Оба адреса APNs, начиная с основного (его выбирает APNS_PRODUCTION).
   *
   * Токен устройства не говорит, из какого он окружения, а окружение задаёт
   * профиль подписи: сборка, поставленная из Xcode по кабелю, регистрируется
   * в sandbox, сборка из TestFlight или App Store — в production. Раньше
   * сервер знал только один адрес, и токен «не из той» среды получал 400
   * BadDeviceToken, после чего запись о нём удалялась — то есть проверить
   * пуши на Xcode-сборке и одновременно слать их живым пользователям было
   * нельзя. Теперь при BadDeviceToken запрос повторяется во вторую среду.
   */
  private readonly hosts: string[];

  /** APNs требует не обновлять токен чаще раза в 20 минут и не реже раза в час. */
  private cachedJwt?: { token: string; issuedAt: number };
  private static readonly JWT_TTL_MS = 40 * 60 * 1000;

  private readonly sessions = new Map<string, http2.ClientHttp2Session>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.keyId = this.config.get<string>('APNS_KEY_ID');
    this.teamId = this.config.get<string>('APNS_TEAM_ID');
    this.bundleId =
      this.config.get<string>('APNS_BUNDLE_ID') || 'com.varyamalinina.iwent';
    // Ключ .p8 хранится в переменной окружения одной строкой, поэтому
    // переносы строк в нём записаны как \n — возвращаем их обратно.
    this.privateKey = this.config
      .get<string>('APNS_KEY_P8')
      ?.replace(/\\n/g, '\n');
    const production = 'https://api.push.apple.com';
    const sandbox = 'https://api.sandbox.push.apple.com';
    this.hosts =
      this.config.get<string>('APNS_PRODUCTION') === 'false'
        ? [sandbox, production]
        : [production, sandbox];

    if (!this.isConfigured()) {
      this.logger.warn(
        'APNs не настроен (нужны APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8) — пуши отправляться не будут',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.keyId && this.teamId && this.privateKey);
  }

  onModuleDestroy() {
    this.sessions.forEach((session) => session.close());
    this.sessions.clear();
  }

  /**
   * Отправляет уведомление на все устройства пользователя.
   * Ошибки не пробрасываются: неудачный пуш не должен ронять то действие,
   * которое его породило (вступление в событие, сообщение и т.д.).
   */
  async sendToUser(
    userId: string,
    build: (language: string) => { title: string; body: string } | null,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId, platform: 'ios' },
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
      this.logger.error(`Не удалось отправить пуш пользователю ${userId}`, error as Error);
    }
  }

  private async send(
    deviceToken: string,
    text: { title: string; body: string },
    data: Record<string, unknown>,
  ): Promise<void> {
    const payload = JSON.stringify({
      aps: {
        alert: { title: text.title, body: text.body },
        sound: 'default',
        'mutable-content': 1,
      },
      ...data,
    });

    let dead = false;

    for (const host of this.hosts) {
      const { status, reason } = await this.request(host, deviceToken, payload);

      if (status === 200) return;

      // BadDeviceToken значит «этот токен не из моей среды» — стоит спросить
      // вторую. Всё остальное второй адрес ответит так же, повторять незачем.
      if (status === 400 && reason === 'BadDeviceToken') {
        dead = true;
        continue;
      }

      // 410 Unregistered — приложение удалили с устройства. Токен мёртв в
      // любой среде, перебор прекращаем.
      dead = status === 410;
      break;
    }

    // Запись удаляем, только когда токен отвергнут везде: иначе временная
    // ошибка сети стирала бы живое устройство, и до переустановки приложения
    // пуши до человека уже не дошли бы.
    if (dead) {
      await this.prisma.pushToken
        .deleteMany({ where: { token: deviceToken } })
        .catch(() => undefined);
    }
  }

  private request(
    host: string,
    deviceToken: string,
    payload: string,
  ): Promise<{ status: number; reason?: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (status: number, reason?: string) => {
        if (!settled) {
          settled = true;
          resolve({ status, reason });
        }
      };

      try {
        const session = this.getSession(host);
        const req = session.request({
          ':method': 'POST',
          ':path': `/3/device/${deviceToken}`,
          authorization: `bearer ${this.getJwt()}`,
          'apns-topic': this.bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        });

        req.setEncoding('utf8');
        let status = 0;
        let body = '';
        req.on('response', (headers) => {
          status = Number(headers[':status']) || 0;
        });
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          let reason: string | undefined;
          if (status >= 400) {
            try {
              reason = JSON.parse(body)?.reason;
            } catch {
              reason = undefined;
            }
            this.logger.warn(`APNs (${host}) ответил ${status}: ${body}`);
          }
          finish(status, reason);
        });
        req.on('error', (error) => {
          this.logger.warn(`APNs запрос не удался (${host}): ${error.message}`);
          finish(0);
        });
        req.end(payload);
      } catch (error) {
        this.logger.warn(`APNs недоступен (${host}): ${(error as Error).message}`);
        finish(0);
      }
    });
  }

  /** Соединение переиспользуем: HTTP/2 позволяет слать в него много запросов. */
  private getSession(host: string): http2.ClientHttp2Session {
    const existing = this.sessions.get(host);
    if (existing && !existing.closed && !existing.destroyed) {
      return existing;
    }
    const session = http2.connect(host);
    session.on('error', (error) => {
      this.logger.warn(`APNs соединение оборвалось (${host}): ${error.message}`);
      this.sessions.delete(host);
    });
    session.on('close', () => {
      this.sessions.delete(host);
    });
    this.sessions.set(host, session);
    return session;
  }

  private getJwt(): string {
    const now = Date.now();
    if (this.cachedJwt && now - this.cachedJwt.issuedAt < ApnsService.JWT_TTL_MS) {
      return this.cachedJwt.token;
    }

    const header = { alg: 'ES256', kid: this.keyId };
    const claims = { iss: this.teamId, iat: Math.floor(now / 1000) };
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const signingInput = `${encode(header)}.${encode(claims)}`;

    // dsaEncoding обязателен: без него Node вернёт DER-подпись, а JOSE
    // (и значит APNs) ждёт «сырые» r||s.
    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
      key: this.privateKey as string,
      dsaEncoding: 'ieee-p1363',
    });

    const token = `${signingInput}.${signature.toString('base64url')}`;
    this.cachedJwt = { token, issuedAt: now };
    return token;
  }
}
