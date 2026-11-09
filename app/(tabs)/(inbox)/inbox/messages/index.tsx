import { FlatList, View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator, Animated, Alert, Platform, RefreshControl } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import MessageFolders from '../../../../../components/MessageFolders';
import { useEvents } from '../../../../../context/EventsContext';
import { useRefresh } from '../../../../../hooks/useRefresh';
import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Chat, MessageFolder } from '../../../../../types/Chat';
import { useAuth } from '../../../../../context/AuthContext';
import { useLanguage } from '../../../../../context/LanguageContext';
import { createLogger } from '../../../../../utils/logger';
import { AppIcon } from '../../../../../components/ui/AppIcon';
import { Palette, ScreenPadding, TabBarSpacer } from '../../../../../constants/DesignSystem';
import { getChatDisplayName } from '../../../../../utils/chatDisplayName';
import { localizeSystemMessage } from '../../../../../utils/systemMessage';
import { sizedImage } from '../../../../../utils/imageSize';
import { useGuestGate } from '../../../../../hooks/useGuestGate';

const logger = createLogger('MessagesTab');

/**
 * Этот файл работает в ДВУХ ролях сразу:
 *  - как компонент внутри inbox/index (там сверху уже есть шапка
 *    «Messages / Notifications», и свой отступ добавлять нельзя);
 *  - как самостоятельный маршрут /inbox/messages, куда попадают только по
 *    ссылке (/inbox/* входит в universal links). Тогда экран становится
 *    корнем стека, и без верхнего отступа фильтры лезут под статус-бар.
 * Отсюда флаг embedded: без него отступ по safe-area уезжал в общий инбокс
 * пустой полосой под шапкой.
 */
export default function MessagesTab({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  // Гостю чаты закрыты (диплинк /inbox/messages приходит в обход таб-бара).
  const isGuest = useGuestGate();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US';
  const { refreshing, onRefresh } = useRefresh();

  // Повторный тап по разделу возвращает список чатов к началу — стандартное
  // поведение из @react-navigation/native, то же, что в ленте и профиле.
  const chatsListRef = useRef<any>(null);
  useScrollToTop(chatsListRef);
  const {
    getUserData,
    getChatsForUser,
    messageFolders,
    createMessageFolder,
    addChatsToMessageFolder,
    removeChatFromMessageFolder,
    refreshMessageFolders,
    cancelEventParticipation,
    transferOrganizerRole,
    isUserOrganizer,
    getEventParticipants,
    deleteChat,
    events,
  } = useEvents();
  const currentUserId = useMemo(() => user?.id ?? null, [user]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddChatsModal, setShowAddChatsModal] = useState(false);
  const [selectedChatsForFolder, setSelectedChatsForFolder] = useState<string[]>([]);
  const [folderIdForAdding, setFolderIdForAdding] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isAddingChats, setIsAddingChats] = useState(false);
  const [removingChatIds, setRemovingChatIds] = useState<string[]>([]);
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [showFolderSelectModal, setShowFolderSelectModal] = useState(false);
  const [chatForFolder, setChatForFolder] = useState<Chat | null>(null);
  const [showTransferOrganizerModal, setShowTransferOrganizerModal] = useState(false);
  const [eventIdForTransfer, setEventIdForTransfer] = useState<string | null>(null);
  const [selectedNewOrganizerId, setSelectedNewOrganizerId] = useState<string | null>(null);
  const swipeX = useRef<Record<string, Animated.Value>>({});
  const swipeAnimations = useRef<Record<string, { translateX: Animated.Value; opacity: Animated.Value }>>({});
  const gestureStartX = useRef<Record<string, number>>({});
  const isSwipeGesture = useRef<Record<string, boolean>>({});
  // Фактический сдвиг строки. Нельзя читать (translateX as any)._value:
  // при useNativeDriver анимация живёт в нативном потоке и JS-овый _value
  // остаётся тем, что последним выставил палец во время перетаскивания
  // (например -55), хотя строка уже уехала на -160. Из-за этого обычный тап
  // по кнопке (translationX ≈ 0) попадал в ветку «currentValue > -80»
  // и ЗАКРЫВАЛ свайп вместо нажатия — отсюда «срабатывает не с первого раза».
  const swipeOffsets = useRef<Record<string, number>>({});

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

    // Фильтрация по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      chats = chats.filter(chat => {
        const nameMatch = getChatDisplayName(chat, currentUserId, getUserData, '').toLowerCase().includes(query);
        const lastMessageMatch = chat.lastMessage?.text?.toLowerCase().includes(query);
        return nameMatch || lastMessageMatch;
      });
    }

    return chats.sort((a, b) => {
      const timeA = Math.max(toTimestamp(a.lastMessage?.createdAt), toTimestamp(a.lastActivity));
      const timeB = Math.max(toTimestamp(b.lastMessage?.createdAt), toTimestamp(b.lastActivity));
      return timeB - timeA;
    });
  }, [userChats, selectedFolderData, searchQuery]);

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
      Alert.alert(t.common.error, t.chat.folderUpdateFailed);
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
      Alert.alert(t.common.error, t.chat.folderUpdateFailed);
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

  /**
   * Счётчики на папках — непрочитанные чаты, а не число чатов вообще.
   *
   * Правило то же, что у значка на вкладке ((tabs)/_layout.tsx): последнее
   * сообщение чужое и мной не прочитано. Тогда «1» в нижнем меню сразу видно
   * и на нужной папке, а не приходится открывать обе.
   */
  const unreadChatIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentUserId) return ids;
    userChats.forEach(chat => {
      const last = chat.lastMessage;
      if (last && last.fromUserId !== currentUserId && !last.readBy?.includes(currentUserId)) {
        ids.add(chat.id);
      }
    });
    return ids;
  }, [userChats, currentUserId]);

  const foldersForMessageFolders = useMemo(() => {
    const countUnread = (chats: Chat[]) => chats.filter(chat => unreadChatIds.has(chat.id)).length;
    return allFolders.map(folder => {
      let unreadCount = 0;
      if (folder.id === 'event-chats') {
        unreadCount = countUnread(userChats.filter(chat => chat.type === 'event'));
      } else if (folder.id === 'personal-chats') {
        unreadCount = countUnread(userChats.filter(chat => chat.type === 'personal'));
      } else if (folder.type === 'custom') {
        unreadCount = (folder.chatIds ?? []).filter(chatId => unreadChatIds.has(chatId)).length;
      }
      return { id: folder.id, name: folder.name, unreadCount };
    });
  }, [allFolders, userChats, unreadChatIds]);

  const renderChatRow = useCallback(({ item: chat }: { item: Chat }) => {
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
      avatar = '';
    }

    const lastInteractionDate =
      chat.lastMessage?.createdAt instanceof Date
        ? chat.lastMessage.createdAt
        : chat.lastActivity instanceof Date
        ? chat.lastActivity
        : new Date(chat.lastActivity);
    const isCustomFolder = selectedFolderData?.type === 'custom' && (selectedFolderData.chatIds ?? []).includes(chat.id);
    const isRemoving = removingChatIds.includes(chat.id);
  
    // Инициализируем анимации для свайпа
    if (!swipeAnimations.current[chat.id]) {
      swipeAnimations.current[chat.id] = {
        translateX: new Animated.Value(0),
        opacity: new Animated.Value(1),
      };
    }
    const { translateX, opacity } = swipeAnimations.current[chat.id];
    const isSwiped = swipedChatId === chat.id;
  
    const handleSwipeGesture = (event: any) => {
      const { translationX, translationY, state, absoluteX } = event.nativeEvent;
    
      if (state === State.BEGAN) {
        // Запоминаем начальную позицию жеста
        gestureStartX.current[chat.id] = absoluteX;
        isSwipeGesture.current[chat.id] = false;
      } else if (state === State.ACTIVE) {
        // Порог активации: до него палец «набирает» направление, а строка
        // ещё не двигается. Дальше смещение отсчитывается ОТ порога, иначе
        // строка скачком прыгала сразу на все 20+ пунктов — это и читалось
        // как «криво свайпается».
        const SWIPE_ACTIVATE = 12;
        // 1.2, а не 1.5: почти горизонтальные, но чуть диагональные жесты
        // раньше не распознавались вовсе, и свайп приходилось повторять.
        const isHorizontalSwipe = Math.abs(translationX) > Math.abs(translationY) * 1.2;

        if (isHorizontalSwipe && Math.abs(translationX) > SWIPE_ACTIVATE) {
          isSwipeGesture.current[chat.id] = true;
        }
        const dx = translationX > 0
          ? Math.max(0, translationX - SWIPE_ACTIVATE)
          : Math.min(0, translationX + SWIPE_ACTIVATE);
      
        // Если чат уже свайпнут, разрешаем обратный свайп вправо
        if (isSwiped) {
          // Обратный свайп вправо - возвращаем чат на место
          // translationX будет положительным при свайпе вправо
          if (dx > 0) {
            // Начальное значение -160, добавляем положительное смещение
            const newValue = Math.min(0, -160 + dx);
            translateX.setValue(newValue);
            swipeOffsets.current[chat.id] = newValue;
          } else if (dx < 0) {
            // Дальше -160 не уходим
            translateX.setValue(-160);
            swipeOffsets.current[chat.id] = -160;
          }
        } else {
          // Обычный свайп влево - показываем кнопки.
          // Раньше при уходе дальше -160 условие переставало выполняться и
          // строка ЗАМИРАЛА под пальцем. Теперь просто ограничиваем значение.
          if (isSwipeGesture.current[chat.id] && dx < 0) {
            const newValue = Math.max(-160, dx);
            translateX.setValue(newValue);
            swipeOffsets.current[chat.id] = newValue;
          }
        }
      } else if (state === State.END) {
        if (isSwiped) {
          // Если чат был свайпнут, проверяем обратный свайп вправо.
          // Берём offset из ref, а не из _value (см. комментарий у swipeOffsets).
          const currentValue = swipeOffsets.current[chat.id] ?? -160;
          // Чистый тап (без горизонтального движения) не должен закрывать свайп —
          // иначе он «съедал» нажатие по кнопке папки/удаления под строкой.
          const movedHorizontally = isSwipeGesture.current[chat.id];
          // Если свайпнули вправо достаточно далеко (translationX > 0) или текущее значение близко к 0 - скрываем кнопки
          if (translationX > 30 || (movedHorizontally && currentValue > -80)) {
            setSwipedChatId(null);
            swipeOffsets.current[chat.id] = 0;
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: (Platform.OS as string) !== 'web',
            }).start();
          } else {
            // Возвращаем обратно в свайпнутое состояние
            swipeOffsets.current[chat.id] = -160;
            Animated.spring(translateX, {
              toValue: -160,
              useNativeDriver: (Platform.OS as string) !== 'web',
            }).start();
          }
        } else {
          // Показываем кнопки только если это был свайп влево и движение достаточно большое
          if (isSwipeGesture.current[chat.id] && translationX < -50) {
          setSwipedChatId(chat.id);
          swipeOffsets.current[chat.id] = -160;
          Animated.spring(translateX, {
              toValue: -160,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        } else {
          // Скрываем кнопки
          setSwipedChatId(null);
          swipeOffsets.current[chat.id] = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
        }
        // Очищаем состояние жеста
        delete gestureStartX.current[chat.id];
        delete isSwipeGesture.current[chat.id];
      }
    };
  
    const handleDeletePress = () => {
      setChatToDelete(chat);
      setShowDeleteChatModal(true);
      // Закрываем свайп
      setSwipedChatId(null);
      swipeOffsets.current[chat.id] = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };
  
    const handleFolderPress = () => {
      setChatForFolder(chat);
      setShowFolderSelectModal(true);
      // Закрываем свайп
      setSwipedChatId(null);
      swipeOffsets.current[chat.id] = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };

    const handleRemoveFromFolderPress = () => {
      setSwipedChatId(null);
      swipeOffsets.current[chat.id] = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      handleRemoveChatFromFolder(chat.id);
    };

    return (
      <View key={chat.id} style={styles.chatRowContainer}>
        {/* Кнопки при свайпе - скрыты за чатом. Внутри кастомной папки первая
            кнопка означает «убрать из папки» вместо «добавить в папку» —
            раньше это была ОТДЕЛЬНАЯ, всегда видимая кнопка "Remove" рядом
            с чатом, без всякого свайпа, что выглядело как баг. */}
        <View style={styles.swipeButtonsContainer}>
          <TouchableOpacity
            style={[styles.swipeButton, styles.swipeButtonFolder]}
            onPress={isCustomFolder ? handleRemoveFromFolderPress : handleFolderPress}
            disabled={isCustomFolder && isRemoving}
          >
            {isCustomFolder && isRemoving ? (
              <ActivityIndicator color={Palette.text} size="small" />
            ) : (
              <AppIcon name={isCustomFolder ? 'close' : 'folder'} size={18} color={Palette.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeButton, styles.swipeButtonDelete]}
            onPress={handleDeletePress}
          >
            <AppIcon name="trash" size={18} color={Palette.text} />
          </TouchableOpacity>
        </View>

        <PanGestureHandler
          onGestureEvent={handleSwipeGesture}
          onHandlerStateChange={handleSwipeGesture}
          activeOffsetX={isSwiped ? 30 : -30} // Порог для свайпа: вправо если свайпнут, влево если нет
          failOffsetY={[-15, 15]}
          minPointers={1}
          shouldCancelWhenOutside={true}
          enableTrackpadTwoFingerGesture={false}
        >
          <Animated.View
            style={[
              styles.chatRow,
              {
                transform: [{ translateX }],
              },
            ]}
          >
            <TouchableOpacity 
              style={styles.chatItem}
              activeOpacity={isSwiped ? 1 : 0.7}
              delayPressIn={100}
              onPress={() => {
                // Закрываем свайп при клике, если он открыт
                if (isSwiped) {
                  setSwipedChatId(null);
                  swipeOffsets.current[chat.id] = 0;
                  Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: (Platform.OS as string) !== 'web',
                  }).start();
                } else {
                  handleChatPress(chat.id);
                }
              }}
              disabled={isSwiped}
            >
              <Image source={{ uri: sizedImage(avatar, 52) }} style={styles.chatAvatar} />
              {(() => {
                const last = chat.lastMessage;
                const isUnread = last && last.fromUserId !== currentUserId && !last.readBy?.includes(currentUserId || '');
                return (
                  <>
                    <View style={styles.chatInfo}>
                      <Text style={[styles.chatName, isUnread && { fontWeight: '700' }]}>{getChatDisplayName(chat, currentUserId, getUserData, t.chat.chatFallback)}</Text>
                      {last && (
                        <Text style={[styles.lastMessage, isUnread && { color: '#f4f4f5' }]} numberOfLines={1}>
                          {last.text ? localizeSystemMessage(last.text, t) : t.chat.eventSent}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {lastInteractionDate && (
                        <Text style={[styles.chatTime, isUnread && { color: '#FF8D32' }]}>
                          {lastInteractionDate.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                      {isUnread && (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF8D32' }} />
                      )}
                    </View>
                  </>
                );
              })()}
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </View>
    );
  }, [currentUserId, getUserData, handleChatPress, handleRemoveChatFromFolder, removingChatIds, selectedFolderData?.chatIds, selectedFolderData?.type, swipedChatId, t.chat.eventSent, t.chat.remove]);


  // Гостю список чатов не рендерим — редирект на регистрацию уже пошёл.
  if (isGuest) return null;

  return (
    <View style={[styles.container, !embedded && { paddingTop: insets.top }]}>
      <MessageFolders
        folders={foldersForMessageFolders}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
        onCreateFolder={() => setShowCreateFolderModal(true)}
        allUnreadCount={unreadChatIds.size}
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

      <TextInput
        style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#f4f4f5', marginHorizontal: ScreenPadding, marginBottom: 12 }}
        placeholder={t.chat.searchChats}
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Список чатов виртуализирован: у активного пользователя накапливаются
          десятки чатов событий, и все они висели смонтированными. */}
      <FlatList
        ref={chatsListRef}
        data={filteredChats}
        keyExtractor={(chat: Chat) => String(chat.id)}
        renderItem={renderChatRow}
        style={styles.chatsList}
        contentContainerStyle={{ paddingBottom: TabBarSpacer }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8D32" />}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppIcon name="inbox" size={60} color="rgba(244,244,245,0.25)" />
            <Text style={styles.emptyTitle}>{t.inbox.noMessagesYet}</Text>
            <Text style={styles.emptyText}>{t.inbox.startViaEvents}</Text>
          </View>
        }
      />

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
                  <ActivityIndicator color="#f4f4f5" />
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
                <AppIcon name="close" size={18} color={Palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {availableChatsForModal.length === 0 ? (
                <Text style={styles.modalEmptyText}>{t.inbox.noChatsToAdd}</Text>
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
                        <AppIcon name="check" size={14} color={Palette.accent} />
                      )}
                    </View>
                    <Text style={styles.modalChatName}>{getChatDisplayName(chat, currentUserId, getUserData, t.chat.chatFallback)}</Text>
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
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.modalButtonText}>{t.common.add}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно удаления чата */}
      <Modal
        visible={showDeleteChatModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteChatModal(false);
          setChatToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.inbox.deleteChat}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteChatModal(false);
                  setChatToDelete(null);
                }}
              >
                <AppIcon name="close" size={18} color={Palette.text} />
              </TouchableOpacity>
            </View>
            
            {chatToDelete && (
              <>
                <Text style={styles.modalDescription}>
                  {chatToDelete.type === 'event'
                    ? t.chat.chooseChatAction
                    : t.chat.deleteChatConfirm}
                </Text>
                
                {chatToDelete.type === 'event' ? (
                  <View style={styles.deleteOptionsContainer}>
                    <TouchableOpacity
                      style={styles.deleteOption}
                      onPress={async () => {
                        try {
                          // Удалить чат и выйти из события
                          if (chatToDelete.eventId) {
                            const eventId = chatToDelete.eventId;
                            const event = events.find(e => e.id === eventId);
                            
                            // Проверяем, является ли пользователь организатором
                            const isOrganizer = event && currentUserId ? isUserOrganizer(event, currentUserId) : false;
                            const participants = getEventParticipants ? getEventParticipants(eventId) : [];
                            const participantsCount = participants.length;
                            
                            // Выход из события на сервере уже убирает пользователя
                            // из чата события. Поэтому следом идущий DELETE /chats/:id
                            // штатно отвечает 403/404 — «вас там уже нет». Раньше это
                            // пробрасывалось наружу и показывалась ошибка, хотя и чат
                            // удалён, и из события человек вышел. Глотаем только эти
                            // два кода: любая другая ошибка по-прежнему всплывает.
                            const deleteChatIgnoringAlreadyGone = async () => {
                              try {
                                await deleteChat(chatToDelete.id, true);
                              } catch (err: any) {
                                const status = err?.status ?? err?.response?.status;
                                if (status === 403 || status === 404) {
                                  logger.info('Чат уже недоступен после выхода из события — считаем удалённым');
                                  return;
                                }
                                throw err;
                              }
                            };

                            if (isOrganizer && participantsCount === 1) {
                              // Организатор единственный участник - отменяем событие
                              await cancelEventParticipation(eventId, currentUserId || '');
                              await deleteChatIgnoringAlreadyGone();
                            } else if (isOrganizer && participantsCount > 1) {
                              // Организатор не единственный - показываем попап передачи роли
                              setEventIdForTransfer(eventId);
                                      setShowDeleteChatModal(false);
                                      setChatToDelete(null);
                              setShowTransferOrganizerModal(true);
                              return;
                            } else {
                              // Обычный участник - просто выходим из события
                              await cancelEventParticipation(eventId, currentUserId || '');
                              await deleteChatIgnoringAlreadyGone();
                            }
                          } else {
                            // Для личных чатов просто удаляем
                            await deleteChat(chatToDelete.id, false);
                          }
                          
                          setShowDeleteChatModal(false);
                          setChatToDelete(null);
                        } catch (error) {
                          logger.error('Failed to delete chat and leave event', error);
                          Alert.alert(t.common.error, t.messages.leaveChatFailed);
                        }
                      }}
                    >
                      <Text style={styles.deleteOptionText}>{t.inbox.deleteChatAndLeave}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.deleteOption}
                      onPress={async () => {
                        try {
                          // Только покинуть чат, событие остается
                          if (chatToDelete) {
                            await deleteChat(chatToDelete.id, false);
                          }
                          setShowDeleteChatModal(false);
                          setChatToDelete(null);
                        } catch (error) {
                          logger.error('Failed to delete chat', error);
                          Alert.alert(t.common.error, t.chat.deleteChatFailed);
                        }
                      }}
                    >
                      <Text style={styles.deleteOptionText}>{t.inbox.onlyLeaveChat}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={async () => {
                      try {
                        await deleteChat(chatToDelete.id, false);
                        setShowDeleteChatModal(false);
                        setChatToDelete(null);
                      } catch (error) {
                        logger.error('Failed to delete chat', error);
                        Alert.alert(t.common.error, t.chat.deleteChatFailed);
                      }
                    }}
                  >
                    <Text style={styles.modalButtonText}>{t.common.delete}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 10 }]}
              onPress={() => {
                setShowDeleteChatModal(false);
                setChatToDelete(null);
              }}
            >
              <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора папки для чата */}
      <Modal
        visible={showFolderSelectModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowFolderSelectModal(false);
          setChatForFolder(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.folder.selectFolder}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFolderSelectModal(false);
                  setChatForFolder(null);
                }}
              >
                <AppIcon name="close" size={18} color={Palette.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {allFolders
                .filter(folder => folder.type === 'custom')
                .map(folder => {
                  const isInFolder = folder.chatIds?.includes(chatForFolder?.id || '') || false;
                  return (
                    <TouchableOpacity
                      key={folder.id}
                      style={styles.modalChatItem}
                      onPress={async () => {
                        try {
                          if (isInFolder) {
                            // Удаляем из папки
                            await removeChatFromMessageFolder(folder.id, chatForFolder?.id || '');
                          } else {
                            // Добавляем в папку
                            await addChatsToMessageFolder(folder.id, [chatForFolder?.id || '']);
                          }
                          await refreshMessageFolders();
                          setShowFolderSelectModal(false);
                          setChatForFolder(null);
                        } catch (error) {
                          logger.error('Failed to update chat folder', error);
                          Alert.alert(t.common.error, t.chat.folderUpdateFailed);
                        }
                      }}
                    >
                      <View style={styles.modalCheckbox}>
                        {isInFolder && (
                          <AppIcon name="check" size={14} color={Palette.accent} />
                        )}
                      </View>
                      <Text style={styles.modalChatName}>{folder.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              
              {allFolders.filter(folder => folder.type === 'custom').length === 0 && (
                <Text style={styles.modalEmptyText}>{t.inbox.noCustomFolders}</Text>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 10 }]}
              onPress={() => {
                setShowFolderSelectModal(false);
                setChatForFolder(null);
              }}
            >
              <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для передачи роли организатора */}
      <Modal
        visible={showTransferOrganizerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowTransferOrganizerModal(false);
          setEventIdForTransfer(null);
          setSelectedNewOrganizerId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.events.transferOrganizer}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTransferOrganizerModal(false);
                  setEventIdForTransfer(null);
                  setSelectedNewOrganizerId(null);
                }}
              >
                <AppIcon name="close" size={18} color={Palette.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.transferOrganizerDescription}>
              Выберите участника, которому хотите передать роль организатора. После передачи вы выйдете из события, а новый организатор будет управлять им.
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              {(() => {
                if (!eventIdForTransfer) return null;
                
                // Получаем событие
                const event = events.find(e => e.id === eventIdForTransfer);
                if (!event) return null;
                
                // Получаем список участников (исключая текущего организатора)
                const participants = getEventParticipants ? getEventParticipants(eventIdForTransfer) : [];
                const otherParticipants = participants.filter(pId => pId !== event.organizerId && pId !== currentUserId);
                
                if (otherParticipants.length === 0) {
                  return (
                    <View style={styles.emptyParticipantsContainer}>
                      <Text style={styles.emptyParticipantsText}>
                        Нет других участников для передачи роли
                      </Text>
                    </View>
                  );
                }
                
                return otherParticipants.map((participantId) => {
                  const participantData = getUserData(participantId);
                  const isSelected = selectedNewOrganizerId === participantId;
                  
                  return (
                    <TouchableOpacity
                      key={participantId}
                      style={[
                        styles.modalChatItem,
                        isSelected && styles.modalChatItemSelected
                      ]}
                      onPress={() => setSelectedNewOrganizerId(participantId)}
                    >
                      <Image
                        source={{ uri: sizedImage(participantData?.avatar, 40) || '' }}
                        style={styles.chatAvatar}
                      />
                      <View style={styles.chatInfo}>
                        <Text style={styles.chatName}>
                          {participantData?.name || participantData?.username || t.events.userFallback}
                        </Text>
                        {participantData?.username && participantData.username !== participantData?.name && (
                          <Text style={styles.lastMessage}>
                            @{participantData.username}
                          </Text>
                        )}
                      </View>
                      <View style={styles.modalCheckbox}>
                        <Text style={styles.modalCheckmark}>{isSelected ? '✓' : '○'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
            
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalButtonConfirm,
                !selectedNewOrganizerId && styles.modalButtonDisabled
              ]}
              onPress={async () => {
                if (!selectedNewOrganizerId || !eventIdForTransfer) return;
                
                try {
                  if (transferOrganizerRole) {
                    await transferOrganizerRole(eventIdForTransfer, selectedNewOrganizerId);
                    // После передачи роли выходим из события и удаляем чат
                    if (chatToDelete) {
                      await cancelEventParticipation(eventIdForTransfer, currentUserId || '');
                      await deleteChat(chatToDelete.id, true);
                    }
                    setShowTransferOrganizerModal(false);
                    setEventIdForTransfer(null);
                    setSelectedNewOrganizerId(null);
                    setChatToDelete(null);
                    setShowDeleteChatModal(false);
                  } else {
                    Alert.alert(t.common.error, t.events.transferRoleUnavailable);
                  }
                } catch (error: any) {
                  logger.error('Failed to transfer organizer role', error);
                  const errorMessage = error?.message || error?.body?.message || t.events.failedToTransferRole;
                  Alert.alert(t.common.error, errorMessage);
                }
              }}
              disabled={!selectedNewOrganizerId}
            >
              <Text style={styles.modalButtonText}>{t.inbox.transferRole}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 10 }]}
              onPress={() => {
                setShowTransferOrganizerModal(false);
                setEventIdForTransfer(null);
                setSelectedNewOrganizerId(null);
              }}
            >
              <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
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
    backgroundColor: '#0a0a0c',
  },
  chatsList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.45)',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    flex: 1,
  },
  chatAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 14,
    backgroundColor: '#3a3a3f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#f4f4f5',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  lastMessage: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 13.5,
  },
  chatTime: {
    color: 'rgba(244,244,245,0.34)',
    fontSize: 12,
  },
  chatRowContainer: {
    position: 'relative',
    marginHorizontal: ScreenPadding,
    marginBottom: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    position: 'relative',
    zIndex: 2,
  },
  swipeButtonsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  swipeButton: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  swipeButtonDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeButtonFolder: {
    backgroundColor: '#FF8D32',
  },
  swipeButtonText: {
    fontSize: 24,
  },
  deleteOptionsContainer: {
    marginVertical: 20,
  },
  deleteOption: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    marginBottom: 12,
  },
  deleteOptionText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '500',
  },
  modalDescription: {
    color: '#DDD',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  addChatsButton: {
    padding: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    alignItems: 'center',
  },
  addChatsButtonText: {
    color: '#FF8D32',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    color: '#f4f4f5',
    fontSize: 24,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#f4f4f5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  modalScrollView: {
    maxHeight: 300,
    marginBottom: 20,
  },
  modalEmptyText: {
    color: 'rgba(244,244,245,0.55)',
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF8D32',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCheckmark: {
    color: '#FF8D32',
    fontSize: 16,
  },
  modalChatName: {
    color: '#f4f4f5',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF8D32',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  removeChatButton: {
    marginRight: 20,
    marginLeft: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
    alignSelf: 'center',
  },
  removeChatButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  modalButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  transferOrganizerDescription: {
    color: '#DDD',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  emptyParticipantsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyParticipantsText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
  },
  modalChatItemSelected: {
    backgroundColor: 'rgba(255,141,50,0.10)',
    borderColor: '#FF8D32',
    borderWidth: 1,
  },
});

