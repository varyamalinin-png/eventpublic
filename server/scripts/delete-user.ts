/**
 * Скрипт для удаления пользователя из базы данных
 * Использование: npx ts-node scripts/delete-user.ts <email>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser(email: string) {
  try {
    console.log(`Поиск пользователя с email: ${email}...`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log(`❌ Пользователь с email ${email} не найден`);
      return;
    }

    console.log(`Найден пользователь:`, user);
    console.log(`Удаление пользователя и всех связанных данных...`);

    // Удаляем все связанные данные в правильном порядке (чтобы избежать ошибок внешних ключей)
    
    // 1. Токены
    console.log(`Удаление токенов...`);
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    
    // 2. Уведомления
    console.log(`Удаление уведомлений...`);
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    
    // 3. Жалобы (где пользователь репортер или объект жалобы)
    console.log(`Удаление жалоб...`);
    await prisma.complaint.deleteMany({ 
      where: { 
        OR: [
          { reporterId: user.id },
          { reportedUserId: user.id }
        ]
      } 
    });
    
    // 4. Участие в событиях
    console.log(`Удаление участий в событиях...`);
    await prisma.userEventParticipation.deleteMany({ where: { userId: user.id } });
    await prisma.eventProfileParticipant.deleteMany({ where: { userId: user.id } });
    await prisma.eventMembership.deleteMany({ where: { userId: user.id } });
    
    // 5. Посты в профилях событий
    console.log(`Удаление постов в профилях событий...`);
    await prisma.eventProfilePost.deleteMany({ where: { authorId: user.id } });
    
    // 6. Личные фото событий
    console.log(`Удаление личных фото...`);
    await prisma.eventPersonalPhoto.deleteMany({ where: { userId: user.id } });
    
    // 7. Сообщения в чатах
    console.log(`Удаление сообщений...`);
    await prisma.message.deleteMany({ where: { senderId: user.id } });
    
    // 8. Участие в чатах
    console.log(`Удаление участий в чатах...`);
    await prisma.chatParticipant.deleteMany({ where: { userId: user.id } });
    
    // 9. Дружбы
    console.log(`Удаление дружб...`);
    await prisma.friendship.deleteMany({ 
      where: { 
        OR: [
          { requesterId: user.id },
          { addresseeId: user.id }
        ]
      } 
    });
    
    // 10. Папки и пользовательские папки
    console.log(`Удаление папок...`);
    await prisma.userFolderUser.deleteMany({ where: { userId: user.id } });
    await prisma.userFolder.deleteMany({ where: { ownerId: user.id } });
    await prisma.folder.deleteMany({ where: { ownerId: user.id } });
    
    // 11. События, где пользователь организатор (удаляем все связанные данные событий)
    console.log(`Удаление событий, где пользователь организатор...`);
    const organizedEvents = await prisma.event.findMany({ 
      where: { organizerId: user.id },
      select: { id: true }
    });
    
    for (const event of organizedEvents) {
      // Получаем профиль события для удаления связанных данных
      const eventProfile = await prisma.eventProfile.findUnique({
        where: { eventId: event.id },
        select: { id: true }
      });
      
      if (eventProfile) {
        // Удаляем посты в профиле события
        await prisma.eventProfilePost.deleteMany({ where: { profileId: eventProfile.id } });
        // Удаляем участников профиля события
        await prisma.eventProfileParticipant.deleteMany({ where: { profileId: eventProfile.id } });
        // Удаляем профиль события
        await prisma.eventProfile.delete({ where: { id: eventProfile.id } });
      }
      
      // Удаляем остальные связанные данные события
      await prisma.userEventParticipation.deleteMany({ where: { eventId: event.id } });
      await prisma.eventPersonalPhoto.deleteMany({ where: { eventId: event.id } });
      await prisma.eventMembership.deleteMany({ where: { eventId: event.id } });
      await prisma.chatParticipant.deleteMany({ where: { chatId: event.id } });
      await prisma.message.deleteMany({ where: { chatId: event.id } });
      // Удаляем чат события, если он существует
      await prisma.chat.deleteMany({ where: { eventId: event.id } });
      // Удаляем само событие
      await prisma.event.delete({ where: { id: event.id } });
    }
    
    console.log(`Удалено ${organizedEvents.length} событий, где пользователь был организатором`);

    // 12. Удаляем пользователя
    console.log(`Удаление пользователя...`);
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log(`✅ Пользователь ${email} и все связанные данные успешно удалены из базы данных`);
  } catch (error: any) {
    console.error(`❌ Ошибка при удалении пользователя:`, error?.message || error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Использование: npx ts-node scripts/delete-user.ts <email>');
  process.exit(1);
}

deleteUser(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

