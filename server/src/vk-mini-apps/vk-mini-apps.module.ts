import { Module } from '@nestjs/common';
import { VkMiniAppsController } from './vk-mini-apps.controller';
import { VkMiniAppsService } from './vk-mini-apps.service';

@Module({
  controllers: [VkMiniAppsController],
  providers: [VkMiniAppsService],
})
export class VkMiniAppsModule {}
