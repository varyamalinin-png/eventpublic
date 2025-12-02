import { IsEnum, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export enum ComplaintType {
  EVENT = 'EVENT',
  USER = 'USER',
}

export class CreateComplaintDto {
  @IsEnum(ComplaintType)
  type: ComplaintType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reportedEventId?: string;

  @IsString()
  @IsOptional()
  reportedUserId?: string;
}

