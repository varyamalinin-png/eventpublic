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

  // Телефон обязателен при регистрации. Проверки владения номером пока нет,
  // поэтому формат не ужесточаем — только длина и допустимые символы, чтобы
  // не отсечь международные записи вида +7 (999) 123-45-67.
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(24)
  @Matches(/^[+()\-\s\d]+$/, {
    message: 'Phone may contain digits, spaces, brackets, dashes and a leading plus',
  })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain a lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain an uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Password must contain a digit' })
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
