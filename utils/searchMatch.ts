/**
 * Поиск по словам, а не по фразе целиком.
 *
 * Раньше запрос сравнивался с полями одной строкой: «пикник йога» находило
 * только события, где эти слова стоят подряд и именно в таком порядке, а
 * «йога пикник» — уже нет. Теперь каждое слово запроса ищется отдельно, в
 * любом из полей и в любом порядке; запись подходит, если нашлись все слова.
 * «ё» приравнена к «е» — в названиях её пишут через раз.
 */
const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е');

export function splitSearchQuery(query: string): string[] {
  return normalize(query)
    .split(/[\s,.;:!?«»"()]+/)
    .filter(Boolean);
}

export function matchesSearchQuery(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const words = splitSearchQuery(query);
  if (words.length === 0) return true;
  // Поля склеиваем через перевод строки: в словах запроса его нет, поэтому
  // слово не «найдётся» на стыке двух соседних полей.
  const haystack = normalize(fields.filter(Boolean).join('\n'));
  return words.every(word => haystack.includes(word));
}
