/**
 * Список стран для выбора кода при вводе телефона.
 *
 * Флаг считаем из ISO-кода на лету (regional indicator symbols), чтобы не
 * тащить emoji-строки руками — они одинаковы на всех платформах, где вообще
 * рисуются цветные эмодзи (iOS/Android; на части браузеров на Windows будут
 * видны просто буквы EN, RU и т.п. — это ограничение шрифта ОС, не наше).
 */
function flagFromIso2(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export type Country = {
  iso2: string;
  dial: string;
  nameRu: string;
  nameEn: string;
  flag: string;
};

const RAW: Array<[string, string, string, string]> = [
  // [iso2, dial, nameRu, nameEn] — Россия первая: код по умолчанию.
  ['RU', '+7', 'Россия', 'Russia'],
  ['KZ', '+7', 'Казахстан', 'Kazakhstan'],
  ['BY', '+375', 'Беларусь', 'Belarus'],
  ['UA', '+380', 'Украина', 'Ukraine'],
  ['UZ', '+998', 'Узбекистан', 'Uzbekistan'],
  ['AM', '+374', 'Армения', 'Armenia'],
  ['AZ', '+994', 'Азербайджан', 'Azerbaijan'],
  ['GE', '+995', 'Грузия', 'Georgia'],
  ['KG', '+996', 'Киргизия', 'Kyrgyzstan'],
  ['TJ', '+992', 'Таджикистан', 'Tajikistan'],
  ['TM', '+993', 'Туркменистан', 'Turkmenistan'],
  ['MD', '+373', 'Молдова', 'Moldova'],
  ['US', '+1', 'США', 'United States'],
  ['CA', '+1', 'Канада', 'Canada'],
  ['GB', '+44', 'Великобритания', 'United Kingdom'],
  ['DE', '+49', 'Германия', 'Germany'],
  ['FR', '+33', 'Франция', 'France'],
  ['IT', '+39', 'Италия', 'Italy'],
  ['ES', '+34', 'Испания', 'Spain'],
  ['PT', '+351', 'Португалия', 'Portugal'],
  ['NL', '+31', 'Нидерланды', 'Netherlands'],
  ['BE', '+32', 'Бельгия', 'Belgium'],
  ['CH', '+41', 'Швейцария', 'Switzerland'],
  ['AT', '+43', 'Австрия', 'Austria'],
  ['SE', '+46', 'Швеция', 'Sweden'],
  ['NO', '+47', 'Норвегия', 'Norway'],
  ['FI', '+358', 'Финляндия', 'Finland'],
  ['DK', '+45', 'Дания', 'Denmark'],
  ['PL', '+48', 'Польша', 'Poland'],
  ['CZ', '+420', 'Чехия', 'Czech Republic'],
  ['SK', '+421', 'Словакия', 'Slovakia'],
  ['HU', '+36', 'Венгрия', 'Hungary'],
  ['RO', '+40', 'Румыния', 'Romania'],
  ['BG', '+359', 'Болгария', 'Bulgaria'],
  ['GR', '+30', 'Греция', 'Greece'],
  ['CY', '+357', 'Кипр', 'Cyprus'],
  ['IE', '+353', 'Ирландия', 'Ireland'],
  ['LT', '+370', 'Литва', 'Lithuania'],
  ['LV', '+371', 'Латвия', 'Latvia'],
  ['EE', '+372', 'Эстония', 'Estonia'],
  ['HR', '+385', 'Хорватия', 'Croatia'],
  ['RS', '+381', 'Сербия', 'Serbia'],
  ['SI', '+386', 'Словения', 'Slovenia'],
  ['TR', '+90', 'Турция', 'Turkey'],
  ['IL', '+972', 'Израиль', 'Israel'],
  ['AE', '+971', 'ОАЭ', 'United Arab Emirates'],
  ['SA', '+966', 'Саудовская Аравия', 'Saudi Arabia'],
  ['IN', '+91', 'Индия', 'India'],
  ['CN', '+86', 'Китай', 'China'],
  ['JP', '+81', 'Япония', 'Japan'],
  ['KR', '+82', 'Южная Корея', 'South Korea'],
  ['TH', '+66', 'Таиланд', 'Thailand'],
  ['VN', '+84', 'Вьетнам', 'Vietnam'],
  ['ID', '+62', 'Индонезия', 'Indonesia'],
  ['PH', '+63', 'Филиппины', 'Philippines'],
  ['MY', '+60', 'Малайзия', 'Malaysia'],
  ['SG', '+65', 'Сингапур', 'Singapore'],
  ['AU', '+61', 'Австралия', 'Australia'],
  ['NZ', '+64', 'Новая Зеландия', 'New Zealand'],
  ['MX', '+52', 'Мексика', 'Mexico'],
  ['BR', '+55', 'Бразилия', 'Brazil'],
  ['AR', '+54', 'Аргентина', 'Argentina'],
  ['ZA', '+27', 'ЮАР', 'South Africa'],
  ['EG', '+20', 'Египет', 'Egypt'],
];

export const COUNTRIES: Country[] = RAW.map(([iso2, dial, nameRu, nameEn]) => ({
  iso2,
  dial,
  nameRu,
  nameEn,
  flag: flagFromIso2(iso2),
}));

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find((c) => c.dial === dial);
}
