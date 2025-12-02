import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TopBar from '../../../../components/TopBar';
import RequestsList from '../../../../components/RequestsList';
import NotificationItem from '../../../../components/NotificationItem';
import { useEvents } from '../../../../context/EventsContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '../../../../context/LanguageContext';
import { createLogger } from '../../../../utils/logger';

const logger = createLogger('RequestsTab');

export default function RequestsTab() {
  const router = useRouter();
  const { t } = useLanguage();
  const { 
    friendRequests, 
    eventRequests, 
    respondToFriendRequest, 
    respondToEventRequest, 
    events, 
    getMyEventRequests, 
    getEventOrganizer, 
    isEventUpcoming, 
    isUserOrganizer, 
    isUserEventMember, 
    getUserRequestStatus, 
    getUserFriendsList,
    getUserData,
    notifications,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useEvents();
  const { user: authUser } = useAuth();
  const [showMyRequests, setShowMyRequests] = useState(false);
  const currentUserId = authUser?.id ?? null;
  const hasVisitedIncomingRef = useRef(false);
  const visibleNotificationsRef = useRef<Set<string>>(new Set());

  // Загружаем уведомления при монтировании
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Фильтруем уведомления по типу (только уведомления о событиях, не запросы)
  const eventNotifications = useMemo(() => {
    return notifications.filter(n => 
      ['EVENT_CANCELLED', 'EVENT_UPDATED', 'EVENT_PARTICIPANT_JOINED', 'EVENT_PARTICIPANT_LEFT', 'EVENT_POST_ADDED'].includes(n.type)
    );
  }, [notifications]);

  // Отмечаем уведомления как прочитанные при выходе со страницы
  useFocusEffect(
    useCallback(() => {
      // При входе на страницу отмечаем, что пользователь зашел на вкладку "Входящие"
      if (!showMyRequests) {
        hasVisitedIncomingRef.current = true;
      }
      visibleNotificationsRef.current.clear();
      
      return () => {
        // При выходе со страницы отмечаем все непрочитанные уведомления как прочитанные
        // если пользователь был на вкладке "Входящие"
        if (hasVisitedIncomingRef.current && !showMyRequests) {
          const unreadNotifications = eventNotifications.filter(n => !n.readAt);
          if (unreadNotifications.length > 0) {
            logger.debug('Marking notifications as read on tab exit', { count: unreadNotifications.length });
            // Используем markAllNotificationsAsRead для более эффективной обработки
            markAllNotificationsAsRead();
          }
        }
      };
    }, [showMyRequests, eventNotifications, markAllNotificationsAsRead])
  );

  // Обработка запросов
  const handleAcceptRequest = (requestId: string) => {
    // Находим тип запроса
    const friendReq = friendRequests.find(req => req.id === requestId);
    const eventReq = eventRequests.find(req => req.id === requestId);
    
    if (friendReq) {
      respondToFriendRequest(requestId, true);
    } else if (eventReq) {
      // Для приглашений (invite) — НЕ принимаем сразу.
      // Открываем календарь в режиме preview, подтверждение внутри календаря.
      if (eventReq.type === 'invite') {
        const event = events.find(e => e.id === eventReq.eventId);
        if (event) {
          const isoDateTime = `${event.date}T${event.time}:00`;
          router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${event.id}&inviteId=${requestId}`);
          return;
        }
        // если событие не найдено, на всякий случай просто откроем календарь
        router.push('/calendar');
      } else {
        // Для обычных запросов - просто принимаем
        respondToEventRequest(requestId, true);
      }
    }
  };

  const handleDeclineRequest = (requestId: string) => {
    const friendReq = friendRequests.find(req => req.id === requestId);
    const eventReq = eventRequests.find(req => req.id === requestId);
    
    if (friendReq) {
      respondToFriendRequest(requestId, false);
    } else if (eventReq) {
      respondToEventRequest(requestId, false);
    }
  };

  // Обработка клика по мини-карточке запроса
  const handleRequestPress = (request: any) => {
    if (request.type === 'event' && request.eventId) {
      // Переходим в аккаунт события
      router.push(`/event-profile/${request.eventId}`);
    } else if (request.type === 'friend' && request.userId) {
      // Переход в профиль пользователя
      router.push(`/profile/${request.userId}`);
    }
  };

  // ВХОДЯЩИЕ ЗАПРОСЫ: 
  // 1. Запросы в друзья (ко мне)
  // 2. Приглашения на события (где меня пригласили)
  // 3. Запросы на участие в МОИХ событиях (где пользователь хочет присоединиться)
  const incomingRequests = useMemo(() => {
    if (!currentUserId) return [];
    
    logger.debug('incomingRequests: начинаем фильтрацию', { userId: currentUserId, totalRequests: eventRequests.length, invitesCount: eventRequests.filter(req => req.type === 'invite').length, incomingInvitesCount: eventRequests.filter(req => req.type === 'invite' && req.toUserId === currentUserId).length });
    
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
      isInvite?: boolean;
    }> = [];
    
    // Запросы в друзья (к текущему пользователю)
    friendRequests
      .filter(req => req.toUserId === currentUserId && req.status === 'pending')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.fromUserId,
        });
      });
    
    // ВХОДЯЩИЕ приглашения на события (где МЕНЯ пригласили)
    // Показываем только pending приглашения (accepted уже обработаны, rejected не показываем)
    eventRequests
      .filter(req => req.status === 'pending' && req.type === 'invite' && req.toUserId === currentUserId)
      .forEach(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event) {
          logger.warn('Событие не найдено для приглашения', { eventId: req.eventId });
          return;
        }
        
        // Проверка: приглашать может ТОЛЬКО организатор события
        if (req.fromUserId !== event.organizerId) {
          logger.warn('Приглашение от не-организатора', { fromUserId: req.fromUserId, organizerId: event.organizerId });
          return;
        }
        
        // Проверка: приглашать может ТОЛЬКО тот, у кого я в списке друзей
        const organizerFriends = getUserFriendsList(req.fromUserId);
        const amIInOrganizerFriends = organizerFriends.some(f => f.id === currentUserId);
        if (!amIInOrganizerFriends) {
          logger.warn('Организатор не в списке друзей', { organizerId: req.fromUserId, currentUserId });
          return;
        }
        
        // Проверка: НЕ показываем приглашение, если от того же пользователя есть pending friend request
        const hasPendingFriendRequest = friendRequests.some(fr => 
          fr.status === 'pending' &&
          ((fr.fromUserId === req.fromUserId && fr.toUserId === currentUserId) ||
           (fr.fromUserId === currentUserId && fr.toUserId === req.fromUserId))
        );
        if (hasPendingFriendRequest) {
          logger.debug('Есть pending friend request, скрываем приглашение');
          return;
        }
        
        // Проверка: организатор не может быть приглашен на свое же событие
        if (isUserOrganizer(event, currentUserId)) {
          logger.debug('Пользователь является организатором события');
          return;
        }
        
        // Проверка: нельзя приглашать, если я уже член события
        if (isUserEventMember(event, currentUserId)) {
          logger.debug('Пользователь уже является членом события');
          return;
        }
        
        logger.debug('Добавляем входящее приглашение', { id: req.id, eventId: req.eventId, fromUserId: req.fromUserId });
        requests.push({
          id: req.id,
          type: 'event' as const,
          eventId: req.eventId,
          userId: req.fromUserId,
          isInvite: true,
        });
      });
    
    logger.debug('incomingRequests: после фильтрации приглашений', { addedInvites: requests.filter(r => r.type === 'event' && r.isInvite).length });
    
    // ВХОДЯЩИЕ запросы на участие в МОИХ событиях
    // Для бизнес-аккаунтов показываем accepted запросы как уведомления о присоединении
    eventRequests
      .filter(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event || !isEventUpcoming(event) || !isUserOrganizer(event, currentUserId)) {
          return false;
        }
        
        const organizerData = getUserData(event.organizerId);
        const isBusinessAccount = organizerData?.accountType === 'business';
        
        // Для бизнес-аккаунтов показываем accepted запросы, для обычных - только pending
        if (isBusinessAccount) {
          return (req.status === 'accepted' || req.status === 'pending') && (!req.type || req.type === 'join');
        } else {
          return req.status === 'pending' && (!req.type || req.type === 'join');
        }
      })
      .forEach(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event) return;
        
        const requesterUserId = req.userId;
        if (requesterUserId === event.organizerId) {
          return;
        }
        
        const organizerData = getUserData(event.organizerId);
        const isBusinessAccount = organizerData?.accountType === 'business';
        
        requests.push({
          id: req.id,
          type: 'event' as const,
          eventId: req.eventId,
          userId: requesterUserId,
          status: req.status, // Передаем статус для отображения
          isBusinessAccount: isBusinessAccount, // Флаг для бизнес-аккаунта
        });
      });
    
    logger.debug('incomingRequests: итоговое количество запросов', { total: requests.length, invites: requests.filter(r => r.type === 'event' && r.isInvite).length });
    return requests;
  }, [friendRequests, eventRequests, events, isEventUpcoming, isUserOrganizer, isUserEventMember, getUserFriendsList, getUserData, currentUserId]);

  // МОИ ЗАПРОСЫ
  const outgoingRequests = useMemo(() => {
    if (!currentUserId) return [];
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
      status?: 'pending' | 'accepted' | 'rejected';
      isInvite?: boolean;
    }> = [];
    
    // Запросы в друзья (от текущего пользователя)
    friendRequests
      .filter(req => req.fromUserId === currentUserId && req.status !== 'rejected')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.toUserId,
          status: req.status,
        });
      });
    
    // Исходящие запросы на события и приглашения
    const myEventRequests = getMyEventRequests();
    myEventRequests.forEach(req => {
      const event = events.find(e => e.id === req.eventId);
      if (!event) {
        return;
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Для приглашений (type: 'invite')
      // В исходящие попадают только приглашения, где Я - отправитель (fromUserId === currentUserId)
      // Входящие приглашения (где Я - получатель, toUserId === currentUserId) уже обрабатываются в incomingRequests
      if (req.type === 'invite' && req.fromUserId === currentUserId) {
        // Показываем все статусы для исходящих приглашений (pending, accepted, rejected)
        // Но отклоненные (rejected) не показываем, так как они должны исчезнуть
        if (req.status !== 'rejected') {
          requests.push({
            id: req.id,
            type: 'event' as const,
            eventId: req.eventId,
            userId: req.toUserId,
            status: req.status,
            isInvite: true,
          });
        }
      } 
      // Для обычных запросов на участие (join)
      else if (req.type === 'join' || !req.type) {
        if (isEventUpcoming(event) && !isUserOrganizer(event, currentUserId)) {
          const requestStatus = getUserRequestStatus(event, currentUserId);
          if (requestStatus === 'pending' || requestStatus === 'accepted') {
            requests.push({
              id: req.id,
              type: 'event' as const,
              eventId: req.eventId,
              userId: event.organizerId,
              status: req.status,
              isInvite: false,
            });
          }
        }
      }
    });
    
    return requests;
  }, [friendRequests, getMyEventRequests, events, isEventUpcoming, isUserOrganizer, getUserRequestStatus, currentUserId]);

  return (
    <View style={styles.container}>
      {/* Переключатель входящие/исходящие */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleButton, !showMyRequests && styles.toggleButtonActive]}
          onPress={() => setShowMyRequests(false)}
        >
          <Text style={[styles.toggleText, !showMyRequests && styles.toggleTextActive]}>
            {t.inbox.incoming || 'Incoming'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleButton, showMyRequests && styles.toggleButtonActive]}
          onPress={() => setShowMyRequests(true)}
        >
          <Text style={[styles.toggleText, showMyRequests && styles.toggleTextActive]}>
            {t.inbox.outgoing || 'Outgoing'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {!showMyRequests ? (
          // ВХОДЯЩИЕ ЗАПРОСЫ И УВЕДОМЛЕНИЯ - все вместе без разделения
          <View style={styles.section}>
            {/* Уведомления и запросы вместе */}
            {eventNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onPress={() => markNotificationAsRead(notification.id)}
                onDelete={() => deleteNotification(notification.id)}
              />
            ))}
            
            {incomingRequests.length > 0 && (
              <RequestsList
                requests={incomingRequests.map(req => {
                  // Находим оригинальный запрос для получения createdAt
                  const friendReq = friendRequests.find(fr => fr.id === req.id);
                  const eventReq = eventRequests.find(er => er.id === req.id);
                  const originalRequest = friendReq || eventReq;
                  
                  return {
                    id: req.id,
                    type: req.type,
                    eventId: req.eventId,
                    userId: req.userId,
                    isInvite: req.isInvite,
                    status: (req as any).status,
                    isBusinessAccount: (req as any).isBusinessAccount,
                    createdAt: originalRequest?.createdAt,
                  };
                })}
                onAccept={handleAcceptRequest}
                onDecline={handleDeclineRequest}
                onRequestPress={handleRequestPress}
              />
            )}
            
            {eventNotifications.length === 0 && incomingRequests.length === 0 && (
              <Text style={styles.emptyText}>{t.inbox.noIncomingRequests || 'No incoming requests'}</Text>
            )}
          </View>
        ) : (
          // МОИ ЗАПРОСЫ
          <View style={styles.section}>
            {outgoingRequests.length > 0 ? (
              <RequestsList
                requests={outgoingRequests.map(req => {
                  // Находим оригинальный запрос для получения createdAt
                  const friendReq = friendRequests.find(fr => fr.id === req.id);
                  const eventReq = eventRequests.find(er => er.id === req.id);
                  const originalRequest = friendReq || eventReq;
                  
                  return {
                    id: req.id,
                    type: req.type,
                    eventId: req.eventId,
                    userId: req.userId,
                    status: req.status,
                    isInvite: req.isInvite,
                    createdAt: originalRequest?.createdAt,
                  };
                })}
                isOutgoing={true}
                onRequestPress={handleRequestPress}
              />
            ) : (
              <Text style={styles.emptyText}>{t.inbox.noOutgoingRequests || 'No outgoing requests'}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  toggleText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  subsectionTitle: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  notificationsSection: {
    marginBottom: 10,
  },
  requestsSection: {
    marginTop: 10,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});

