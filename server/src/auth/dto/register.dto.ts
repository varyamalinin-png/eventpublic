import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_\.]+$/, {
    message: 'Username may contain letters, numbers, underscores and dots',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['personal', 'business'])
  accountType?: 'personal' | 'business';
}
