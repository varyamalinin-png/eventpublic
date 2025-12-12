import { IsString, IsOptional, IsArray, Allow } from 'class-validator';

export class CreateEventProfilePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Allow()
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Allow()
  captions?: string[];
}

