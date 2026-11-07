import React from 'react';
import { View, Text } from 'react-native';
import EventCard from './EventCard';
import FolderCard from './FolderCard';
import type { Event } from '../types';
import type { EventFolder } from '../types/EventFolder';

export type ProfileGridItem =
  | { type: 'event'; data: Event; sortKey?: number }
  | { type: 'folder'; data: EventFolder; sortKey?: number };

type Props = {
  items: ProfileGridItem[];
  /** Что показать вместо сетки, когда элементов нет */
  emptyText: string;
  emptyTextStyle?: any;
  /** Ширина экрана — экраны считают её по-разному (web/native), поэтому передаётся снаружи */
  screenWidth: number;
  onFolderPress: (folder: EventFolder) => void;
  onEventPress: (event: Event) => () => void;
  onEventLongPress?: (event: Event) => (() => void) | undefined;
  /** Чей профиль смотрим — прокидывается в EventCard для персональных фото */
  viewerUserId?: string;
  context?: string;
  /** Папка, внутри которой показана сетка — уходит в EventCard вместе с context="folder" */
  folderId?: string;
  /** Свайп по карточке. В режиме выбора его нужно отключать. */
  showSwipeAction?: boolean;
  /** Оверлей поверх ячейки события (режим выбора) */
  renderEventOverlay?: (event: Event) => React.ReactNode;
};

const GAP = 8;
const PADDING = 20;
const COLUMNS = 3;

/**
 * Сетка «события + папки» для профиля — ОДНА на свой профиль и на чужой.
 *
 * Раньше это были две независимые реализации, и они разъехались: в своём
 * профиле папка занимала весь ряд (3 слота), а в чужом — 2 колонки из 3.
 * Здесь принят вариант своего профиля: при ширине в 2 слота рядом оставался
 * пустой квадрат, если следующая карточка не помещалась, и в сетке зияли дыры.
 */
export default function ProfileEventsGrid({
  items,
  emptyText,
  emptyTextStyle,
  screenWidth,
  onFolderPress,
  onEventPress,
  onEventLongPress,
  viewerUserId,
  context,
  folderId,
  showSwipeAction = false,
  renderEventOverlay,
}: Props) {
  const containerW = screenWidth - PADDING * 2;
  const CARD_W = Math.floor((containerW - GAP * (COLUMNS - 1)) / COLUMNS);
  // Папка — квадрат 2×2, то есть ровно четыре карточки события.
  const FOLDER_SPAN = 2;
  const FOLDER_W = CARD_W * FOLDER_SPAN + GAP;
  const STEP = CARD_W + GAP;

  // Временные превью-события в профиле показывать нельзя: ленты их и так
  // отфильтровывают (EventsContext), а профиль читал events напрямую — из-за
  // этого недоудалённое превью выглядело как карточка-дубль с дефолтными
  // параметрами. Страховка на случай, если превью не успело удалиться.
  const visibleItems = items.filter(
    item => !(item.type === 'event' && (item.data.id.includes('-temp') || item.data.id.startsWith('preview-'))),
  );

  if (visibleItems.length === 0) {
    return <Text style={emptyTextStyle}>{emptyText}</Text>;
  }

  /**
   * Укладка сетки: событие — клетка 1×1, папка — квадрат 2×2.
   *
   * Раньше папка занимала весь ряд целиком. Это не оставляло дыр, но и
   * половину ширины тратило впустую: рядом с папкой ничего не стояло.
   * Квадрат 2×2 оставляет свободной третью колонку на две строки — туда
   * встают два следующих по времени события, и пустых мест по бокам нет.
   *
   * Алгоритм жадный: идём по элементам в хронологическом порядке и для
   * каждого ищем ПЕРВУЮ позицию, куда он влезает, сканируя строки сверху
   * вниз и колонки слева направо. Папка пробует колонки 0–1, затем 1–2;
   * если в текущей строке места нет — уходит ниже, а одиночные события тем
   * временем занимают оставшуюся колонку рядом с ней.
   *
   * Хронология при этом сохраняется «по строкам», а не строго по клеткам:
   * рядом с папкой окажутся события, идущие за ней. Строгий порядок без
   * пустот невозможен в принципе — либо дыры, либо соседство не по минуте.
   */
  const occupancy: boolean[][] = [];
  const ensureRow = (row: number) => {
    while (occupancy.length <= row) occupancy.push(new Array(COLUMNS).fill(false));
  };
  const fits = (row: number, col: number, span: number) => {
    if (col + span > COLUMNS) return false;
    for (let r = row; r < row + span; r++) {
      ensureRow(r);
      for (let c = col; c < col + span; c++) {
        if (occupancy[r][c]) return false;
      }
    }
    return true;
  };
  const occupy = (row: number, col: number, span: number) => {
    for (let r = row; r < row + span; r++) {
      ensureRow(r);
      for (let c = col; c < col + span; c++) occupancy[r][c] = true;
    }
  };

  type PlacedItem = { item: ProfileGridItem; row: number; col: number; span: number };
  const placed: PlacedItem[] = [];
  // Строки выше этой заняты полностью — искать там нечего.
  let firstOpenRow = 0;

  visibleItems.forEach(item => {
    const span = item.type === 'folder' ? FOLDER_SPAN : 1;
    let row = firstOpenRow;
    let placedHere = false;
    while (!placedHere) {
      ensureRow(row);
      for (let col = 0; col + span <= COLUMNS; col++) {
        if (fits(row, col, span)) {
          occupy(row, col, span);
          placed.push({ item, row, col, span });
          placedHere = true;
          break;
        }
      }
      if (!placedHere) row += 1;
    }
    while (firstOpenRow < occupancy.length && occupancy[firstOpenRow].every(Boolean)) {
      firstOpenRow += 1;
    }
  });

  const rowsCount = placed.reduce((max, p) => Math.max(max, p.row + p.span), 0);
  const gridHeight = rowsCount > 0 ? rowsCount * CARD_W + (rowsCount - 1) * GAP : 0;

  return (
    // Два слоя намеренно: внешний держит боковые отступы, внутренний — начало
    // координат для абсолютных детей.
    //
    // Абсолютно позиционированные элементы отсчитывают left от КРАЯ родителя,
    // а не от его padding-бокса, поэтому сетка с paddingHorizontal на том же
    // View уезжала влево под отступ. Внутренний слой без padding убирает этот
    // вопрос: его левый край и есть начало содержимого.
    <View style={{ paddingHorizontal: PADDING }}>
      <View style={{ width: containerW, height: gridHeight, position: 'relative' }}>
      {placed.map(({ item, row, col, span }) => {
        const isFolder = item.type === 'folder';
        const size = isFolder ? FOLDER_W : CARD_W;
        const cell = {
          position: 'absolute' as const,
          left: col * STEP,
          top: row * STEP,
          width: size,
          height: size,
          borderRadius: 14,
          overflow: 'hidden' as const,
        };

        if (isFolder) {
          const folder = item.data;
          return (
            <View key={`f-${folder.id}`} style={cell} pointerEvents="box-none">
              <FolderCard folder={folder} onPress={() => onFolderPress(folder)} variant="profile" />
            </View>
          );
        }

        const event = item.data;
        return (
          <View key={event.id} style={cell}>
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
              showSwipeAction={showSwipeAction}
              showOrganizerAvatar={false}
              mediaUrl={event.mediaUrl}
              mediaType={event.mediaType}
              mediaAspectRatio={event.mediaAspectRatio}
              participantsList={event.participantsList}
              participantsData={event.participantsData}
              context={context as any}
              folderId={folderId}
              viewerUserId={viewerUserId}
              onMiniaturePress={onEventPress(event)}
              onLongPress={onEventLongPress?.(event)}
            />
            {renderEventOverlay?.(event)}
          </View>
        );
        })}
      </View>
    </View>
  );
}
