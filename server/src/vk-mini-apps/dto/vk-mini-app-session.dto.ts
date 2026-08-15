import { IsObject } from 'class-validator';

export class VkMiniAppSessionDto {
  @IsObject()
  launchParams!: Record<string, unknown>;
}
