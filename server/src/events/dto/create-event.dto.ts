import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CoordinatesDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  startTime!: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false }, { message: 'mediaUrl must be a valid URL' })
  mediaUrl?: string; // Обрезанное фото для карточки

  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false }, { message: 'originalMediaUrl must be a valid URL' })
  originalMediaUrl?: string; // Оригинальное фото для профиля

  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  price?: string;

  @IsOptional()
  invitedUserIds?: string[];

  // Поля для регулярных событий
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'custom'])
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  recurringDays?: number[]; // Для weekly: дни недели (0-6)

  @IsOptional()
  @IsInt()
  recurringDayOfMonth?: number; // Для monthly: день месяца (1-31)

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  recurringCustomDates?: string[]; // Для custom: выбранные даты

  // Поле для массового события
  @IsOptional()
  @IsBoolean()
  isMassEvent?: boolean;

  // Метки (теги)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customTags?: string[]; // Пользовательские метки

  // Дополнительные поля
  @IsOptional()
  @IsObject()
  ageRestriction?: { min?: number; max?: number };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genderRestriction?: string[];

  @IsOptional()
  @IsString()
  mediaType?: 'image' | 'video';

  @IsOptional()
  @IsNumber()
  mediaAspectRatio?: number;

  @IsOptional()
  @IsObject()
  targeting?: {
    enabled?: boolean;
    reach?: number;
    responses?: number;
  };
}
