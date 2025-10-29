import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import { useMemo, useState } from 'react';
import TopBar from '../../../components/TopBar';
import MessageFolders from '../../../components/MessageFolders';
import RequestsList from '../../../components/RequestsList';
import EventCard from '../../../components/EventCard';
import { useEvents } from '../../../context/EventsContext';
import { useRouter } from 'expo-router';

export default function InboxScreen() {
  const router = useRouter();
  const { messages, userFolders, getUserData, friendRequests, eventRequests, respondToFriendRequest, respondToEventRequest, events, getChatsForUser, getMyEventRequests, getEventOrganizer } = useEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showMyRequests, setShowMyRequests] = useState(false);

  // ТЕСТОВЫЕ ДАННЫЕ ЧАТОВ
  const testChats = [
    {
      id: 'chat-1',
      type: 'personal',
      name: 'Анна К.',
      participants: ['own-profile-1', 'user-5'],
      lastMessage: {
        text: 'Спасибо за вчерашний вечер!',
        createdAt: new Date(Date.now() - 1800000), // 30 минут назад
        fromUserId: 'user-5'
      }
    },
    {
      id: 'chat-2',
      type: 'personal',
      name: 'Дмитрий Р.',
      participants: ['own-profile-1', 'user-6'],
      lastMessage: {
        text: 'Когда встречаемся?',
        createdAt: new Date(Date.now() - 3600000), // 1 час назад
        fromUserId: 'user-6'
      }
    },
    {
      id: 'chat-3',
      type: 'event',
      name: '15.05 Встреча в парке',
      participants: ['own-profile-1', 'user-3', 'user-4'],
      lastMessage: {
        text: 'Во сколько встречаемся?',
        createdAt: new Date(Date.now() - 600000), // 10 минут назад
        fromUserId: 'user-3'
      }
    }
  ];

  // ТЕСТОВЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ
  const testUsers = {
    'user-5': {
      name: 'Анна К.',
      avatar: 'https://randomuser.me/api/portraits/women/22.jpg'
    },
    'user-6': {
      name: 'Дмитрий Р.',
      avatar: 'https://randomuser.me/api/portraits/men/15.jpg'
    },
    'user-3': {
      name: 'Иван С.',
      avatar: 'https://randomuser.me/api/portraits/men/44.jpg'
    },
    'user-4': {
      name: 'Ольга М.',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
    }
  };

  const handleChatPress = (chatId: string) => {
    console.log('Chat pressed:', chatId);
    router.push(`/(tabs)/inbox/${chatId}`);
  };

  // Функция поиска для inbox
  const handleInboxSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Обработка запросов
  const handleAcceptRequest = (requestId: string) => {
    // Находим тип запроса
    const friendReq = friendRequests.find(req => req.id === requestId);
    const eventReq = eventRequests.find(req => req.id === requestId);
    
    if (friendReq) {
      respondToFriendRequest(requestId, true);
    } else if (eventReq) {
      respondToEventRequest(requestId, true);
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
      // Для исходящих запросов переходим в профиль организатора с открытием события
      const event = events.find(e => e.id === request.eventId);
      if (event) {
        router.push(`/profile/${event.organizerId}?eventId=${request.eventId}`);
      }
    } else if (request.type === 'friend' && request.userId) {
      // Переход в профиль пользователя
      router.push(`/profile/${request.userId}`);
    }
  };

  const createMessageFolder = () => {
    // TODO: Реализовать создание папки сообщений
    console.log('Создание папки сообщений');
  };

  // Подготовленные сообщения с данными об отправителе
  const messagesWithMeta = useMemo(() => 
    messages.map((m) => ({
      ...m,
      sender: getUserData(m.fromUserId)
    })),
    [messages, getUserData]
  );

  // Поиск сообщений и чатов
  const searchMessages = (messagesList: any[], query: string) => {
    if (!query.trim()) return messagesList;
    const lowerQuery = query.toLowerCase();
    return messagesList.filter((message: any) => {
      // По тексту сообщения
      if ((message.text || '').toLowerCase().includes(lowerQuery)) return true;
      // По имени/юзернейму отправителя
      if (
        (message.sender?.name || '').toLowerCase().includes(lowerQuery) ||
        (message.sender?.username || '').toLowerCase().includes(lowerQuery)
      ) return true;
      return false;
    });
  };

  // Поиск папок пользователей
  const searchFolders = (foldersList: any[], query: string) => {
    if (!query.trim()) return foldersList;
    
    const lowerQuery = query.toLowerCase();
    return foldersList.filter(folder => 
      folder.name.toLowerCase().includes(lowerQuery)
    );
  };

  const filteredMessages = searchMessages(messagesWithMeta, searchQuery);
  const filteredFolders = searchFolders(userFolders, searchQuery);

  // Подготовка входящих запросов
  const incomingRequests = useMemo(() => {
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
    }> = [];
    
    // Запросы в друзья (к текущему пользователю)
    friendRequests
      .filter(req => req.toUserId === 'own-profile-1' && req.status === 'pending')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.fromUserId,
        });
      });
    
    // Запросы на участие в событиях (к текущему пользователю)
    eventRequests
      .filter(req => req.status === 'pending')
      .forEach(req => {
        // Проверяем, что событие организовано текущим пользователем
        const event = events.find(e => e.id === req.eventId);
        if (event && event.organizerId === 'own-profile-1') {
          requests.push({
            id: req.id,
            type: 'event' as const,
            eventId: req.eventId,
            userId: req.userId,
          });
        }
      });
    
    return requests;
  }, [friendRequests, eventRequests, events]);

  // Подготовка исходящих запросов
  const outgoingRequests = useMemo(() => {
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
      status?: 'pending' | 'accepted' | 'rejected';
    }> = [];
    
    // Запросы в друзья (от текущего пользователя)
    friendRequests
      .filter(req => req.fromUserId === 'own-profile-1')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.toUserId,
          status: req.status,
        });
      });
    
    // Исходящие запросы на события
    const myEventRequests = getMyEventRequests();
    myEventRequests.forEach(req => {
      const event = events.find(e => e.id === req.eventId);
      if (event) {
        requests.push({
          id: req.id,
          type: 'event' as const,
          eventId: req.eventId,
          userId: event.organizerId, // ID организатора для навигации
          status: req.status,
        });
      }
    });
    
    return requests;
  }, [friendRequests, getMyEventRequests, events]);

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder="Поиск сообщений и чатов..."
        onSearchChange={handleInboxSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
      />

      {/* Табы */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            Сообщения
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Запросы
          </Text>
        </TouchableOpacity>
      </View>

      {/* Папки сообщений (только для вкладки сообщений) */}
      {activeTab === 'messages' && (
        <MessageFolders
          folders={userFolders}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
          onCreateFolder={createMessageFolder}
        />
      )}

      {/* Контент */}
      <ScrollView style={styles.content}>
        {activeTab === 'messages' ? (
          <View style={styles.messagesContainer}>
            {/* ЧАТЫ */}
            <View style={styles.chatsSection}>
              {getChatsForUser('own-profile-1').length > 0 ? (
                getChatsForUser('own-profile-1').map((chat: any) => {
                  const otherParticipants = chat.participants.filter((id: string) => id !== 'own-profile-1');
                  const lastMessage = chat.lastMessage;

                  let chatDisplayName = chat.name; // для событийных чатов уже корректно
                  let chatAvatar = '';
                  
                  if (chat.type === 'personal' && otherParticipants.length > 0) {
                    const otherUser = getUserData(otherParticipants[0]);
                    chatDisplayName = otherUser.name;
                    chatAvatar = otherUser.avatar;
                  }

                  return (
                    <TouchableOpacity 
                      key={chat.id} 
                      style={styles.chatItem}
                      onPress={() => handleChatPress(chat.id)}
                    >
                      <View style={styles.chatAvatar}>
                        {chatAvatar ? (
                          <Image 
                            source={{ uri: chatAvatar }} 
                            style={styles.chatAvatarImage}
                          />
                        ) : (
                          <Text style={styles.chatAvatarText}>
                            {chat.type === 'event' ? '🎉' : '💬'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.chatInfo}>
                        <Text style={styles.chatName}>{chatDisplayName}</Text>
                        {lastMessage && (
                          <Text style={styles.lastMessage} numberOfLines={1}>
                            {lastMessage.text}
                          </Text>
                        )}
                      </View>
                      {lastMessage && (
                        <View style={styles.chatMeta}>
                          <Text style={styles.chatTime}>
                            {lastMessage.createdAt.toLocaleTimeString('ru-RU', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Нет чатов</Text>
                  <Text style={styles.emptySubtext}>Чаты появятся автоматически после принятия участников в события</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.requestsContainer}>
            {/* Кнопка "Мои запросы" */}
            <TouchableOpacity 
              style={styles.myRequestsButton}
              onPress={() => setShowMyRequests(!showMyRequests)}
            >
              <Text style={styles.myRequestsText}>
                Мои запросы
              </Text>
        </TouchableOpacity>

            {/* Список запросов */}
            <RequestsList
              requests={showMyRequests ? outgoingRequests : incomingRequests}
              isOutgoing={showMyRequests}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
              onRequestPress={handleRequestPress}
            />
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFF',
    fontSize: 18,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContainer: {
    paddingTop: 20,
  },
  chatsSection: {
    marginBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  chatAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  chatAvatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  chatTime: {
    color: '#666',
    fontSize: 12,
  },
  folderTag: {
    fontSize: 12,
    color: '#0066CC',
    marginTop: 8,
  },
  requestsContainer: {
    paddingTop: 20,
  },
  myRequestsButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  myRequestsText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
