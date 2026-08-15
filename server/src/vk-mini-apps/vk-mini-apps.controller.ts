import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VkMiniAppSessionDto } from './dto/vk-mini-app-session.dto';
import { VkMiniAppsService } from './vk-mini-apps.service';

@Controller('vk/mini-app')
export class VkMiniAppsController {
  constructor(
    private readonly vkMiniApps: VkMiniAppsService,
    private readonly config: ConfigService,
  ) {}

  @Post('session')
  async session(@Body() body: VkMiniAppSessionDto) {
    if (!this.config.get<string>('VK_MINI_APP_SECRET')) {
      throw new ServiceUnavailableException(
        'Задайте VK_MINI_APP_SECRET (защищённый ключ из настроек мини-приложения ВК)',
      );
    }

    const launchParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.launchParams || {})) {
      if (v === undefined || v === null) continue;
      launchParams[k] = String(v);
    }

    if (!this.vkMiniApps.verifyLaunchParams(launchParams)) {
      throw new ForbiddenException('Неверная подпись параметров запуска (sign)');
    }

    const vkUserId = Number(launchParams.vk_user_id);
    if (Number.isFinite(vkUserId) && vkUserId > 0) {
      await this.vkMiniApps.sendWelcomeMessageIfConfigured(vkUserId);
    }

    return { ok: true };
  }
}
