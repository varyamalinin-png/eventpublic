export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'только что';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} нед`;

  if (days < 365) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
}
