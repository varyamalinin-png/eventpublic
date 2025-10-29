import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../../../context/EventsContext';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const { getChat, getChatMessages, sendChatMessage, getUserData, chatMessages, events } = useEvents();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const chat = chatId ? getChat(chatId as string) : null;

  // Загружаем сообщения при изменении chatId или chatMessages
  useEffect(() => {
    if (chatId) {
      const chatMessagesData = getChatMessages(chatId as string);
      setMessages(chatMessagesData);
      
      // Прокручиваем к последнему сообщению
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [chatId, chatMessages, getChatMessages]);

  const handleSend = () => {
    if (!inputText.trim() || !chatId) return;

    // Отправляем сообщение через sendChatMessage (принимает chatId и text)
    // Сообщение будет добавлено в контекст, и useEffect обновит локальное состояние
    sendChatMessage(chatId as string, inputText.trim());
    setInputText('');
    
    // Прокручиваем к последнему сообщению после обновления
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const renderMessage = (message: any, index: number) => {
    const isOwn = message.fromUserId === 'own-profile-1';
    const sender = getUserData(message.fromUserId);
    
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
          <Text style={styles.chatName}>{chat.name}</Text>
        </View>
        
        {/* Кликабельный список участников */}
        <TouchableOpacity 
          style={styles.participantsSection}
          onPress={() => setShowParticipantsModal(true)}
        >
          <Text style={styles.participantsLabel}>
            Участники: {chat.participants.length}
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
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>

      {/* Модальное окно участников */}
      <Modal
        visible={showParticipantsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.participantsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Участники чата</Text>
            <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {chat && (
            <FlatList
              data={chat.participants}
              keyExtractor={(item) => item}
              renderItem={({item: participantId}) => {
                const participant = getUserData(participantId);
                return (
                  <TouchableOpacity 
                    style={styles.participantItem}
                    onPress={() => {
                      setShowParticipantsModal(false);
                      router.push(`/profile/${participantId}`);
                    }}
                  >
                    <Image
                      source={{ uri: participant?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg' }}
                      style={styles.participantAvatar}
                    />
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>
                        {participant?.name || 'Пользователь'}
                      </Text>
                      <Text style={styles.participantUsername}>
                        @{participant?.username || 'username'}
                      </Text>
                    </View>
                    {/* Показать роль для событийных чатов */}
                    {chat.type === 'event' && chat.eventId && (() => {
                      // Проверяем, является ли участник организатором события
                      const event = events.find((e: any) => e.id === chat.eventId);
                      if (event && event.organizerId === participantId) {
                        return <Text style={styles.organizerBadge}>Организатор</Text>;
                      }
                      return null;
                    })()}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
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

