FROM node:18

WORKDIR /app

# Копируем package files
COPY package*.json ./
COPY .npmrc ./

# Устанавливаем зависимости с legacy-peer-deps
RUN npm install --legacy-peer-deps

# Копируем остальные файлы
COPY . .

# Генерируем Prisma клиент
RUN npm run prisma:generate

# Собираем проект
RUN npm run build

# Запускаем сервер
CMD ["sh", "-c", "(npx prisma migrate resolve --applied 20251109141733_init || true) && (npx prisma migrate deploy || npx prisma db push --accept-data-loss || true) && node dist/src/main.js"]
