/**
 * Скрипт для удаления всех событий и профилей событий из базы данных
 * Использование: npx ts-node scripts/delete-all-events.ts
 * 
 * ВНИМАНИЕ: Этот скрипт удаляет ВСЕ события и профили событий из базы данных!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllEvents() {
  try {
    console.log('🚨 ВНИМАНИЕ: Начинается удаление ВСЕХ событий и профилей событий...');
    console.log('Это действие необратимо!');
    
    // Подсчитываем количество записей перед удалением
    const eventsCount = await prisma.event.count();
    const profilesCount = await prisma.eventProfile.count();
    const membershipsCount = await prisma.eventMembership.count();
    const personalPhotosCount = await prisma.eventPersonalPhoto.count();
    const participationsCount = await prisma.userEventParticipation.count();
    const profilePostsCount = await prisma.eventProfilePost.count();
    const profileParticipantsCount = await prisma.eventProfileParticipant.count();
    const eventChats = await prisma.chat.findMany({
      where: { eventId: { not: null } },
      select: { id: true }
    });
    const eventChatIds = eventChats.map(chat => chat.id);
    const eventChatsCount = eventChats.length;
    const eventMessagesCount = eventChatIds.length > 0 
      ? await prisma.message.count({ where: { chatId: { in: eventChatIds } } })
      : 0;
    const eventDirectMessagesCount = await prisma.message.count({ where: { eventId: { not: null } } });
    const eventComplaintsCount = await prisma.complaint.count({ where: { reportedEventId: { not: null } } });
    
    console.log('\n📊 Статистика перед удалением:');
    console.log(`  - Событий: ${eventsCount}`);
    console.log(`  - Профилей событий: ${profilesCount}`);
    console.log(`  - Членств в событиях: ${membershipsCount}`);
    console.log(`  - Персональных фото: ${personalPhotosCount}`);
    console.log(`  - Участий пользователей: ${participationsCount}`);
    console.log(`  - Постов в профилях: ${profilePostsCount}`);
    console.log(`  - Участников профилей: ${profileParticipantsCount}`);
    console.log(`  - Чатов событий: ${eventChatsCount}`);
    console.log(`  - Сообщений в чатах событий: ${eventMessagesCount}`);
    console.log(`  - Сообщений напрямую связанных с событиями: ${eventDirectMessagesCount}`);
    console.log(`  - Жалоб на события: ${eventComplaintsCount}`);
    
    console.log('\n🗑️  Начинаем удаление...\n');
    
    // Удаляем в правильном порядке (чтобы избежать ошибок внешних ключей)
    
    // 1. Удаляем посты в профилях событий
    console.log('1. Удаление постов в профилях событий...');
    const deletedPosts = await prisma.eventProfilePost.deleteMany({});
    console.log(`   ✅ Удалено постов: ${deletedPosts.count}`);
    
    // 2. Удаляем участников профилей событий
    console.log('2. Удаление участников профилей событий...');
    const deletedProfileParticipants = await prisma.eventProfileParticipant.deleteMany({});
    console.log(`   ✅ Удалено участников профилей: ${deletedProfileParticipants.count}`);
    
    // 3. Удаляем профили событий (onDelete: Cascade удалит связанные посты и участников)
    console.log('3. Удаление профилей событий...');
    const deletedProfiles = await prisma.eventProfile.deleteMany({});
    console.log(`   ✅ Удалено профилей: ${deletedProfiles.count}`);
    
    // 4. Удаляем персональные фото событий
    console.log('4. Удаление персональных фото событий...');
    const deletedPhotos = await prisma.eventPersonalPhoto.deleteMany({});
    console.log(`   ✅ Удалено персональных фото: ${deletedPhotos.count}`);
    
    // 5. Удаляем участия пользователей в событиях
    console.log('5. Удаление участий пользователей в событиях...');
    const deletedParticipations = await prisma.userEventParticipation.deleteMany({});
    console.log(`   ✅ Удалено участий: ${deletedParticipations.count}`);
    
    // 6. Удаляем членства в событиях
    console.log('6. Удаление членств в событиях...');
    const deletedMemberships = await prisma.eventMembership.deleteMany({});
    console.log(`   ✅ Удалено членств: ${deletedMemberships.count}`);
    
    // 7. Удаляем чаты, связанные с событиями (сначала удаляем участников чатов и сообщения)
    console.log('7. Поиск чатов событий...');
    const eventChatsForDeletion = await prisma.chat.findMany({
      where: { eventId: { not: null } },
      select: { id: true }
    });
    const chatIds = eventChatsForDeletion.map(chat => chat.id);
    
    let deletedMessages = { count: 0 };
    if (chatIds.length > 0) {
      // Удаляем все сообщения из чатов событий
      console.log('8. Удаление сообщений из чатов событий...');
      deletedMessages = await prisma.message.deleteMany({
        where: { chatId: { in: chatIds } }
      });
      console.log(`   ✅ Удалено сообщений: ${deletedMessages.count}`);
      
      // Удаляем участников чатов событий
      console.log('9. Удаление участников чатов событий...');
      const deletedChatParticipants = await prisma.chatParticipant.deleteMany({
        where: { chatId: { in: chatIds } }
      });
      console.log(`   ✅ Удалено участников чатов: ${deletedChatParticipants.count}`);
      
      // Удаляем связи чатов с папками
      console.log('10. Удаление связей чатов с папками...');
      const deletedFolderChats = await prisma.folderChat.deleteMany({
        where: { chatId: { in: chatIds } }
      });
      console.log(`   ✅ Удалено связей чатов с папками: ${deletedFolderChats.count}`);
      
      // Обновляем lastMessageId в чатах на null (если есть)
      await prisma.chat.updateMany({
        where: { id: { in: chatIds }, lastMessageId: { not: null } },
        data: { lastMessageId: null }
      });
    } else {
      console.log('8. Чатов событий не найдено, пропускаем удаление сообщений и участников');
    }
    
    // Удаляем сами чаты событий
    console.log('11. Удаление чатов событий...');
    const deletedChats = await prisma.chat.deleteMany({
      where: { eventId: { not: null } }
    });
    console.log(`   ✅ Удалено чатов: ${deletedChats.count}`);
    
    // Удаляем сообщения, связанные с событиями напрямую (если есть)
    console.log('12. Удаление сообщений, напрямую связанных с событиями...');
    const deletedEventMessages = await prisma.message.deleteMany({
      where: { eventId: { not: null } }
    });
    console.log(`   ✅ Удалено сообщений: ${deletedEventMessages.count}`);
    
    // 13. Удаляем жалобы на события
    console.log('13. Удаление жалоб на события...');
    const deletedComplaints = await prisma.complaint.deleteMany({
      where: { reportedEventId: { not: null } }
    });
    console.log(`   ✅ Удалено жалоб: ${deletedComplaints.count}`);
    
    // 14. Удаляем сами события (в последнюю очередь)
    console.log('14. Удаление событий...');
    const deletedEvents = await prisma.event.deleteMany({});
    console.log(`   ✅ Удалено событий: ${deletedEvents.count}`);
    
    console.log('\n✅ Удаление завершено успешно!');
    console.log('\n📊 Итоговая статистика:');
    console.log(`  - Удалено событий: ${deletedEvents.count}`);
    console.log(`  - Удалено профилей: ${deletedProfiles.count}`);
    console.log(`  - Удалено членств: ${deletedMemberships.count}`);
    console.log(`  - Удалено персональных фото: ${deletedPhotos.count}`);
    console.log(`  - Удалено участий: ${deletedParticipations.count}`);
    console.log(`  - Удалено постов: ${deletedPosts.count}`);
    console.log(`  - Удалено участников профилей: ${deletedProfileParticipants.count}`);
    console.log(`  - Удалено чатов: ${deletedChats.count}`);
    const totalDeletedMessages = (chatIds.length > 0 ? deletedMessages.count : 0) + deletedEventMessages.count;
    console.log(`  - Удалено сообщений: ${totalDeletedMessages} (${chatIds.length > 0 ? deletedMessages.count : 0} из чатов + ${deletedEventMessages.count} напрямую связанных)`);
    console.log(`  - Удалено жалоб: ${deletedComplaints.count}`);
    
  } catch (error) {
    console.error('❌ Ошибка при удалении событий:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
deleteAllEvents()
  .then(() => {
    console.log('\n✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

