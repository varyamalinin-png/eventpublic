import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Image, Platform } from 'react-native';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { createLogger } from '../utils/logger';
import { AppIcon } from './ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { sizedImage } from '../utils/imageSize';

const logger = createLogger('EventShareModal');

function renderCheckbox(checked: boolean) {
  return checked ? (
    <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' }}>
      <AppIcon name="check" size={12} color="#1a0d00" />
    </View>
  ) : (
    <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Palette.line }} />
  );
}

type Props = {
  /** Что шарим: событие (по умолчанию) или профиль пользователя. */
  eventId?: string;
  profileUserId?: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Модалка "Поделиться событием" — раньше была продублирована внутри EventCard,
 * а в event-profile её кнопка Share вообще была TODO-заглушкой. Вынесена сюда,
 * чтобы карточка события и профиль события использовали ровно одну реализацию
 * и не расходились в поведении.
 */
export default function EventShareModal({ eventId, profileUserId, visible, onClose }: Props) {
  const { t } = useLanguage();
  const { events, getChatsForUser, getUserData, getFriendsList, createPersonalChat, sendEventToChats, sendProfileToChats } = useEvents();
  const isProfileShare = !!profileUserId;
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<string[]>([]);

  const handleClose = () => {
    onClose();
    setSelectedChats([]);
    setSearchQuery('');
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.shareModalOverlay}>
        <View style={styles.shareModalContent}>
          <View style={styles.shareModalHeader}>
            <Text style={styles.shareModalTitle}>
              {isProfileShare ? (t.profile.shareProfile || 'Share profile') : t.events.shareEvent}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <AppIcon name="close" size={18} color={Palette.textDim} />
            </TouchableOpacity>
          </View>

          {/* Копировать ссылку */}
          <TouchableOpacity
            style={styles.copyLinkRow}
            onPress={async () => {
              const url = isProfileShare
                ? `https://iwent.ru/profile/${profileUserId}`
                : `https://iwent.ru/event-profile/${eventId}`;
              try {
                const { Share } = require('react-native');
                if (Platform.OS === 'web') {
                  await navigator.clipboard.writeText(url);
                } else {
                  await Share.share({ message: url, url });
                }
              } catch {}
            }}
          >
            <AppIcon name="link" size={18} color={Palette.accent} />
            <Text style={styles.copyLinkText}>{t.events.shareLink}</Text>
          </TouchableOpacity>

          {/* Поле поиска */}
          <TextInput
            style={styles.shareModalSearchInput}
            placeholder={t.events.searchChatsAndFriends}
            placeholderTextColor="rgba(244,244,245,0.35)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Список чатов и друзей */}
          <ScrollView style={styles.shareModalScrollView}>
            <Text style={styles.shareModalSectionTitle}>{t.events.chatsLabel}</Text>

            {getChatsForUser(currentUserId || '')
              .filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(chat => (
                <TouchableOpacity
                  key={chat.id}
                  style={styles.shareModalItem}
                  onPress={() => {
                    const isSelected = selectedChats.includes(chat.id);
                    if (isSelected) {
                      setSelectedChats(prev => prev.filter(id => id !== chat.id));
                    } else {
                      setSelectedChats(prev => [...prev, chat.id]);
                    }
                  }}
                >
                  <Image
                    source={{
                      uri: chat.avatar || (
                        chat.type === 'event'
                          ? events.find(e => e.id === chat.eventId)?.mediaUrl
                          : (() => {
                              const otherParticipant = chat.participants.find(p => p !== currentUserId);
                              return otherParticipant ? getUserData(otherParticipant)?.avatar : '';
                            })()
                      ),
                    }}
                    style={styles.shareModalAvatar}
                  />
                  <View style={styles.shareModalItemInfo}>
                    <Text style={styles.shareModalItemName}>{chat.name}</Text>
                    <Text style={styles.shareModalItemSubtext}>
                      {chat.type === 'event' ? t.events.eventChat : t.events.personalChat2}
                    </Text>
                  </View>
                  {renderCheckbox(selectedChats.includes(chat.id))}
                </TouchableOpacity>
              ))}

            <Text style={styles.shareModalSectionTitle}>{t.events.friendsLabel}</Text>
            {getFriendsList()
              .filter(friend =>
                friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                friend.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(friend => {
                const existingChat = currentUserId
                  ? getChatsForUser(currentUserId).find(
                      chat => chat.type === 'personal' && chat.participants.includes(friend.id)
                    )
                  : undefined;
                const chatId = existingChat ? existingChat.id : null;
                const friendKey = `friend_${friend.id}`;
                const isSelected = selectedChats.includes(friendKey) || (chatId ? selectedChats.includes(chatId) : false);

                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.shareModalItem}
                    onPress={async () => {
                      let targetChatId = chatId;
                      if (!targetChatId) {
                        try {
                          targetChatId = await createPersonalChat(friend.id);
                        } catch (error) {
                          logger.error('Failed to create personal chat', error);
                          return;
                        }
                      }

                      const isCurrentlySelected = selectedChats.includes(targetChatId) || selectedChats.includes(friendKey);

                      if (isCurrentlySelected) {
                        setSelectedChats(prev => prev.filter(id => id !== targetChatId && id !== friendKey));
                      } else if (targetChatId) {
                        setSelectedChats(prev => [...prev.filter(id => id !== friendKey), targetChatId]);
                      }
                    }}
                  >
                    <Image source={{ uri: sizedImage(friend.avatar, 44) }} style={styles.shareModalAvatar} />
                    <View style={styles.shareModalItemInfo}>
                      <Text style={styles.shareModalItemName}>{friend.name}</Text>
                      <Text style={styles.shareModalItemSubtext}>@{friend.username}</Text>
                    </View>
                    {renderCheckbox(isSelected)}
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          {/* Кнопка отправки */}
          <TouchableOpacity
            style={[
              styles.shareModalSendButton,
              selectedChats.filter(chatId => !chatId.startsWith('friend_')).length === 0 && styles.shareModalSendButtonDisabled,
            ]}
            onPress={() => {
              const validChatIds = selectedChats.filter(chatId => !chatId.startsWith('friend_'));
              if (validChatIds.length > 0) {
                if (isProfileShare && profileUserId) {
                  sendProfileToChats(profileUserId, validChatIds);
                } else if (eventId) {
                  sendEventToChats(eventId, validChatIds);
                }
                handleClose();
              }
            }}
            disabled={selectedChats.filter(chatId => !chatId.startsWith('friend_')).length === 0}
          >
            <Text style={styles.shareModalSendButtonText}>
              {t.common.send} ({selectedChats.filter(chatId => !chatId.startsWith('friend_')).length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: '#141417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 500,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  copyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  copyLinkText: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '500',
  },
  shareModalSearchInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#f4f4f5',
    marginBottom: 16,
  },
  shareModalScrollView: {
    maxHeight: 400,
  },
  shareModalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.55)',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  shareModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  shareModalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  shareModalItemInfo: {
    flex: 1,
  },
  shareModalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  shareModalItemSubtext: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginTop: 2,
  },
  shareModalSendButton: {
    backgroundColor: '#FF8D32',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  shareModalSendButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.5,
  },
  shareModalSendButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
