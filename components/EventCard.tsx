import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useState, useRef } from 'react';
import { Link, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';

type EventCardProps = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  displayDate?: string; // для корректного отображения даты
  location: string;
  price: string;
  participants: number;
  maxParticipants: number;
  organizerAvatar: string;
  organizerId: string;
  variant?: 'default' | 'miniature_1' | 'miniature_2' | 'chat_preview';
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaAspectRatio?: number; // соотношение сторон медиа (ширина/высота)
  participantsList?: string[]; // список URL аватарок участников (для обратной совместимости)
  participantsData?: Array<{ avatar: string; userId: string; name?: string }>; // расширенные данные участников
  showSwipeAction?: boolean; // показывать ли свайп-действие
  showOrganizerAvatar?: boolean; // показывать ли аватарку организатора
  onMiniaturePress?: () => void; // кастомный обработчик клика для мини-карточек
  onLayout?: (height: number) => void; // колбэк для передачи высоты карточки
};

export default function EventCard({
  id,
  title,
  description,
  date,
  time,
  displayDate,
  location,
  price,
  participants,
  maxParticipants,
  organizerAvatar,
  organizerId,
  variant = 'default',
  mediaUrl,
  mediaType = 'image',
  mediaAspectRatio = 1,
  participantsList = [],
  participantsData = [],
  showSwipeAction = true,
  showOrganizerAvatar = true,
  onMiniaturePress,
  onLayout,
}: EventCardProps) {
  const router = useRouter();
  const { updateEvent, getUserData, sendEventRequest } = useEvents();
  const [showParticipants, setShowParticipants] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const [isJoined, setIsJoined] = useState(false);
  const [showGoButton, setShowGoButton] = useState(false);
  const swipeX = useRef(0); // Отслеживаем текущее значение свайпа
  
  // Определяем формат медиа: если соотношение > 1.5, то это горизонтальный формат
  const isWideFormat = mediaAspectRatio > 1.5;
  
  const handlePricePress = () => {
    // Переход на страницу платежки (пока заглушка)
    console.log('Переход на страницу платежки');
  };
  
  const handleDatePress = () => {
    // Переход в календарь
    router.push('/calendar');
  };
  
  const handleLocationPress = () => {
    // Переход на карту с отмеченной точкой
    router.push(`/map?eventId=${id}`);
  };
  
  const handleParticipantsPress = () => {
    setShowParticipantsModal(true);
  };

  const handleParticipantPress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  // Подготавливаем данные участников для отображения
  const getParticipantsForDisplay = () => {
    if (participantsData && participantsData.length > 0) {
      return participantsData.map(participant => {
        const userData = getUserData(participant.userId);
        return {
          ...participant,
          name: participant.name || userData.username || userData.name
        };
      });
    }
    // Fallback для старого формата - сопоставляем аватарки с существующими пользователями
    return participantsList.map((avatar, index) => {
      // Пытаемся найти пользователя по аватарке
      let userId = 'unknown-user';
      let name = `Участник ${index + 1}`;
      
      // Проверяем известные аватарки
      if (avatar.includes('women/68.jpg')) {
        userId = 'own-profile-1';
        const userData = getUserData(userId);
        name = userData.username || userData.name;
      } else {
        // Пытаемся найти пользователя по аватарке среди известных организаторов
        const knownUsers = ['organizer-1', 'organizer-2', 'organizer-3', 'organizer-4', 'organizer-5', 'organizer-6', 'organizer-7', 'organizer-8', 'organizer-9', 'organizer-10', 'organizer-11', 'organizer-12', 'organizer-13', 'organizer-14', 'organizer-15', 'organizer-16', 'organizer-17', 'organizer-18', 'organizer-19'];
        
        for (const knownUserId of knownUsers) {
          const userData = getUserData(knownUserId);
          if (userData.avatar === avatar) {
            userId = knownUserId;
            name = userData.username || userData.name;
            break;
          }
        }
      }
      
      return {
        avatar,
        userId,
        name
      };
    });
  };

  const displayParticipants = getParticipantsForDisplay();

  const handleGoPress = () => {
    // Переходим в календарь в режиме предпросмотра на дату события
    // Используем формат YYYY-MM-DD из date (уже в правильном формате)
    const dateParam = date; // date уже в формате YYYY-MM-DD
    router.push(`/calendar?date=${dateParam}&mode=preview&eventId=${id}`);
  };
  
  const handleScheduleEvent = () => {
    // Отправляем заявку на участие в событии (старая логика - сохраняем для совместимости)
    if (organizerId !== 'own-profile-1') {
      // Если пользователь не организатор - отправляем заявку
      sendEventRequest(id, 'own-profile-1');
      setIsJoined(true);
    } else {
      // Если пользователь организатор - добавляем в событие напрямую
      updateEvent(id, {
        participants: participants + 1,
        participantsList: [...participantsList, 'https://randomuser.me/api/portraits/women/68.jpg']
      });
      setIsJoined(true);
    }
    
    // Анимация возврата карточки
    setShowGoButton(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    
    // Переходим в календарь
    setTimeout(() => {
      router.push('/calendar');
    }, 300);
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { 
      useNativeDriver: true,
      listener: (event: any) => {
        // Отслеживаем текущее значение свайпа для обновления видимости кнопки
        swipeX.current = event.nativeEvent.translationX;
        // Показываем кнопку если свайпнуто влево более чем на 50px
        if (event.nativeEvent.translationX < -50) {
          setShowGoButton(true);
        } else {
          setShowGoButton(false);
        }
      }
    }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Если свайп влево на достаточное расстояние
      if (translationX < -100 || (translationX < -50 && velocityX < -500)) {
        setShowGoButton(true);
        Animated.spring(translateX, {
          toValue: -120,
          useNativeDriver: true,
        }).start();
      } else {
        // Возвращаем карточку в исходное положение
        setShowGoButton(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Для миниатюрных вариантов не показываем свайп
  if (variant !== 'default' || !showSwipeAction) {
  return (
      <TouchableOpacity onPress={() => {
        console.log('🟢 Miniature card clicked, onMiniaturePress:', !!onMiniaturePress, 'variant:', variant);
        if (onMiniaturePress) {
          console.log('🟢 Calling onMiniaturePress');
          onMiniaturePress();
        } else {
          console.log('🟢 No onMiniaturePress handler');
          // Для мини-карточек навигация не нужна - они просто открывают модальное окно
        }
      }}>
        <View style={[
          variant === 'miniature_1' && styles.miniatureCard1,
          variant === 'miniature_2' && styles.miniatureCard2,
        variant === 'chat_preview' && styles.chatPreview
      ]}>
          {/* Фоновое изображение события */}
          {mediaUrl && (
            <View style={styles.miniatureBackgroundContainer}>
              <Image 
                source={{ uri: mediaUrl }} 
                style={styles.miniatureBackgroundImage} 
              />
              {mediaType === 'video' && (
                <View style={styles.miniaturePlayButton}>
                  <Text style={styles.miniaturePlayIcon}>▶️</Text>
                </View>
              )}
            </View>
          )}

          {/* Аватарка организатора в правом верхнем углу */}
          {showOrganizerAvatar && (
            <View style={styles.miniatureOrganizerAvatarContainer}>
              <Link href={`/profile/${organizerId}`} asChild>
  <TouchableOpacity>
    <Image 
      source={{ uri: organizerAvatar }} 
                    style={styles.miniatureOrganizerAvatar} 
    />
  </TouchableOpacity>
</Link>
            </View>
          )}

          {/* Участники в правом нижнем углу */}
          {participantsList && participantsList.length > 0 && (
            <View style={styles.miniatureParticipantsContainer}>
              {participantsList.slice(0, 3).map((avatarUrl, index) => (
                <Image 
                  key={index}
                  source={{ uri: avatarUrl }} 
                  style={[
                    styles.miniatureParticipantAvatar,
                    { marginLeft: index > 0 ? -8 : 0 }
                  ]} 
                />
              ))}
              {participantsList.length > 3 && (
                <View style={[styles.miniatureParticipantAvatar, styles.miniatureMoreParticipants]}>
                  <Text style={styles.miniatureMoreText}>+{participantsList.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Для обычных карточек с свайп-действием
  return (
    <View style={styles.swipeContainer}>
      {/* Фиолетовая кнопка GO - показывается только при свайпе */}
      {showGoButton && (
        <View style={styles.goButtonContainer}>
          <TouchableOpacity style={styles.goButton} onPress={handleGoPress}>
            <Text style={styles.goButtonText}>GO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Карточка с жестом свайпа */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View 
          style={[
            styles.card,
            { transform: [{ translateX }] }
          ]}
          onLayout={(event) => {
            if (onLayout) {
              onLayout(event.nativeEvent.layout.height);
            }
          }}
        >

          {/* Адаптивная структура в зависимости от формата медиа */}
          {isWideFormat ? (
            /* Горизонтальный формат: медиа слева, контент справа */
            <View style={styles.horizontalLayout}>
              {mediaUrl && (
                <View style={styles.mediaContainerHorizontal}>
                  <Image 
                    source={{ uri: mediaUrl }} 
                    style={styles.mediaImageHorizontal} 
                  />
                  {mediaType === 'video' && (
                    <View style={styles.playButton}>
                      <Text style={styles.playIcon}>▶️</Text>
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.contentContainer}>
                <Text style={styles.title} numberOfLines={1}>
                  {title || 'Название события'}
                </Text>
                
                <Text style={styles.description} numberOfLines={3}>
                  {description || 'Описание события'}
                </Text>
                
                {/* Параметры */}
                <View style={styles.parametersContainer}>
                  <TouchableOpacity onPress={handlePricePress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>💰</Text>
                    <Text style={styles.parameterText}>{price || '0₽'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleDatePress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>📅</Text>
                    <Text style={styles.parameterText}>{displayDate || date || 'Дата'}</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>🕐</Text>
                    <Text style={styles.parameterText}>{time || 'Время'}</Text>
                  </View>
                  
                  <TouchableOpacity onPress={handleLocationPress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>📍</Text>
                    <Text style={styles.parameterText} numberOfLines={1}>{location || 'Место'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleParticipantsPress} style={styles.participantsParameterItem}>
                    <View style={styles.participantsMiniAvatars}>
                      {displayParticipants.slice(0, 3).map((participant, index) => (
                        <Image 
                          key={index}
                          source={{ uri: participant.avatar }} 
                          style={[
                            styles.participantMiniAvatar,
                            { marginLeft: index > 0 ? -6 : 0 }
                          ]} 
                        />
                      ))}
                      {displayParticipants.length > 3 && (
                        <View style={[styles.participantMiniAvatar, styles.participantMoreMini]}>
                          <Text style={styles.participantMoreMiniText}>+{displayParticipants.length - 3}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.participantsCountText}>{participants}/{maxParticipants}</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Динамические аватарки участников */}
                {showParticipants && displayParticipants.length > 0 && (
                  <View style={styles.participantsAvatars}>
                    {displayParticipants.slice(0, 5).map((participant, index) => (
                      <TouchableOpacity 
                        key={index}
                        onPress={() => handleParticipantPress(participant.userId)}
                        style={styles.participantAvatarContainer}
                      >
                        <Image 
                          source={{ uri: participant.avatar }} 
                          style={styles.participantAvatar} 
                        />
                        {participant.name && (
                          <Text style={styles.participantName}>{participant.name}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                    {displayParticipants.length > 5 && (
                      <Text style={styles.moreParticipants}>+{displayParticipants.length - 5}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Вертикальный формат: медиа сверху, контент снизу */
            <View style={styles.verticalLayout}>
              {mediaUrl && (
                <View style={styles.mediaContainerVertical}>
                  <Image 
                    source={{ uri: mediaUrl }} 
                    style={styles.mediaImageVertical} 
                  />
                  {mediaType === 'video' && (
                    <View style={styles.playButton}>
                      <Text style={styles.playIcon}>▶️</Text>
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.contentContainer}>
                <Text style={styles.title} numberOfLines={1}>
                  {title || 'Название события'}
                </Text>
                
        <Text style={styles.description} numberOfLines={2}>
                  {description || 'Описание события'}
        </Text>

                {/* Параметры */}
                <View style={styles.parametersContainer}>
                  <TouchableOpacity onPress={handlePricePress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>💰</Text>
                    <Text style={styles.parameterText}>{price || '0₽'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleDatePress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>📅</Text>
                    <Text style={styles.parameterText}>{displayDate || date || 'Дата'}</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>🕐</Text>
                    <Text style={styles.parameterText}>{time || 'Время'}</Text>
                  </View>
                  
                  <TouchableOpacity onPress={handleLocationPress} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>📍</Text>
                    <Text style={styles.parameterText} numberOfLines={1}>{location || 'Место'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleParticipantsPress} style={styles.participantsParameterItem}>
                    <View style={styles.participantsMiniAvatars}>
                      {displayParticipants.slice(0, 3).map((participant, index) => (
                        <Image 
                          key={index}
                          source={{ uri: participant.avatar }} 
                          style={[
                            styles.participantMiniAvatar,
                            { marginLeft: index > 0 ? -6 : 0 }
                          ]} 
                        />
                      ))}
                      {displayParticipants.length > 3 && (
                        <View style={[styles.participantMiniAvatar, styles.participantMoreMini]}>
                          <Text style={styles.participantMoreMiniText}>+{displayParticipants.length - 3}</Text>
                        </View>
                      )}
          </View>
                    <Text style={styles.participantsCountText}>{participants}/{maxParticipants}</Text>
                  </TouchableOpacity>
          </View>
          
          
                {/* Динамические аватарки участников */}
                {showParticipants && displayParticipants.length > 0 && (
                  <View style={styles.participantsAvatars}>
                    {displayParticipants.slice(0, 5).map((participant, index) => (
                      <TouchableOpacity 
                        key={index}
                        onPress={() => handleParticipantPress(participant.userId)}
                        style={styles.participantAvatarContainer}
                      >
                        <Image 
                          source={{ uri: participant.avatar }} 
                          style={styles.participantAvatar} 
                        />
                        {participant.name && (
                          <Text style={styles.participantName}>{participant.name}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                    {displayParticipants.length > 5 && (
                      <Text style={styles.moreParticipants}>+{displayParticipants.length - 5}</Text>
                    )}
          </View>
                )}
          </View>
        </View>
          )}
        </Animated.View>
      </PanGestureHandler>
      
      {/* Аватарка организатора в правом верхнем углу - вынесена за пределы карточки */}
      {showOrganizerAvatar && (
        <View style={styles.organizerAvatarContainer}>
          <Link href={`/profile/${organizerId}`} asChild>
            <TouchableOpacity>
              <Image 
                source={{ uri: organizerAvatar }} 
                style={styles.organizerAvatar} 
              />
            </TouchableOpacity>
          </Link>
        </View>
      )}

      {/* Модальное окно с участниками */}
      <Modal
        visible={showParticipantsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Участники события</Text>
              <TouchableOpacity 
                onPress={() => setShowParticipantsModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
        </View>

            <ScrollView style={styles.participantsList}>
              {displayParticipants.map((participant, index) => {
                const userData = getUserData(participant.userId);
                return (
                  <TouchableOpacity 
                    key={index}
                    style={styles.participantItem}
                    onPress={() => {
                      setShowParticipantsModal(false);
                      handleParticipantPress(participant.userId);
                    }}
                  >
                    <Image 
                      source={{ uri: participant.avatar }} 
                      style={styles.participantModalAvatar}
                    />
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantModalName}>{participant.name}</Text>
                      <Text style={styles.participantUsername}>@{userData.username}</Text>
        </View>
      </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  goButtonContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1,
  },
  goButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'visible', // Аватарка теперь снаружи карточки
    minHeight: 350, // Минимальная высота для лучшего отображения контента
  },
  organizerAvatarContainer: {
    position: 'absolute',
    top: -15, // Слегка выходим за пределы карточки вверх
    right: -15, // Слегка выходим за пределы карточки вправо
    zIndex: 10,
  },
  organizerAvatar: {
    width: 80, // Уменьшаем в 1.5 раза: 120 / 1.5 = 80
    height: 80,
    borderRadius: 40,
    borderWidth: 0, // Убираем белую рамку
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  horizontalLayout: {
    flexDirection: 'row',
    paddingTop: 40,
    paddingBottom: 15,
    paddingLeft: 140, // Отступ для фото слева
    position: 'relative',
  },
  verticalLayout: {
    flexDirection: 'column',
    paddingTop: 170,
    paddingBottom: 15,
    position: 'relative',
  },
  mediaContainerHorizontal: {
    width: 120,
    height: '100%',
    marginRight: 12,
    borderRadius: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  mediaContainerVertical: {
    width: '100%',
    height: 160,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  mediaImageHorizontal: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaImageVertical: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 18,
    marginBottom: 8,
  },
  parametersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  parameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  parameterEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  parameterText: {
    fontSize: 12,
    color: '#DDDDDD',
    fontWeight: '500',
  },
  participantsAvatars: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  participantAvatarContainer: {
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  participantName: {
    fontSize: 10,
    color: '#AAAAAA',
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 60,
  },
  moreParticipants: {
    fontSize: 12,
    color: '#AAAAAA',
    alignSelf: 'center',
    marginLeft: 4,
  },
  // Стили для мини-аватаров участников в параметрах
  participantsParameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  participantsMiniAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  participantMiniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  participantMoreMini: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreMiniText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  participantsCountText: {
    fontSize: 12,
    color: '#DDDDDD',
    fontWeight: '500',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  // Миниатюрные варианты для профилей
  miniatureCard1: {
    width: 110, // Уменьшил с 160 до 110 для трех колонок
    height: 110, // Уменьшил с 160 до 110 для трех колонок
    borderRadius: 12,
    overflow: 'visible', // Изменяем на visible для больших аватарок
    position: 'relative',
    backgroundColor: '#2a2a2a',
    marginBottom: 10,
    marginTop: 5,
  },
  miniatureCard2: {
    width: 100, // Уменьшил с 140 до 100 для трех колонок
    height: 100, // Уменьшил с 140 до 100 для трех колонок
    borderRadius: 12,
    overflow: 'visible', // Изменяем на visible для больших аватарок
    position: 'relative',
    backgroundColor: '#2a2a2a',
    marginBottom: 10,
    marginTop: 5,
  },
  chatPreview: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#2a2a2a',
  },
  // Стили для фонового изображения мини-карточки
  miniatureBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12, // Скругление углов как у карточки
    overflow: 'hidden', // Обрезаем содержимое по скругленным углам
  },
  miniatureBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 12, // Скругление углов изображения
  },
  miniatureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12, // Скругление углов как у карточки
  },
  miniaturePlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniaturePlayIcon: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  // Аватарка организатора для мини-карточки
  miniatureOrganizerAvatarContainer: {
    position: 'absolute',
    top: -8, // Слегка выходим за пределы мини-карточки вверх
    right: -8, // Слегка выходим за пределы мини-карточки вправо
    zIndex: 10,
  },
  miniatureOrganizerAvatar: {
    width: 32, // Уменьшил с 48 до 32 пропорционально
    height: 32,
    borderRadius: 16,
    borderWidth: 0, // Убираем белую рамку
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  // Участники для мини-карточки
  miniatureParticipantsContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  miniatureParticipantAvatar: {
    width: 16, // Уменьшил с 20 до 16 пропорционально
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  miniatureMoreParticipants: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniatureMoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Стили для модального окна участников
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    padding: 20,
  },
  modalScrollView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  participantsList: {
    maxHeight: 400,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantModalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantModalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 14,
    color: '#666666',
  },
});