import { IsString, Length } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @Length(10, 2048)
  idToken!: string;
}

