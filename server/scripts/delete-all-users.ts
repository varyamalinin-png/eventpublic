/**
 * Скрипт для удаления всех пользователей (аккаунтов) из базы данных
 * Использование: npx ts-node scripts/delete-all-users.ts
 * 
 * ВНИМАНИЕ: Этот скрипт удаляет ВСЕХ пользователей и ВСЕ связанные данные из базы данных!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllUsers() {
  try {
    console.log('🚨 ВНИМАНИЕ: Начинается удаление ВСЕХ пользователей и всех связанных данных...');
    console.log('Это действие необратимо!');
    console.log('Подключение к базе данных...');
    
    // Подсчитываем количество записей перед удалением
    const usersCount = await prisma.user.count();
    const tokensCount = await prisma.refreshToken.count();
    const emailTokensCount = await prisma.emailVerificationToken.count();
    const passwordTokensCount = await prisma.passwordResetToken.count();
    const notificationsCount = await prisma.notification.count();
    const friendshipsCount = await prisma.friendship.count();
    const foldersCount = await prisma.folder.count();
    const userFoldersCount = await prisma.userFolder.count();
    const chatsCount = await prisma.chat.count();
    const messagesCount = await prisma.message.count();
    const complaintsCount = await prisma.complaint.count();
    
    console.log('\n📊 Статистика перед удалением:');
    console.log(`  - Пользователей: ${usersCount}`);
    console.log(`  - Токенов обновления: ${tokensCount}`);
    console.log(`  - Токенов верификации email: ${emailTokensCount}`);
    console.log(`  - Токенов сброса пароля: ${passwordTokensCount}`);
    console.log(`  - Уведомлений: ${notificationsCount}`);
    console.log(`  - Дружеских связей: ${friendshipsCount}`);
    console.log(`  - Папок: ${foldersCount}`);
    console.log(`  - Папок пользователей: ${userFoldersCount}`);
    console.log(`  - Чатов: ${chatsCount}`);
    console.log(`  - Сообщений: ${messagesCount}`);
    console.log(`  - Жалоб: ${complaintsCount}`);
    
    console.log('\n🗑️  Начинаем удаление...\n');
    
    // Удаляем в правильном порядке (чтобы избежать ошибок внешних ключей)
    
    // 1. Удаляем токены
    console.log('1. Удаление токенов...');
    const deletedRefreshTokens = await prisma.refreshToken.deleteMany({});
    console.log(`   ✅ Удалено токенов обновления: ${deletedRefreshTokens.count}`);
    
    const deletedEmailTokens = await prisma.emailVerificationToken.deleteMany({});
    console.log(`   ✅ Удалено токенов верификации email: ${deletedEmailTokens.count}`);
    
    const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({});
    console.log(`   ✅ Удалено токенов сброса пароля: ${deletedPasswordTokens.count}`);
    
    // 2. Удаляем уведомления
    console.log('2. Удаление уведомлений...');
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`   ✅ Удалено уведомлений: ${deletedNotifications.count}`);
    
    // 3. Удаляем жалобы
    console.log('3. Удаление жалоб...');
    const deletedComplaints = await prisma.complaint.deleteMany({});
    console.log(`   ✅ Удалено жалоб: ${deletedComplaints.count}`);
    
    // 4. Удаляем дружеские связи
    console.log('4. Удаление дружеских связей...');
    const deletedFriendships = await prisma.friendship.deleteMany({});
    console.log(`   ✅ Удалено дружеских связей: ${deletedFriendships.count}`);
    
    // 5. Удаляем персональные фото событий
    console.log('5. Удаление персональных фото событий...');
    const deletedPersonalPhotos = await prisma.eventPersonalPhoto.deleteMany({});
    console.log(`   ✅ Удалено персональных фото: ${deletedPersonalPhotos.count}`);
    
    // 6. Удаляем посты в профилях событий
    console.log('6. Удаление постов в профилях событий...');
    const deletedProfilePosts = await prisma.eventProfilePost.deleteMany({});
    console.log(`   ✅ Удалено постов: ${deletedProfilePosts.count}`);
    
    // 7. Удаляем участников профилей событий
    console.log('7. Удаление участников профилей событий...');
    const deletedProfileParticipants = await prisma.eventProfileParticipant.deleteMany({});
    console.log(`   ✅ Удалено участников профилей: ${deletedProfileParticipants.count}`);
    
    // 8. Удаляем участия пользователей в событиях
    console.log('8. Удаление участий пользователей в событиях...');
    const deletedParticipations = await prisma.userEventParticipation.deleteMany({});
    console.log(`   ✅ Удалено участий: ${deletedParticipations.count}`);
    
    // 9. Удаляем членства в событиях
    console.log('9. Удаление членств в событиях...');
    const deletedMemberships = await prisma.eventMembership.deleteMany({});
    console.log(`   ✅ Удалено членств: ${deletedMemberships.count}`);
    
    // 10. Удаляем связи папок пользователей
    console.log('10. Удаление связей папок пользователей...');
    const deletedUserFolderUsers = await prisma.userFolderUser.deleteMany({});
    console.log(`   ✅ Удалено связей папок пользователей: ${deletedUserFolderUsers.count}`);
    
    // 11. Удаляем папки пользователей
    console.log('11. Удаление папок пользователей...');
    const deletedUserFolders = await prisma.userFolder.deleteMany({});
    console.log(`   ✅ Удалено папок пользователей: ${deletedUserFolders.count}`);
    
    // 12. Удаляем сообщения
    console.log('12. Удаление сообщений...');
    // Сначала обновляем lastMessageId в чатах на null
    await prisma.chat.updateMany({
      where: { lastMessageId: { not: null } },
      data: { lastMessageId: null }
    });
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`   ✅ Удалено сообщений: ${deletedMessages.count}`);
    
    // 13. Удаляем участников чатов
    console.log('13. Удаление участников чатов...');
    const deletedChatParticipants = await prisma.chatParticipant.deleteMany({});
    console.log(`   ✅ Удалено участников чатов: ${deletedChatParticipants.count}`);
    
    // 14. Удаляем связи чатов с папками
    console.log('14. Удаление связей чатов с папками...');
    const deletedFolderChats = await prisma.folderChat.deleteMany({});
    console.log(`   ✅ Удалено связей чатов с папками: ${deletedFolderChats.count}`);
    
    // 15. Удаляем папки
    console.log('15. Удаление папок...');
    const deletedFolders = await prisma.folder.deleteMany({});
    console.log(`   ✅ Удалено папок: ${deletedFolders.count}`);
    
    // 16. Удаляем чаты
    console.log('16. Удаление чатов...');
    const deletedChats = await prisma.chat.deleteMany({});
    console.log(`   ✅ Удалено чатов: ${deletedChats.count}`);
    
    // 17. Удаляем ключи персональных чатов
    console.log('17. Удаление ключей персональных чатов...');
    const deletedPersonalChatKeys = await prisma.personalChatKey.deleteMany({});
    console.log(`   ✅ Удалено ключей персональных чатов: ${deletedPersonalChatKeys.count}`);
    
    // 18. Удаляем профили событий (они связаны с событиями, но события уже удалены или будут удалены)
    console.log('18. Удаление профилей событий...');
    const deletedProfiles = await prisma.eventProfile.deleteMany({});
    console.log(`   ✅ Удалено профилей событий: ${deletedProfiles.count}`);
    
    // 19. Удаляем события (если они еще остались)
    console.log('19. Удаление событий...');
    const deletedEvents = await prisma.event.deleteMany({});
    console.log(`   ✅ Удалено событий: ${deletedEvents.count}`);
    
    // 20. Удаляем самих пользователей (в последнюю очередь)
    console.log('20. Удаление пользователей...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   ✅ Удалено пользователей: ${deletedUsers.count}`);
    
    console.log('\n✅ Удаление завершено успешно!');
    console.log('\n📊 Итоговая статистика:');
    console.log(`  - Удалено пользователей: ${deletedUsers.count}`);
    console.log(`  - Удалено токенов обновления: ${deletedRefreshTokens.count}`);
    console.log(`  - Удалено токенов верификации email: ${deletedEmailTokens.count}`);
    console.log(`  - Удалено токенов сброса пароля: ${deletedPasswordTokens.count}`);
    console.log(`  - Удалено уведомлений: ${deletedNotifications.count}`);
    console.log(`  - Удалено дружеских связей: ${deletedFriendships.count}`);
    console.log(`  - Удалено папок: ${deletedFolders.count}`);
    console.log(`  - Удалено папок пользователей: ${deletedUserFolders.count}`);
    console.log(`  - Удалено чатов: ${deletedChats.count}`);
    console.log(`  - Удалено сообщений: ${deletedMessages.count}`);
    console.log(`  - Удалено жалоб: ${deletedComplaints.count}`);
    console.log(`  - Удалено событий: ${deletedEvents.count}`);
    console.log(`  - Удалено профилей событий: ${deletedProfiles.count}`);
    
  } catch (error: any) {
    console.error('❌ Ошибка при удалении пользователей:', error);
    console.error('Детали ошибки:', error?.message);
    console.error('Stack:', error?.stack);
    throw error;
  } finally {
    console.log('\nЗакрытие соединения с базой данных...');
    await prisma.$disconnect();
    console.log('Соединение закрыто.');
  }
}

// Запускаем скрипт
deleteAllUsers()
  .then(() => {
    console.log('\n✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });


