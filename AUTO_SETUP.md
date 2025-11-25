# 🤖 Автоматическая настройка Railway

## 🚀 Быстрый способ:

```bash
cd /Users/varya.malinina.2003mail.ru/event_app_new

# Запустите скрипт
./setup-railway-auto.sh
```

Скрипт автоматически:
1. ✅ Установит Railway CLI (если нужно)
2. ✅ Попросит авторизоваться (если нужно)
3. ✅ Инициализирует проект
4. ✅ Установит все переменные окружения
5. ✅ Настроит деплой

---

## 📝 Пошагово вручную:

### Шаг 1: Установка Railway CLI

```bash
curl -fsSL https://railway.app/install.sh | sh
```

### Шаг 2: Авторизация (один раз)

```bash
railway login
```

Откроется браузер - авторизуйтесь через GitHub.

### Шаг 3: Инициализация проекта

```bash
cd /Users/varya.malinina.2003mail.ru/event_app_new/server
railway init
```

Выберите:
- **"Link to existing project"** (если проект уже есть)
- Или **"Create new project"** (если создаете новый)

### Шаг 4: Установка переменных

```bash
# Обязательные
railway variables set NODE_ENV=production
railway variables set PORT=4000
railway variables set CORS_ORIGIN=*

# JWT
railway variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
railway variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
railway variables set JWT_ACCESS_TTL=15m
railway variables set JWT_REFRESH_TTL=7d

# API URL
railway variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app
```

### Шаг 5: Проверка DATABASE_URL и REDIS_URL

Railway автоматически добавит эти переменные, если базы данных в том же проекте.

Проверьте:
```bash
railway variables
```

Если их нет - добавьте вручную из веб-интерфейса Railway.

### Шаг 6: Деплой

```bash
# Вариант 1: Автоматически через GitHub
git add .
git commit -m "Railway setup"
git push

# Вариант 2: Вручную через CLI
railway up
```

---

## 🔍 Проверка:

```bash
# Посмотреть статус
railway status

# Посмотреть логи
railway logs

# Посмотреть переменные
railway variables
```

---

**Запустите `./setup-railway-auto.sh` для автоматической настройки!** 🚀

