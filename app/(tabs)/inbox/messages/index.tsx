import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator } from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import MessageFolders from '../../../../components/MessageFolders';
import { useEvents } from '../../../../context/EventsContext';
import { useRouter } from 'expo-router';
import type { Chat, MessageFolder } from '../../../../types/Chat';
import { useAuth } from '../../../../context/AuthContext';
import { useLanguage } from '../../../../context/LanguageContext';
import { createLogger } from '../../../../utils/logger';

const logger = createLogger('MessagesTab');

export default function MessagesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    getUserData,
    getChatsForUser,
    messageFolders,
    createMessageFolder,
    addChatsToMessageFolder,
    removeChatFromMessageFolder,
    refreshMessageFolders,
  } = useEvents();
  const currentUserId = useMemo(() => user?.id ?? null, [user]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddChatsModal, setShowAddChatsModal] = useState(false);
  const [selectedChatsForFolder, setSelectedChatsForFolder] = useState<string[]>([]);
  const [folderIdForAdding, setFolderIdForAdding] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isAddingChats, setIsAddingChats] = useState(false);
  const [removingChatIds, setRemovingChatIds] = useState<string[]>([]);

  const defaultFolders = useMemo<MessageFolder[]>(
    () => [
      { id: 'event-chats', name: t.chat.eventChats, type: 'default' },
      { id: 'personal-chats', name: t.chat.personal, type: 'default' },
    ],
    [],
  );

  const allFolders = useMemo(() => [...defaultFolders, ...messageFolders], [defaultFolders, messageFolders]);

  useEffect(() => {
    refreshMessageFolders().catch(error => logger.error('Failed to refresh message folders', error));
  }, [refreshMessageFolders]);
  
  const handleChatPress = (chatId: string) => {
    logger.debug('Chat pressed', { chatId });
    router.push(`/(tabs)/inbox/${chatId}`);
  };

  const selectedFolderData = useMemo(
    () => (selectedFolder ? allFolders.find(folder => folder.id === selectedFolder) ?? null : null),
    [selectedFolder, allFolders],
  );

  const userChats = useMemo(
    () => (currentUserId ? getChatsForUser(currentUserId) : []),
    [currentUserId, getChatsForUser],
  );

  const filteredChats = useMemo(() => {
    const toTimestamp = (value?: Date) => {
      if (!value) return 0;
      return value instanceof Date ? value.getTime() : new Date(value).getTime();
    };

    let chats: Chat[] = [...userChats];

    if (selectedFolderData) {
      if (selectedFolderData.id === 'event-chats') {
        chats = chats.filter(chat => chat.type === 'event');
      } else if (selectedFolderData.id === 'personal-chats') {
        chats = chats.filter(chat => chat.type === 'personal');
      } else if (selectedFolderData.type === 'custom') {
        const folderChatIds = new Set(selectedFolderData.chatIds ?? []);
        chats = chats.filter(chat => folderChatIds.has(chat.id));
      }
    }

    return chats.sort((a, b) => {
      const timeA = Math.max(toTimestamp(a.lastMessage?.createdAt), toTimestamp(a.lastActivity));
      const timeB = Math.max(toTimestamp(b.lastMessage?.createdAt), toTimestamp(b.lastActivity));
      return timeB - timeA;
    });
  }, [userChats, selectedFolderData]);

  const availableChatsForSelectedFolder = useMemo(() => {
    if (!selectedFolderData || selectedFolderData.type !== 'custom') return [];
    const existing = new Set(selectedFolderData.chatIds ?? []);
    return userChats.filter(chat => !existing.has(chat.id));
  }, [selectedFolderData, userChats]);

  const folderForModal = useMemo(
    () => (folderIdForAdding ? allFolders.find(folder => folder.id === folderIdForAdding) ?? null : null),
    [folderIdForAdding, allFolders],
  );

  const availableChatsForModal = useMemo(() => {
    if (!folderForModal) return [];
    let chats = [...userChats];
    if (folderForModal.id === 'event-chats') {
      chats = chats.filter(chat => chat.type === 'event');
    } else if (folderForModal.id === 'personal-chats') {
      chats = chats.filter(chat => chat.type === 'personal');
    }
    if (folderForModal.type !== 'default') {
      const taken = new Set(folderForModal.chatIds ?? []);
      chats = chats.filter(chat => !taken.has(chat.id));
    }
    return chats;
  }, [folderForModal, userChats]);

  useEffect(() => {
    if (!showAddChatsModal) {
      setSelectedChatsForFolder([]);
      return;
    }
    setSelectedChatsForFolder(prev =>
      prev.filter(chatId => availableChatsForModal.some(chat => chat.id === chatId)),
    );
  }, [availableChatsForModal, showAddChatsModal]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      setIsCreatingFolder(true);
      const createdFolder = await createMessageFolder(name);
      await refreshMessageFolders();
      if (createdFolder) {
        setSelectedFolder(createdFolder.id);
      }
      setNewFolderName('');
      setShowCreateFolderModal(false);
    } catch (error) {
      logger.error('Failed to create folder', error);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleAddChatsToFolder = async () => {
    if (!folderIdForAdding || selectedChatsForFolder.length === 0) return;
    try {
      setIsAddingChats(true);
      await addChatsToMessageFolder(folderIdForAdding, selectedChatsForFolder);
      await refreshMessageFolders();
      closeAddChatsModal();
    } catch (error) {
      logger.error('Failed to add chats to folder', error);
    } finally {
      setIsAddingChats(false);
    }
  };

  const closeAddChatsModal = () => {
    setShowAddChatsModal(false);
    setSelectedChatsForFolder([]);
    setFolderIdForAdding(null);
  };

  const handleRemoveChatFromFolder = async (chatId: string) => {
    if (!selectedFolderData || selectedFolderData.type !== 'custom') return;
    if (removingChatIds.includes(chatId)) return;
    setRemovingChatIds(prev => [...prev, chatId]);
    try {
      await removeChatFromMessageFolder(selectedFolderData.id, chatId);
      await refreshMessageFolders();
    } catch (error) {
      logger.error('Failed to remove chat from folder', error);
    } finally {
      setRemovingChatIds(prev => prev.filter(id => id !== chatId));
    }
  };

  const foldersForMessageFolders = useMemo(() => {
    const allChatIds = new Set(userChats.map(chat => chat.id));
    const eventChatsCount = userChats.filter(chat => chat.type === 'event').length;
    const personalChatsCount = userChats.filter(chat => chat.type === 'personal').length;

    return allFolders.map(folder => {
      let messageCount: number | undefined;
      if (folder.id === 'event-chats') {
        messageCount = eventChatsCount;
      } else if (folder.id === 'personal-chats') {
        messageCount = personalChatsCount;
      } else if (folder.type === 'custom') {
        const chatIds = folder.chatIds ?? [];
        messageCount = chatIds.reduce((count, chatId) => (allChatIds.has(chatId) ? count + 1 : count), 0);
      }
      return {
        id: folder.id,
        name: folder.name,
        messageCount,
      };
    });
  }, [allFolders, userChats]);

  return (
    <View style={styles.container}>
      <MessageFolders
        folders={foldersForMessageFolders}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
        onCreateFolder={() => setShowCreateFolderModal(true)}
      />
      
      {selectedFolderData?.type === 'custom' && availableChatsForSelectedFolder.length > 0 && (
        <TouchableOpacity
          style={styles.addChatsButton}
          onPress={() => {
            setFolderIdForAdding(selectedFolderData.id);
            setShowAddChatsModal(true);
          }}
        >
          <Text style={styles.addChatsButtonText}>
            + {t.chat.addToFolder.replace('{folderName}', selectedFolderData.name)}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.chatsList}>
        {filteredChats.map((chat: Chat) => {
          // Для личных чатов получаем данные другого участника
          let avatar = chat.avatar;
          if (chat.type === 'personal' && !avatar) {
            const otherParticipantId = chat.participants.find((p: string) => p !== currentUserId);
            if (otherParticipantId) {
              const otherUserData = getUserData(otherParticipantId);
              avatar = otherUserData.avatar;
            }
          }
          if (!avatar) {
            avatar = 'https://randomuser.me/api/portraits/women/68.jpg';
          }

          const lastInteractionDate =
            chat.lastMessage?.createdAt instanceof Date
              ? chat.lastMessage.createdAt
              : chat.lastActivity instanceof Date
              ? chat.lastActivity
              : new Date(chat.lastActivity);
          const isCustomFolder = selectedFolderData?.type === 'custom' && (selectedFolderData.chatIds ?? []).includes(chat.id);
          const isRemoving = removingChatIds.includes(chat.id);
          
          return (
            <View key={chat.id} style={styles.chatRow}>
              <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(chat.id)}>
                <Image source={{ uri: avatar }} style={styles.chatAvatar} />
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{chat.name}</Text>
                  {chat.lastMessage && (
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {chat.lastMessage.text ?? 'Отправлено событие'}
                    </Text>
                  )}
                </View>
                {lastInteractionDate && (
                  <Text style={styles.chatTime}>
                    {lastInteractionDate.toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
              </TouchableOpacity>

              {isCustomFolder && (
                <TouchableOpacity
                  style={styles.removeChatButton}
                  onPress={() => handleRemoveChatFromFolder(chat.id)}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.removeChatButtonText}>{t.chat.remove}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Модальное окно создания папки */}
      <Modal
        visible={showCreateFolderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateFolderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.chat.createFolder}</Text>
            <TextInput
              style={styles.modalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t.chat.folderName}
              placeholderTextColor="#999"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowCreateFolderModal(false)}
              >
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (isCreatingFolder || !newFolderName.trim()) && styles.modalButtonDisabled,
                ]}
                onPress={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
              >
                {isCreatingFolder ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalButtonText}>{t.chat.create}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно добавления чатов в папку */}
      <Modal
        visible={showAddChatsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAddChatsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {folderForModal?.name ? t.chat.addToFolder.replace('{folderName}', folderForModal.name) : t.chat.addToFolder.replace('{folderName}', '')}
              </Text>
              <TouchableOpacity
                onPress={closeAddChatsModal}
              >
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {availableChatsForModal.length === 0 ? (
                <Text style={styles.modalEmptyText}>Нет доступных чатов для добавления</Text>
              ) : (
                availableChatsForModal.map(chat => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.modalChatItem}
                    onPress={() => {
                      if (selectedChatsForFolder.includes(chat.id)) {
                        setSelectedChatsForFolder(prev => prev.filter(id => id !== chat.id));
                      } else {
                        setSelectedChatsForFolder(prev => [...prev, chat.id]);
                      }
                    }}
                  >
                    <View style={styles.modalCheckbox}>
                      {selectedChatsForFolder.includes(chat.id) && (
                        <Text style={styles.modalCheckmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.modalChatName}>{chat.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalButtonConfirm,
                (selectedChatsForFolder.length === 0 || isAddingChats) && styles.modalButtonDisabled
              ]}
              onPress={handleAddChatsToFolder}
              disabled={selectedChatsForFolder.length === 0 || isAddingChats}
            >
              {isAddingChats ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.modalButtonText}>Добавить</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  chatsList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    flex: 1,
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
  },
  chatTime: {
    color: '#666',
    fontSize: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  addChatsButton: {
    padding: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    alignItems: 'center',
  },
  addChatsButtonText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    color: '#FFF',
    fontSize: 24,
  },
  modalInput: {
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  modalScrollView: {
    maxHeight: 300,
    marginBottom: 20,
  },
  modalEmptyText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCheckmark: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  modalChatName: {
    color: '#FFF',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#2A2A2A',
  },
  modalButtonConfirm: {
    backgroundColor: '#8B5CF6',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  removeChatButton: {
    marginRight: 20,
    marginLeft: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignSelf: 'center',
  },
  removeChatButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

