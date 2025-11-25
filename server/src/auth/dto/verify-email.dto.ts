import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(10, 256)
  token!: string;
}

