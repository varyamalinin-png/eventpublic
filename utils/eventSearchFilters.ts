import type { Event } from '../types';

/**
 * Фильтры поиска событий (участники, дата, цена, возраст организатора,
 * метки) — ОДИН набор правил на ленту и на карту.
 *
 * Логика вынесена сюда, чтобы два экрана не разъехались: раньше фильтрация
 * жила только внутри explore, и повторить её на карте можно было лишь
 * копированием — а копии неизбежно расходятся (так уже вышло с сеткой
 * профиля, см. components/ProfileEventsGrid).
 *
 * Не путать с utils/eventFilters.ts — там про участие пользователя в
 * событиях (прошедшие/предстоящие), это другая задача.
 */
export interface FilterOptions {
  participantsMin?: number;
  participantsMax?: number;
  /** Через сколько часов максимально начнётся событие */
  timeHoursMax?: number;
  priceMax?: number;
  organizerAgeMin?: number;
  organizerAgeMax?: number;
  selectedTags?: string[];
  /**
   * Онлайн или офлайн. Признак ровно тот же, что на карточке события и в
   * его профиле: онлайн — это событие БЕЗ координат (см. EventCard,
   * `isOnlineEvent = !event.coordinates`). Отдельного поля у события нет.
   */
  placeType?: 'online' | 'offline';
  /** Как ввёл пользователь: ДД.ММ.ГГГГ */
  dateFrom?: string;
  dateTo?: string;
}

type UserLike = { age?: string } | null | undefined;

/**
 * Подписи меток: ключ с сервера -> текст для показа.
 *
 * Таблица одна на всё приложение — в explore она была продублирована дважды
 * в одном файле (в панели фильтров и в чипах активных фильтров), и на карте
 * появилась бы третья копия.
 */
export function getTagLabels(t: any): Record<string, string> {
  return {
    'age_18_plus': '18+',
    'age_21_plus': '21+',
    'age_16_plus': '16+',
    'women_only': 'women only',
    'men_only': 'men only',
    'recurring': t.events.recurringEvent,
    'starting_soon': 'starting soon',
    'массовое': t.events.massEvent,
    'регулярное': t.events.recurringEvent,
  };
}

/**
 * Дату пользователь вводит как ДД.ММ.ГГГГ, а у события она хранится в ISO.
 * Возвращаем ISO, чтобы сравнивать строки напрямую; на неполном вводе —
 * undefined, тогда граница диапазона просто не применяется.
 *
 * Год можно не писать: «10.09» — это 10 сентября текущего года.
 */
export function parseDateInput(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.trim().match(/^(\d{1,2})\D(\d{1,2})(?:\D(\d{2}|\d{4}))?\D?$/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = !m[3]
    ? new Date().getFullYear()
    : m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(check.getTime()) || check.getDate() !== day) return undefined;
  return iso;
}

/**
 * Точки в дате расставляются сами: «10092026» превращается в «10.09.2026»
 * прямо по мере ввода. Точку после одной цифры читаем как конец дня или
 * месяца: «1.9.» → «01.09.».
 *
 * При стирании точку в конце не дописываем — иначе её было бы не удалить:
 * она возвращалась бы следом за каждой стёртой цифрой.
 */
export function formatDateTyping(next: string, prev: string = ''): string {
  const deleting = next.length < prev.length;
  const padded = next
    .replace(/^(\d)\D/, '0$1.')
    .replace(/^(\d{2})\D(\d)\D/, '$1.0$2.');
  const digits = padded.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2 || (digits.length === 2 && !deleting)) out += '.';
  if (digits.length > 2) out += digits.slice(2, 4);
  if (digits.length > 4 || (digits.length === 4 && !deleting)) out += '.';
  if (digits.length > 4) out += digits.slice(4, 8);
  return out;
}

/**
 * Дописывает дату, когда поле теряет фокус: «10.09» → «10.09.<текущий год>»,
 * «10.09.26» → «10.09.2026». Некорректный ввод оставляем как есть — фильтр
 * его просто не применит.
 */
export function completeDateInput(text?: string): string | undefined {
  if (!text) return text;
  const iso = parseDateInput(text);
  if (!iso) return text;
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * «Только женщины / только мужчины» — в списке фильтров всегда, даже если
 * таких событий сейчас нет. «men only» раньше не было вовсе: метку для
 * мужских событий никто не ставил.
 */
export const GENDER_FILTER_TAGS = ['women_only', 'men_only'];

const normalizeTag = (tag: string) => String(tag).toLowerCase().replace(/[\s_]+/g, '');

/** Метка пола: 'women_only' и 'women only' — одно и то же. */
export const isGenderTag = (tag: string) => ['womenonly', 'menonly'].includes(normalizeTag(tag));

/**
 * Совпадение по полу проверяем по самому ограничению события, а не только по
 * метке: у мужских событий метки не было, и по ней одной старые события не
 * нашлись бы.
 */
function matchesGenderRestriction(event: any, tag: string): boolean {
  const key = normalizeTag(tag);
  const gender = key === 'womenonly' ? 'female' : key === 'menonly' ? 'male' : null;
  if (!gender) return false;
  const restriction = event?.genderRestriction;
  return Array.isArray(restriction) && restriction.length === 1 && restriction[0] === gender;
}

/** Сколько фильтров реально задано — для счётчика на кнопке. */
export function countActiveFilters(filters: FilterOptions): number {
  let count = 0;
  if (filters.participantsMin !== undefined && filters.participantsMin > 0) count++;
  if (filters.participantsMax !== undefined && filters.participantsMax > 0) count++;
  if (filters.timeHoursMax !== undefined && filters.timeHoursMax > 0) count++;
  if (filters.priceMax !== undefined && filters.priceMax > 0) count++;
  if (filters.organizerAgeMin !== undefined && filters.organizerAgeMin > 0) count++;
  if (filters.organizerAgeMax !== undefined && filters.organizerAgeMax > 0) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.selectedTags && filters.selectedTags.length > 0) count++;
  if (filters.placeType) count++;
  return count;
}

/**
 * Подходит ли событие под фильтры.
 *
 * Общий принцип: если данных для проверки не хватает (нет даты, возраста
 * организатора и т.п.) — событие НЕ отсеиваем. Фильтр сужает выборку по
 * известному, а не прячет всё, о чём нет сведений.
 */
export function matchesFilters(
  event: Event | any,
  filters: FilterOptions,
  getUserData: (userId: string) => UserLike,
): boolean {
  if (!event) return false;

  if (filters.participantsMin && event.participants < filters.participantsMin) return false;
  if (filters.participantsMax && event.participants > filters.participantsMax) return false;

  if (filters.timeHoursMax) {
    if (!event.date || !event.time) return true;
    const eventDateTime = new Date(`${event.date}T${event.time}`);
    if (Number.isNaN(eventDateTime.getTime())) return true;
    const hoursUntilEvent = (eventDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilEvent > filters.timeHoursMax) return false;
  }

  if (filters.dateFrom || filters.dateTo) {
    const from = parseDateInput(filters.dateFrom);
    const to = parseDateInput(filters.dateTo);
    if (from && event.date < from) return false;
    if (to && event.date > to) return false;
  }

  if (filters.priceMax) {
    const price = String(event.price ?? '').replace(/[^\d]/g, '');
    const priceValue = parseInt(price, 10) || 0;
    if (priceValue > filters.priceMax) return false;
  }

  if (filters.organizerAgeMin || filters.organizerAgeMax) {
    const organizerData = getUserData(event.organizerId);
    const ageMatch = String(organizerData?.age ?? '').match(/(\d+)/);
    if (!ageMatch) return true;
    const orgAge = parseInt(ageMatch[1], 10);
    if (filters.organizerAgeMin && orgAge < filters.organizerAgeMin) return false;
    if (filters.organizerAgeMax && orgAge > filters.organizerAgeMax) return false;
  }

  if (filters.placeType) {
    const isOnline = !event.coordinates;
    if (filters.placeType === 'online' && !isOnline) return false;
    if (filters.placeType === 'offline' && isOnline) return false;
  }

  if (filters.selectedTags && filters.selectedTags.length > 0) {
    const eventTags: string[] = event.tags || [];
    const hasSelectedTag = filters.selectedTags.some(selectedTag =>
      matchesGenderRestriction(event, selectedTag) ||
      eventTags.some(eventTag => normalizeTag(eventTag) === normalizeTag(selectedTag)),
    );
    if (!hasSelectedTag) return false;
  }

  return true;
}
