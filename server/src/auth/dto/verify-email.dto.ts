import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  // Код действителен только вместе со своим адресом, поэтому email обязателен.
  @IsEmail()
  email!: string;

  // Шесть цифр. Пробелы и прочий мусор снимаются на сервере перед проверкой.
  @IsString()
  @Matches(/^\s*\d[\s\d]*$/, { message: 'Verification code must be 6 digits' })
  code!: string;
}
