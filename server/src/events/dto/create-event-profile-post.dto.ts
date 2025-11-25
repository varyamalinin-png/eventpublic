import { IsString, IsOptional } from 'class-validator';

export class CreateEventProfilePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

