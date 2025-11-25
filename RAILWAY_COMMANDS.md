# 🚂 Команды для Railway CLI

## 📦 Установка и настройка:

```bash
# 1. Установка Railway CLI
mkdir -p ~/.local/bin
curl -fsSL https://railway.app/install.sh | bash -s -- --install-dir ~/.local/bin

# 2. Добавить в PATH (добавьте в ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# 3. Авторизация (один раз)
railway login
```

---

## 🚀 Настройка проекта:

```bash
cd /Users/varya.malinina.2003mail.ru/event_app_new/server

# Инициализация проекта
railway init
# Выберите: "Link to existing project" → выберите ваш проект

# Установка переменных
railway variables set NODE_ENV=production
railway variables set PORT=4000
railway variables set CORS_ORIGIN=*
railway variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
railway variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
railway variables set JWT_ACCESS_TTL=15m
railway variables set JWT_REFRESH_TTL=7d
railway variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app

# Проверка переменных
railway variables

# Деплой
railway up
```

---

## 🔍 Полезные команды:

```bash
# Статус проекта
railway status

# Логи
railway logs

# Открыть проект в браузере
railway open

# Просмотр сервисов
railway service

# Переменные окружения
railway variables
```

---

**Запустите команды выше для настройки!** 🚀

