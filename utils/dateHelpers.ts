// Утилиты для работы с датами
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().substring(2);
  return `${day}.${month}.${year}`;
};

export const toYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseEventDateTime = (dateStr: string, timeStr: string): Date => {
  const [hh, mm] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hh, mm, 0, 0);
  return date;
};

// Форматирование даты для регулярных событий
export const formatRecurringEventDate = (event: {
  isRecurring?: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringDays?: number[];
  recurringDayOfMonth?: number;
  recurringCustomDates?: string[];
  date?: string;
}, lang: 'en' | 'ru' = 'en'): string => {
  if (!event.isRecurring) {
    // Обычное событие - форматируем дату как обычно
    if (event.date) {
      const date = new Date(event.date);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().substring(2);
      return `${day}.${month}.${year}`;
    }
    return '';
  }

  // Регулярные события
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesRu = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const dayNames = lang === 'en' ? dayNamesEn : dayNamesRu;
  
  switch (event.recurringType) {
    case 'daily':
      return lang === 'en' ? 'daily' : 'ежедневно';
      
    case 'weekly':
      if (event.recurringDays && event.recurringDays.length > 0) {
        if (event.recurringDays.length === 1) {
          const every = lang === 'en' ? 'every' : 'каждый';
          return `${every} ${dayNames[event.recurringDays[0]]}`;
        } else {
          // Если несколько дней - показываем первый день и "+ n" (количество оставшихся дней)
          const firstDay = dayNames[event.recurringDays[0]];
          const remainingDays = event.recurringDays.length - 1;
          const daysText = lang === 'en' ? 'days' : remainingDays === 1 ? 'день' : remainingDays < 5 ? 'дня' : 'дней';
          return `${firstDay} +${remainingDays} ${daysText}`;
        }
      }
      return lang === 'en' ? 'every weekday' : 'каждый день недели';
      
    case 'monthly':
      if (event.recurringDayOfMonth) {
        if (lang === 'en') {
          const suffix = event.recurringDayOfMonth === 1 ? 'st' : event.recurringDayOfMonth === 2 ? 'nd' : event.recurringDayOfMonth === 3 ? 'rd' : 'th';
          return `every ${event.recurringDayOfMonth}${suffix} of month`;
        }
        return `каждый ${event.recurringDayOfMonth}-й день месяца`;
      }
      return lang === 'en' ? 'every month' : 'каждый месяц';
      
    case 'custom':
      if (event.recurringCustomDates && event.recurringCustomDates.length > 0) {
        // Сортируем даты и берем первую будущую дату (или первую, если все прошли)
        const sortedDates = [...event.recurringCustomDates].sort();
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Сбрасываем время для корректного сравнения
        
        // Фильтруем будущие даты
        const futureDates = sortedDates.filter(d => {
          const dDate = new Date(d);
          dDate.setHours(0, 0, 0, 0);
          return dDate >= now;
        });
        
        // Берем первую дату (будущую или прошедшую, если все прошли)
        const firstDate = futureDates.length > 0 ? futureDates[0] : sortedDates[0];
        const date = new Date(firstDate);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().substring(2);
        
        // Количество оставшихся дат (не включая первую)
        const remainingCount = futureDates.length > 1 ? futureDates.length - 1 : 0;
        
        if (remainingCount > 0) {
          // Показываем первую дату и "+n дат" прямо в тексте
          const datesText = lang === 'en' ? 'dates' : remainingCount === 1 ? 'дата' : remainingCount < 5 ? 'даты' : 'дат';
          return `${day}.${month}.${year} +${remainingCount} ${datesText}`;
        } else {
          // Только одна дата или все прошли
          return `${day}.${month}.${year}`;
        }
      }
      return '';
      
    default:
      return '';
  }
};

