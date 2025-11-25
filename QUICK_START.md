# ⚡ Быстрый старт: GitHub + Railway

## 🔑 Сгенерированные секреты для JWT:

```
JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
```

---

## 📝 Команды для выполнения:

### 1. Загрузка на GitHub

```bash
cd /Users/varya.malinina.2003mail.ru/event_app_new

# Добавляем файлы
git add .

# Коммитим
git commit -m "Prepare for Railway deployment"

# У вас уже подключен репозиторий: eventpublic
# Если хотите использовать существующий - ничего не делайте
# Если хотите создать новый:
#   1. Создайте на GitHub: https://github.com/new
#   2. Затем: git remote set-url origin https://github.com/varyamalinin-png/новое-название.git

# Загружаем
git push -u origin main
```

**Если репозитория еще нет на GitHub:**
1. Откройте https://github.com/new
2. Название: `event-app-new`
3. Выберите **Private**
4. Нажмите **Create repository**
5. Затем выполните команды выше

---

### 2. Настройка Railway

1. **Откройте:** https://railway.app
2. **Войдите через GitHub**
3. **New Project** → **Deploy from GitHub repo**
4. **Выберите:** `event-app-new`
5. **Root Directory:** `server`

### 3. Добавьте базы данных

1. **+ New** → **PostgreSQL** (скопируйте `DATABASE_URL`)
2. **+ New** → **Redis** (скопируйте `REDIS_URL`)

### 4. Добавьте переменные окружения

В настройках сервиса → **Variables**:

```bash
NODE_ENV=production
PORT=4000
CORS_ORIGIN=*

DATABASE_URL=<из PostgreSQL>
REDIS_URL=<из Redis>

JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

APP_BACKEND_BASE_URL=<ваш Railway URL, добавите после деплоя>
```

### 5. Скопируйте Railway URL

После деплоя скопируйте URL (например: `https://xxx.up.railway.app`) и:
1. Добавьте в переменные: `APP_BACKEND_BASE_URL=https://xxx.up.railway.app`
2. Обновите `client/app.json` → `extra.apiUrl`

---

## 📖 Подробная инструкция: `GITHUB_RAILWAY_SETUP.md`

