import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Alert, Modal } from 'react-native';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../../../context/EventsContext';
import { useLanguage } from '../../../context/LanguageContext';
import ParticipantsModal from '../../../components/ParticipantsModal';
import EventCard from '../../../components/EventCard';
import MemoryMiniCard from '../../../components/MemoryMiniCard';
import { useAuth } from '../../../context/AuthContext';
import { createLogger } from '../../../utils/logger';
import { AppIcon } from '../../../components/ui/AppIcon';
import { Palette } from '../../../constants/DesignSystem';
import { apiRequest } from '../../../services/api';
import type { MessageReaction } from '../../../types/Chat';

const logger = createLogger('ChatScreen');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const { t } = useLanguage();
  const {
    getChat,
    sendChatMessage,
    getUserData,
    chatMessages,
    events,
    getEventProfile,
    fetchMessagesForChat,
    markChatAsRead,
  } = useEvents();
  const [inputText, setInputText] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!chatId || !accessToken) return;
    try {
      await apiRequest(
        `/chats/${chatId}/messages/${messageId}/reactions`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
        accessToken,
      );
      // Refetch messages to get updated reactions
      fetchMessagesForChat(chatId as string, true);
    } catch (error) {
      logger.error('Failed to add reaction', error);
    }
    setReactionMessageId(null);
  }, [chatId, accessToken, fetchMessagesForChat]);

  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!chatId || !accessToken) return;
    try {
      await apiRequest(
        `/chats/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: 'DELETE' },
        accessToken,
      );
      fetchMessagesForChat(chatId as string, true);
    } catch (error) {
      logger.error('Failed to remove reaction', error);
    }
  }, [chatId, accessToken, fetchMessagesForChat]);

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
    fetchMessagesForChat(chatId as string, true);
  }, [chatId, fetchMessagesForChat]);

  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId as string);
  }, [chatId, messages.length, markChatAsRead]);

  useEffect(() => {
    if (!chatId) return;

    const socket = require('../../../services/websocket').getSocket();
    if (socket && socket.connected) {
      socket.emit('chat:join', { chatId });

      const onTypingStart = (data: { chatId: string; userId: string }) => {
        if (data.chatId === chatId && data.userId !== currentUserId) {
          setTypingUsers(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
        }
      };
      const onTypingStop = (data: { chatId: string; userId: string }) => {
        if (data.chatId === chatId) {
          setTypingUsers(prev => prev.filter(id => id !== data.userId));
        }
      };
      const onReaction = (data: { chatId: string; messageId: string }) => {
        if (data.chatId === chatId) {
          fetchMessagesForChat(chatId as string, true);
        }
      };
      socket.on('typing:start', onTypingStart);
      socket.on('typing:stop', onTypingStop);
      socket.on('message:reaction', onReaction);

      return () => {
        socket.off('typing:start', onTypingStart);
        socket.off('typing:stop', onTypingStop);
        socket.off('message:reaction', onReaction);
      };
    }

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatId, messages.length, currentUserId]);

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

  // Group reactions by emoji and count them
  const getGroupedReactions = (reactions: MessageReaction[] | undefined) => {
    if (!reactions || reactions.length === 0) return [];
    const grouped: Record<string, { emoji: string; count: number; userIds: string[] }> = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
    });
    return Object.values(grouped);
  };

  const renderReactionPills = (message: any, isOwn: boolean) => {
    const grouped = getGroupedReactions(message.reactions);
    if (grouped.length === 0) return null;

    return (
      <View style={[reactionStyles.pillsContainer, isOwn ? reactionStyles.pillsOwn : reactionStyles.pillsOther]}>
        {grouped.map((group) => {
          const isMine = currentUserId ? group.userIds.includes(currentUserId) : false;
          return (
            <TouchableOpacity
              key={group.emoji}
              style={[reactionStyles.pill, isMine && reactionStyles.pillActive]}
              onPress={() => {
                if (isMine) {
                  handleRemoveReaction(message.id, group.emoji);
                } else {
                  handleAddReaction(message.id, group.emoji);
                }
              }}
            >
              <Text style={reactionStyles.pillEmoji}>{group.emoji}</Text>
              <Text style={[reactionStyles.pillCount, isMine && reactionStyles.pillCountActive]}>{group.count}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderReactionBar = (messageId: string) => {
    if (reactionMessageId !== messageId) return null;
    return (
      <View style={reactionStyles.bar}>
        {QUICK_REACTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={reactionStyles.barEmoji}
            onPress={() => handleAddReaction(messageId, emoji)}
          >
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
                source={{ uri: sender?.avatar || '' }}
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
        logger.warn('Event not found for eventId', { eventId: message.eventId });
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
                source={{ uri: sender?.avatar || '' }}
                style={styles.avatar}
                onError={() => {}}
              />
            )}
            <TouchableOpacity
              style={[
                styles.eventMessageContainer,
                isOwn ? styles.ownEventMessage : styles.otherEventMessage
              ]}
              onPress={() => router.push(`/event-profile/${message.eventId}`)}
              activeOpacity={0.7}
            >
              <View style={styles.eventPlaceholder}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📅</Text>
                <Text style={styles.eventPlaceholderText}>Событие</Text>
                <Text style={styles.eventPlaceholderSubtext}>Нажмите, чтобы открыть</Text>
              </View>
              <Text style={styles.messageTime}>
                {message.createdAt.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </TouchableOpacity>
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
                source={{ uri: sender?.avatar || '' }}
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
      <View key={index}>
        {renderReactionBar(message.id)}
        <View
          style={[
            styles.messageWrapper,
            isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper
          ]}
        >
          {!isOwn && (
            <Image
              source={{ uri: sender?.avatar || '' }}
              style={styles.avatar}
              onError={() => {}}
            />
          )}
          <View style={{ maxWidth: '72%' }}>
            <TouchableOpacity
              style={[
                styles.message,
                isOwn ? styles.ownMessage : styles.otherMessage
              ]}
              onLongPress={() => {
                setReactionMessageId(reactionMessageId === message.id ? null : message.id);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.messageText}>{message.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 }}>
                <Text style={styles.messageTime}>
                  {message.createdAt.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                {isOwn && (
                  <Text style={{ fontSize: 12, color: message.readBy && message.readBy.length > 0 ? '#FF8D32' : 'rgba(244,244,245,0.4)' }}>
                    {message.readBy && message.readBy.length > 0 ? '✓✓' : '✓'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            {renderReactionPills(message, isOwn)}
          </View>
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
            <AppIcon name="chevronLeft" size={22} color={Palette.text} />
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
                    source={{ uri: participant?.avatar || '' }}
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

  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      // На вебе не двигаем layout из-за клавиатуры, чтобы высота экрана была стабильной
      behavior={isIOS ? 'padding' : isAndroid ? 'height' : undefined}
      keyboardVerticalOffset={isIOS ? 90 : 0}
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

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, color: 'rgba(244,244,245,0.5)', fontStyle: 'italic' }}>
            {typingUsers.map(id => getUserData(id)?.name || 'User').join(', ')} печатает...
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={(text) => {
            setInputText(text);
            if (chatId && text.length > 0) {
              const socket = require('../../../services/websocket').getSocket();
              if (socket?.connected) {
                socket.emit('typing:start', { chatId });
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  socket.emit('typing:stop', { chatId });
                }, 2000);
              }
            }
          }}
          placeholder="Написать сообщение..."
          placeholderTextColor="rgba(244,244,245,0.35)"
          multiline
          editable={true}
          onSubmitEditing={Platform.OS === 'web' ? undefined : handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
          // Для веб-версии добавляем обработчик Enter
          onKeyPress={Platform.OS === 'web' ? (e: any) => {
            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault?.();
              handleSend();
            }
          } : undefined}
        />
        {inputText.trim() ? (
          <TouchableOpacity
            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#1a0d00" />
            ) : (
              <AppIcon name="send" size={17} color="#1a0d00" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
            onPress={async () => {
              try {
                const { Audio } = require('expo-av');
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') { Alert.alert('Нет доступа к микрофону'); return; }
                Alert.alert('Скоро', 'Голосовые сообщения появятся в следующем обновлении');
              } catch { Alert.alert('Скоро', 'Голосовые сообщения появятся в следующем обновлении'); }
            }}
          >
            <AppIcon name="mic" size={17} color="rgba(244,244,245,0.6)" />
          </TouchableOpacity>
        )}
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
    backgroundColor: '#0a0a0c',
    // На мобильных (native) оставляем отступ под таб-бар,
    // на вебе дополнительно учитываем высоту фиксированного WebTabBar
    paddingBottom: Platform.OS === 'web' ? 84 : 80,
  },
  chatHeader: {
    backgroundColor: 'rgba(20,20,23,0.85)',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    ...(({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as unknown) as object),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
  },
  chatName: {
    color: '#f4f4f5',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    color: 'rgba(244,244,245,0.55)',
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
    borderColor: '#141417',
  },
  moreParticipantsBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  moreParticipantsText: {
    fontSize: 10,
    color: 'rgba(244,244,245,0.55)',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 20,
    // На вебе увеличиваем отступ, чтобы последние сообщения гарантированно были видны над полем ввода
    paddingBottom: Platform.OS === 'web' ? 140 : 100,
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
    maxWidth: '72%',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 20,
  },
  ownMessage: {
    backgroundColor: '#FF8D32',
    borderBottomRightRadius: 6,
  },
  otherMessage: {
    backgroundColor: '#1c1c20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    color: '#f4f4f5',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10.5,
    marginTop: 2,
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
    backgroundColor: '#1c1c20',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventPlaceholderText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventPlaceholderSubtext: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(20,20,23,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    ...(({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as unknown) as object),
    // На native размещаем инпут поверх таб-бара,
    // на вебе оставляем в естественном потоке, а отступ снизу даёт paddingBottom контейнера
    ...(Platform.OS !== 'web' && {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
    }),
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f4f4f5',
    fontSize: 14.5,
    maxHeight: 100,
    marginRight: 10,
    // Стили для веб-версии
    ...(Platform.OS === 'web' && {
      outline: 'none',
      border: 'none',
      resize: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
    }),
  },
  sendButton: {
    backgroundColor: '#FF8D32',
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#FF8D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendButtonText: {
    color: '#f4f4f5',
    fontSize: 18,
  },
  participantsModal: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  closeButton: {
    fontSize: 24,
    color: '#f4f4f5',
    padding: 4,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
    color: '#f4f4f5',
    fontWeight: '600',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
  },
  organizerBadge: {
    fontSize: 12,
    color: '#FF8D32',
    backgroundColor: '#1c1c20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
});

const reactionStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#1c1c20',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  barEmoji: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  pillsOwn: {
    justifyContent: 'flex-end',
  },
  pillsOther: {
    justifyContent: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  pillActive: {
    backgroundColor: 'rgba(255,141,50,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,141,50,0.4)',
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillCount: {
    fontSize: 12,
    color: 'rgba(244,244,245,0.6)',
    fontWeight: '600',
  },
  pillCountActive: {
    color: '#FF8D32',
  },
});

