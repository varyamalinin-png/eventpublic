import { IsOptional, IsString, IsUrl, MaxLength, IsBoolean, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  age?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  showAge?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  geoPosition?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;
}
