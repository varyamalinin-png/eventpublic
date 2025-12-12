# Event App - Web Production (Next.js)

Это продакшн версия веб-приложения на Next.js.

## Разработка

- **Expo (client/)** - используется для разработки и тестирования
- **Next.js (web/)** - используется для продакшна и показа друзьям

## Установка

```bash
npm install
```

## Запуск

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Структура

- `src/app/` - Next.js App Router страницы
- `src/components/` - React компоненты
- Использует контексты и хуки из `../client/`

## Деплой

После сборки (`npm run build`) файлы в `.next/` можно задеплоить на сервер.
