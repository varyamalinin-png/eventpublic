import { StyleSheet } from 'react-native';

export const eventCardStyles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 12,
    overflow: 'visible', // Позволяем аватарке организатора выходить за пределы
  },
  swipeButtonContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1,
    alignItems: 'center',
  },
  swipeButtonContainerWithSecondary: {
    transform: [{ translateY: -60 }], // Смещаем вверх, если две кнопки
  },
  swipeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 10, // Отступ между кнопками
  },
  swipeButtonSecondary: {
    marginBottom: 0, // Для нижней кнопки отступ не нужен
  },
  swipeButtonIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  swipeButtonLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
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
    top: -13, // Еще ниже на 1 пиксель (всего на 2 пикселя ниже от исходного)
    right: -9, // Еще левее на 3 пикселя (всего на 6 пикселей левее от исходного)
    zIndex: 10,
  },
  organizerAvatar: {
    width: 69, // Увеличено в 1.3 раза: 53 * 1.3 ≈ 69
    height: 69,
    borderRadius: 34.5,
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
    borderWidth: 0.5,
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
    width: '100%', // Ширина задается динамически через родительский View
    height: 110, // Фиксированная высота
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
    minWidth: 200,
    height: 100,
    minHeight: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  chatPreviewTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  chatPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    width: 18, // Одинаковый размер с обычной карточкой
    height: 18,
    borderRadius: 9,
    borderWidth: 0.5, // Более тонкая обводка
    borderColor: '#FFFFFF',
  },
  miniatureMoreParticipants: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniatureMoreText: {
    color: '#FFFFFF',
    fontSize: 8, // Меньший шрифт для "+n" на мини-карточке
    fontWeight: 'bold',
  },
  // Метка "Вас пригласили"
  invitedLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  invitedLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // Стили для трех точек и модального окна действий
  eventActionsButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 10,
    padding: 8,
  },
  eventActionsButtonText: {
    fontSize: 20,
    color: '#999999',
    fontWeight: 'bold',
  },
  saveButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  parameterWrapper: {
    position: 'relative',
  },
  parameterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  parameterOverlayHidden: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  eyeIcon: {
    fontSize: 24,
  },
  titleContainer: {
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  titleWithPostsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postsCount: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  hiddenElement: {
    display: 'none',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  tagsContainerOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2A1A3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  tagText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

