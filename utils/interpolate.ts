/**
 * Подстановка значений в строку локали: `{n}`, `{total}`, `{failed}` и т.п.
 *
 * В проекте нет i18n-библиотеки — переводы это обычные объекты (locales/*.ts),
 * поэтому строки с числами приходилось собирать шаблонными литералами прямо
 * в экранах, и они оставались захардкожены по-русски. Здесь минимальная
 * замена по имени плейсхолдера, без зависимостей.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
