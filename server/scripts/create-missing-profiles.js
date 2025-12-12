const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMissingProfiles() {
  try {
    console.log('🔍 Ищем события без профилей...');
    
    // Получаем все события
    const allEvents = await prisma.event.findMany({
      select: { id: true, title: true, startTime: true, endTime: true, location: true, organizerId: true },
    });
    
    console.log(`Всего событий: ${allEvents.length}`);
    
    // Получаем все существующие профили
    const existingProfiles = await prisma.eventProfile.findMany({
      select: { eventId: true },
    });
    const existingProfileIds = new Set(existingProfiles.map(p => p.eventId));
    
    console.log(`Существующих профилей: ${existingProfiles.length}`);
    
    // Находим события без профилей
    const eventsWithoutProfiles = allEvents.filter(e => !existingProfileIds.has(e.id));
    
    console.log(`Событий без профилей: ${eventsWithoutProfiles.length}`);
    
    if (eventsWithoutProfiles.length === 0) {
      console.log('✅ Все события имеют профили');
      return;
    }
    
    // Создаем профили для событий без них
    for (const event of eventsWithoutProfiles) {
      try {
        // Получаем всех принятых участников события
        const acceptedMemberships = await prisma.eventMembership.findMany({
          where: {
            eventId: event.id,
            status: 'ACCEPTED',
          },
        });
        
        const participantIds = [event.organizerId, ...acceptedMemberships.map(m => m.userId)];
        const uniqueParticipantIds = Array.from(new Set(participantIds));
        
        // Форматируем дату и время
        const eventDate = new Date(event.startTime);
        const dateStr = eventDate.toISOString().split('T')[0];
        const timeStr = eventDate.toTimeString().split(' ')[0].substring(0, 5);
        
        // Создаем профиль
        const profile = await prisma.eventProfile.create({
          data: {
            eventId: event.id,
            name: event.title || 'Событие',
            description: null,
            date: dateStr,
            time: timeStr,
            location: event.location || null,
            avatar: null,
            isCompleted: event.endTime ? new Date(event.endTime) < new Date() : false,
            participants: {
              create: uniqueParticipantIds.map(userId => ({
                userId: userId,
              })),
            },
          },
        });
        
        console.log(`✅ Создан профиль для события "${event.title}" (${event.id}), участников: ${uniqueParticipantIds.length}`);
      } catch (error) {
        console.error(`❌ Ошибка при создании профиля для события ${event.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Готово! Создано профилей для ${eventsWithoutProfiles.length} событий`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingProfiles();

