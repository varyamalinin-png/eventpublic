import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PushTokenDto {
  /** Токен устройства APNs — 64 hex-символа, но длину не фиксируем жёстко. */
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: string;

  /** Язык интерфейса: на нём сервер напишет текст пуша. */
  @IsOptional()
  @IsIn(['ru', 'en'])
  language?: string;
}
