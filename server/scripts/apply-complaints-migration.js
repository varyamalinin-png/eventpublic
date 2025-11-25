const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('📝 Применение миграции для системы жалоб...');
    
    // Добавляем колонку role
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';
      `);
      console.log('✅ Колонка role добавлена');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Колонка role уже существует');
      } else {
        throw error;
      }
    }
    
    // Создаем enum ComplaintType
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "ComplaintType" AS ENUM ('EVENT', 'USER');
      `);
      console.log('✅ Enum ComplaintType создан');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Enum ComplaintType уже существует');
      } else {
        throw error;
      }
    }
    
    // Создаем enum ComplaintStatus
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED');
      `);
      console.log('✅ Enum ComplaintStatus создан');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Enum ComplaintStatus уже существует');
      } else {
        throw error;
      }
    }
    
    // Создаем таблицу Complaint
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Complaint" (
          "id" TEXT NOT NULL,
          "type" "ComplaintType" NOT NULL,
          "reason" TEXT NOT NULL,
          "description" TEXT,
          "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
          "reporterId" TEXT NOT NULL,
          "reportedEventId" TEXT,
          "reportedUserId" TEXT,
          "adminResponse" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "reviewedAt" TIMESTAMP(3),
          "reviewedById" TEXT,
          CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
        );
      `);
      console.log('✅ Таблица Complaint создана');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Таблица Complaint уже существует');
      } else {
        throw error;
      }
    }
    
    // Создаем индексы
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "Complaint_status_idx" ON "Complaint"("status");',
      'CREATE INDEX IF NOT EXISTS "Complaint_type_idx" ON "Complaint"("type");',
      'CREATE INDEX IF NOT EXISTS "Complaint_reporterId_idx" ON "Complaint"("reporterId");',
    ];
    
    for (const indexSql of indexes) {
      try {
        await prisma.$executeRawUnsafe(indexSql);
        console.log('✅ Индекс создан');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⚠️  Индекс уже существует');
        } else {
          console.error('⚠️  Ошибка создания индекса:', error.message);
        }
      }
    }
    
    // Добавляем внешние ключи
    const foreignKeys = [
      {
        name: 'Complaint_reporterId_fkey',
        sql: 'ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
      },
      {
        name: 'Complaint_reportedUserId_fkey',
        sql: 'ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
      },
      {
        name: 'Complaint_reportedEventId_fkey',
        sql: 'ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reportedEventId_fkey" FOREIGN KEY ("reportedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
      },
    ];
    
    for (const fk of foreignKeys) {
      try {
        await prisma.$executeRawUnsafe(fk.sql);
        console.log(`✅ Внешний ключ ${fk.name} добавлен`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Внешний ключ ${fk.name} уже существует`);
        } else {
          console.error(`⚠️  Ошибка добавления внешнего ключа ${fk.name}:`, error.message);
        }
      }
    }
    
    console.log('✅ Миграция успешно применена!');
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
