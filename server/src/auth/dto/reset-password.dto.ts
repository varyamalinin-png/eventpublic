import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  // Шестизначный код из письма. Пробелы и прочий мусор чистятся в сервисе,
  // здесь пропускаем чуть более длинную строку, чтобы вставка «103 804»
  // не отбивалась валидацией раньше, чем дойдёт до нормализации.
  @IsString()
  @Length(6, 16)
  code!: string;

  // Правила те же, что при регистрации, иначе через сброс можно было бы
  // поставить пароль, который регистрация не пропускает.
  @IsString()
  @Length(8, 64)
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain a lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain an uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Password must contain a digit' })
  password!: string;
}
