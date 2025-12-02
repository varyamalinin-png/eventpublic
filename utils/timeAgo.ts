/**
 * Форматирует время в относительный формат
 * @param date - Дата для форматирования
 * @returns Форматированная строка времени (26 min, 1 h, 4 h, 2 d, 3 w, 16 Nov, 16.11.24)
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(targetDate.getTime())) {
    return '';
  }

  const diffMs = now.getTime() - targetDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // Меньше часа - показываем минуты
  if (diffMinutes < 60) {
    return `${diffMinutes}min`;
  }

  // Меньше суток - показываем часы
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  // Меньше недели - показываем дни
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  // Меньше месяца - показываем недели
  if (diffWeeks < 4) {
    return `${diffWeeks}w`;
  }

  // Меньше года - показываем дату в формате "16 Nov"
  if (diffYears < 1) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = targetDate.getDate();
    const month = months[targetDate.getMonth()];
    return `${day} ${month}`;
  }

  // Больше года - показываем дату в формате "16.11.24"
  const day = targetDate.getDate().toString().padStart(2, '0');
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const year = targetDate.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
}

