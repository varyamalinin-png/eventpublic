import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateEventProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsObject()
  hiddenParameters?: Record<string, boolean>;
}

