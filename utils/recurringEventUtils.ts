import type { Event } from '../types';

/**
 * Получить все даты регулярного события
 */
export const getAllRecurringDates = (event: Event): Array<{ date: string; dateTime: Date; isPast: boolean }> => {
  if (!event.isRecurring || !event.time) {
    return [];
  }

  const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
  const now = new Date();
  const results: Array<{ date: string; dateTime: Date; isPast: boolean }> = [];

  switch (event.recurringType) {
    case 'custom':
      if (event.recurringCustomDates && event.recurringCustomDates.length > 0) {
        event.recurringCustomDates.forEach(dateStr => {
          const dateTime = new Date(dateStr + 'T' + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
          results.push({
            date: dateStr,
            dateTime,
            isPast: dateTime.getTime() < now.getTime(),
          });
        });
      }
      break;

    case 'daily':
      // Генерируем даты на ближайшие 30 дней
      const startDate = event.date ? new Date(event.date) : new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dateTime = new Date(dateStr + 'T' + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
        results.push({
          date: dateStr,
          dateTime,
          isPast: dateTime.getTime() < now.getTime(),
        });
      }
      break;

    case 'weekly':
      if (event.recurringDays && event.recurringDays.length > 0 && event.date) {
        const startDate = new Date(event.date);
        startDate.setHours(0, 0, 0, 0);
        // Генерируем даты на ближайшие 8 недель
        for (let week = 0; week < 8; week++) {
          event.recurringDays.forEach(dayOfWeek => {
            // Вычисляем дату для этого дня недели в этой неделе
            // Находим первый день недели начальной даты (воскресенье = 0)
            const firstDayOfWeek = new Date(startDate);
            firstDayOfWeek.setDate(startDate.getDate() - startDate.getDay());
            // Вычисляем дату для нужного дня недели
            const targetDate = new Date(firstDayOfWeek);
            targetDate.setDate(firstDayOfWeek.getDate() + dayOfWeek + (week * 7));
            // Убеждаемся, что дата не раньше начальной даты события
            if (targetDate >= startDate) {
              const dateStr = targetDate.toISOString().split('T')[0];
              const dateTime = new Date(dateStr + 'T' + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
              // Проверяем, не добавили ли мы уже эту дату
              if (!results.find(r => r.date === dateStr)) {
                results.push({
                  date: dateStr,
                  dateTime,
                  isPast: dateTime.getTime() < now.getTime(),
                });
              }
            }
          });
        }
      }
      break;

    case 'monthly':
      if (event.recurringDayOfMonth && event.date) {
        const startDate = new Date(event.date);
        // Генерируем даты на ближайшие 12 месяцев
        for (let month = 0; month < 12; month++) {
          const date = new Date(startDate);
          date.setMonth(startDate.getMonth() + month);
          date.setDate(event.recurringDayOfMonth);
          if (date >= startDate) {
            const dateStr = date.toISOString().split('T')[0];
            const dateTime = new Date(dateStr + 'T' + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
            results.push({
              date: dateStr,
              dateTime,
              isPast: dateTime.getTime() < now.getTime(),
            });
          }
        }
      }
      break;
  }

  // Сортируем по дате
  return results.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
};

/**
 * Получить ближайшую будущую дату регулярного события
 */
export const getNextRecurringDate = (event: Event): { date: string; dateTime: Date } | null => {
  const allDates = getAllRecurringDates(event);
  const futureDates = allDates.filter(d => !d.isPast);
  return futureDates.length > 0 ? { date: futureDates[0].date, dateTime: futureDates[0].dateTime } : null;
};

/**
 * Получить количество будущих дат после ближайшей
 */
export const getRemainingDatesCount = (event: Event): number => {
  const allDates = getAllRecurringDates(event);
  const futureDates = allDates.filter(d => !d.isPast);
  return Math.max(0, futureDates.length - 1);
};

