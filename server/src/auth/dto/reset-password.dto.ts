import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(10, 256)
  token!: string;

  @IsString()
  @Length(8, 64)
  password!: string;
}

