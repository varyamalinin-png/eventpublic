import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../../../context/EventsContext';
import { useLanguage } from '../../../context/LanguageContext';
import ParticipantsModal from '../../../components/ParticipantsModal';
import EventCard from '../../../components/EventCard';
import MemoryMiniCard from '../../../components/MemoryMiniCard';
import { useAuth } from '../../../context/AuthContext';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ChatScreen');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    getChat,
    sendChatMessage,
    getUserData,
    chatMessages,
    events,
    getEventProfile,
  } = useEvents();
  const [inputText, setInputText] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const chat = chatId ? getChat(chatId as string) : null;
  const currentUserId = useMemo(() => user?.id ?? null, [user]);

  const messages = useMemo(() => {
    if (!chatId) return [];
    return chatMessages
      .filter(message => message.chatId === chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [chatMessages, chatId]);

  useEffect(() => {
    if (!chatId) return;
    
    // Подключаемся к комнате чата через WebSocket для получения сообщений в реальном времени
    const socket = require('../../../services/websocket').getSocket();
    if (socket && socket.connected) {
      // Используем событие chat:join из namespace /ws/chats
      // Или просто отправляем в общий namespace
      socket.emit('chat:join', { chatId });
      logger.info('Подключились к комнате чата', { chatId });
    }

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatId, messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId) return;
    if (!currentUserId) {
      router.push('/(auth)');
      return;
    }
    if (isSending) return;

    try {
      setIsSending(true);
      await sendChatMessage(chatId as string, inputText.trim());
      setInputText('');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (error) {
      logger.error('Failed to send chat message', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isOwn = currentUserId ? message.fromUserId === currentUserId : false;
    const sender = getUserData(message.fromUserId);
    
    // Если сообщение содержит меморис пост, показываем мини-карточку поста
    if (message.postId && message.eventId) {
      const eventProfile = getEventProfile(message.eventId);
      const post = eventProfile?.posts.find(p => p.id === message.postId);
      
      if (post) {
        return (
          <View
            key={index}
            style={[
              styles.messageWrapper,
              isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper
            ]}
          >
            {!isOwn && (
              <Image
                source={{ uri: sender?.avatar || 'https://randomuser.me/api/portraits/women/22.jpg' }}
                style={styles.avatar}
                onError={() => {}}
              />
            )}
            <View
              style={[
                styles.eventMessageContainer,
                isOwn ? styles.ownEventMessage : styles.otherEventMessage
              ]}
            >
              <TouchableOpacity 
                onPress={() => router.push(`/memory-post/${post.eventId}/${post.id}`)}
                style={{ width: (SCREEN_WIDTH - 2) / 3 }}
              >
                <MemoryMiniCard post={post} />
              </TouchableOpacity>
              <Text style={styles.messageTime}>
                {message.createdAt.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
        );
      }
    }
    
    // Если сообщение содержит событие, показываем мини-карточку
    if (message.eventId) {
      const event = events.find(e => e.id === message.eventId);
      
      if (!event) {
        logger.warn('Event not found for eventId', { eventId: message.eventId, availableEvents: events.map(e => e.id) });
        // Если событие не найдено, показываем заглушку
        return (
          <View
            key={index}
            style={[
              styles.messageWrapper,
              isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper
            ]}
          >
            {!isOwn && (
              <Image
                source={{ uri: sender?.avatar || 'https://randomuser.me/api/portraits/women/22.jpg' }}
                style={styles.avatar}
                onError={() => {}}
              />
            )}
            <View
              style={[
                styles.eventMessageContainer,
                isOwn ? styles.ownEventMessage : styles.otherEventMessage
              ]}
            >
              <View style={styles.eventPlaceholder}>
                <Text style={styles.eventPlaceholderText}>Событие не найдено</Text>
                <Text style={styles.eventPlaceholderSubtext}>ID: {message.eventId}</Text>
              </View>
              <Text style={styles.messageTime}>
                {message.createdAt.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
        );
      }
      
      if (event) {
        logger.debug('Rendering event card for chat', { eventId: event.id, eventTitle: event.title, variant: 'chat_preview' });
        return (
          <View
            key={index}
            style={[
              styles.messageWrapper,
              isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper
            ]}
          >
            {!isOwn && (
              <Image
                source={{ uri: sender?.avatar || 'https://randomuser.me/api/portraits/women/22.jpg' }}
                style={styles.avatar}
                onError={() => {}}
              />
            )}
            <View
              style={[
                styles.eventMessageContainer,
                isOwn ? styles.ownEventMessage : styles.otherEventMessage
              ]}
            >
              <View style={{ width: (SCREEN_WIDTH - 40 - 30) / 3 }}>
                <EventCard
                  id={event.id}
                  title={event.title}
                  description={event.description}
                  date={event.date}
                  time={event.time}
                  displayDate={event.displayDate}
                  location={event.location}
                  price={event.price}
                  participants={event.participants}
                  maxParticipants={event.maxParticipants}
                  organizerAvatar={event.organizerAvatar}
                  organizerId={event.organizerId}
                  variant="miniature_1"
                  mediaUrl={event.mediaUrl}
                  mediaType={event.mediaType}
                  mediaAspectRatio={event.mediaAspectRatio}
                  participantsList={event.participantsList}
                  participantsData={event.participantsData}
                  showSwipeAction={false}
                  showOrganizerAvatar={true}
                  onMiniaturePress={() => router.push(`/event-profile/${message.eventId}`)}
                />
              </View>
              <Text style={styles.messageTime}>
                {message.createdAt.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
        );
      }
    }
    
    // Обычное текстовое сообщение
    return (
      <View
        key={index}
        style={[
          styles.messageWrapper,
          isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper
        ]}
      >
        {!isOwn && (
          <Image
            source={{ uri: sender?.avatar || 'https://randomuser.me/api/portraits/women/22.jpg' }}
            style={styles.avatar}
            onError={() => {}}
          />
        )}
        <View
          style={[
            styles.message,
            isOwn ? styles.ownMessage : styles.otherMessage
          ]}
        >
          <Text style={styles.messageText}>{message.text}</Text>
          <Text style={styles.messageTime}>
            {message.createdAt.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  const handleBackPress = () => {
    // Переходим на страницу inbox (список чатов)
    router.push('/(tabs)/inbox');
  };

  const renderChatHeader = () => {
    if (!chat) return null;

    // Обработчик клика на название чата (только для событийных чатов)
    const handleChatNamePress = () => {
      if (chat.type === 'event' && chat.eventId) {
        router.push(`/event-profile/${chat.eventId}`);
      }
    };

    return (
      <View style={styles.chatHeader}>
        {/* Кнопка "Назад" и название чата */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          {chat.type === 'event' && chat.eventId ? (
            <TouchableOpacity 
              style={styles.chatNameContainer}
              onPress={handleChatNamePress}
              activeOpacity={0.7}
            >
              <Text style={styles.chatName}>{chat.name}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.chatName}>{chat.name}</Text>
          )}
        </View>
        
        {/* Кликабельный список участников (только для событийных чатов) */}
        {chat.type === 'event' && chat.eventId && (
          <TouchableOpacity 
            style={styles.participantsSection}
            onPress={() => setShowParticipantsModal(true)}
          >
            <Text style={styles.participantsLabel}>
              {t.chat.participants} {chat.participants.length}
            </Text>
            <View style={styles.participantsAvatars}>
              {chat.participants.slice(0, 3).map(participantId => {
                const participant = getUserData(participantId);
                return (
                  <Image
                    key={participantId}
                    source={{ uri: participant?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg' }}
                    style={styles.smallAvatar}
                  />
                );
              })}
              {chat.participants.length > 3 && (
                <View style={[styles.smallAvatar, styles.moreParticipantsBadge]}>
                  <Text style={styles.moreParticipantsText}>+{chat.participants.length - 3}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      {renderChatHeader()}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length > 0 ? (
          messages.map((message, index) => renderMessage(message, index))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Нет сообщений</Text>
            <Text style={styles.emptySubtext}>Начните общение</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Написать сообщение..."
          placeholderTextColor="#666"
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Унифицированный модал участников события (только для событийных чатов) */}
      {chat?.type === 'event' && chat.eventId && (
        <ParticipantsModal
          visible={showParticipantsModal}
          onClose={() => setShowParticipantsModal(false)}
          eventId={chat.eventId}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingBottom: 80, // Место для панели ввода + таб-бар
  },
  chatHeader: {
    backgroundColor: '#1a1a1a',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  chatName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  chatNameContainer: {
    flex: 1,
  },
  participantsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantsLabel: {
    fontSize: 14,
    color: '#999999',
  },
  participantsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  moreParticipantsBadge: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  moreParticipantsText: {
    fontSize: 10,
    color: '#999999',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 20,
    paddingBottom: 100, // Отступ снизу для панели ввода
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ownMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  message: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: '#8B5CF6',
  },
  otherMessage: {
    backgroundColor: '#2a2a2a',
  },
  messageText: {
    color: '#FFF',
    fontSize: 15,
    marginBottom: 4,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  eventMessageContainer: {
    borderRadius: 16,
    overflow: 'visible',
    marginBottom: 8,
  },
  ownEventMessage: {
    alignItems: 'flex-end',
  },
  otherEventMessage: {
    alignItems: 'flex-start',
  },
  eventPlaceholder: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventPlaceholderSubtext: {
    color: '#999999',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 50, // Над таб-баром
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 18,
  },
  participantsModal: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    color: '#FFFFFF',
    padding: 4,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 14,
    color: '#999999',
  },
  organizerBadge: {
    fontSize: 12,
    color: '#8B5CF6',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
});

