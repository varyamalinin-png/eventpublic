import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyVkLaunchParams } from './vk-launch-params.util';

@Injectable()
export class VkMiniAppsService {
  private readonly logger = new Logger(VkMiniAppsService.name);

  constructor(private readonly config: ConfigService) {}

  verifyLaunchParams(launchParams: Record<string, string>): boolean {
    const secret = this.config.get<string>('VK_MINI_APP_SECRET');
    if (!secret) {
      this.logger.warn('VK_MINI_APP_SECRET не задан — проверка подписи невозможна');
      return false;
    }
    return verifyVkLaunchParams(launchParams, secret);
  }

  /**
   * После VKWebAppAllowMessagesFromGroup сообщество может написать пользователю первым.
   * Нужен токен сообщества с правом messages (и включённые сообщения сообщества).
   */
  async sendWelcomeMessageIfConfigured(vkUserId: number): Promise<void> {
    const token = this.config.get<string>('VK_GROUP_MESSAGES_TOKEN');
    const welcome = this.config.get<string>('VK_GROUP_WELCOME_TEXT');
    if (!token || !welcome) {
      return;
    }

    const randomId = Math.floor(Math.random() * 2 ** 31);
    const url = new URL('https://api.vk.com/method/messages.send');
    url.searchParams.set('access_token', token);
    url.searchParams.set('v', '5.199');
    url.searchParams.set('user_id', String(vkUserId));
    url.searchParams.set('message', welcome);
    url.searchParams.set('random_id', String(randomId));

    const res = await fetch(url.toString(), { method: 'GET' });
    const json = (await res.json()) as {
      response?: number;
      error?: { error_msg?: string; error_code?: number };
    };
    if (json.error) {
      this.logger.warn(
        `messages.send: ${json.error.error_code} ${json.error.error_msg}`,
      );
    }
  }
}
