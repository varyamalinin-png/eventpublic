import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { ScreenPadding } from '../constants/DesignSystem';
import type { FilterOptions } from '../utils/eventSearchFilters';
import { completeDateInput, formatDateTyping } from '../utils/eventSearchFilters';

type Props = {
  filters: FilterOptions;
  onChange: (next: FilterOptions) => void;
  onApply: () => void;
  onClear: () => void;
  availableTags: string[];
  /** Подписи меток: ключ с сервера -> текст для показа */
  tagLabels?: Record<string, string>;
  /**
   * Показывать ли выбор «онлайн/офлайн». На карте он бессмысленен: туда
   * попадают только события с координатами, то есть заведомо офлайновые.
   */
  showPlaceFilter?: boolean;
};

/**
 * Панель фильтров событий — ОДНА на ленту и на карту.
 *
 * Раньше разметка жила прямо в explore, и чтобы повторить фильтры на карте,
 * её пришлось бы скопировать. Копии расходятся: ровно так уже случилось с
 * сеткой профиля (см. components/ProfileEventsGrid), где в двух экранах
 * оказались разные раскладки. Поля, отступы и поведение теперь общие.
 *
 * Тап по пустому месту убирает клавиатуру: поля числовые, и на iOS у такой
 * клавиатуры нет кнопки «Готово».
 */
export default function EventFiltersPanel({
  filters,
  onChange,
  onApply,
  onClear,
  availableTags,
  tagLabels,
  showPlaceFilter = true,
}: Props) {
  const { t } = useLanguage();

  const num = (value?: number) => (value !== undefined ? String(value) : '');
  const setNum = (key: keyof FilterOptions) => (text: string) =>
    onChange({ ...filters, [key]: parseInt(text, 10) || undefined });

  const row = (label: string, children: React.ReactNode) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputs}>{children}</View>
    </View>
  );

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={styles.panel}>
        <Text style={styles.title}>{t.explore.filters}</Text>

        {row(t.explore.filterLabelParticipants, (
          <>
            <TextInput
              style={styles.input}
              placeholder={t.explore.from}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="numeric"
              value={num(filters.participantsMin)}
              onChangeText={setNum('participantsMin')}
            />
            <TextInput
              style={styles.input}
              placeholder={t.createEvent.to || 'To'}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="numeric"
              value={num(filters.participantsMax)}
              onChangeText={setNum('participantsMax')}
            />
          </>
        ))}

        {/* Точки в дате ставятся сами, год можно не вводить — допишется
            текущий (formatDateTyping / completeDateInput). */}
        {row(t.explore.filterLabelDate, (
          <>
            <TextInput
              style={styles.input}
              placeholder={t.explore.datePlaceholder}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="number-pad"
              maxLength={10}
              value={filters.dateFrom || ''}
              onChangeText={(text) =>
                onChange({ ...filters, dateFrom: formatDateTyping(text, filters.dateFrom) || undefined })
              }
              onEndEditing={() => {
                const done = completeDateInput(filters.dateFrom);
                if (done !== filters.dateFrom) onChange({ ...filters, dateFrom: done });
              }}
            />
            <TextInput
              style={styles.input}
              placeholder={t.explore.datePlaceholder}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="number-pad"
              maxLength={10}
              value={filters.dateTo || ''}
              onChangeText={(text) =>
                onChange({ ...filters, dateTo: formatDateTyping(text, filters.dateTo) || undefined })
              }
              onEndEditing={() => {
                const done = completeDateInput(filters.dateTo);
                if (done !== filters.dateTo) onChange({ ...filters, dateTo: done });
              }}
            />
          </>
        ))}

        {row(t.explore.filterLabelTime, (
          <TextInput
            style={[styles.input, styles.inputWide]}
            placeholder={t.explore.maximum}
            placeholderTextColor="rgba(244,244,245,0.3)"
            keyboardType="numeric"
            value={num(filters.timeHoursMax)}
            onChangeText={setNum('timeHoursMax')}
          />
        ))}

        {row(t.explore.filterLabelPrice, (
          <TextInput
            style={[styles.input, styles.inputWide]}
            placeholder={t.explore.maximum}
            placeholderTextColor="rgba(244,244,245,0.3)"
            keyboardType="numeric"
            value={num(filters.priceMax)}
            onChangeText={setNum('priceMax')}
          />
        ))}

        {row(t.explore.filterLabelOrganizerAge, (
          <>
            <TextInput
              style={styles.input}
              placeholder={t.explore.from}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="numeric"
              value={num(filters.organizerAgeMin)}
              onChangeText={setNum('organizerAgeMin')}
            />
            <TextInput
              style={styles.input}
              placeholder={t.createEvent.to || 'To'}
              placeholderTextColor="rgba(244,244,245,0.3)"
              keyboardType="numeric"
              value={num(filters.organizerAgeMax)}
              onChangeText={setNum('organizerAgeMax')}
            />
          </>
        ))}

        {showPlaceFilter && (
          <View style={styles.row}>
            <Text style={styles.label}>{t.explore.filterLabelPlace}</Text>
            <View style={styles.inputs}>
              {([undefined, 'online', 'offline'] as const).map(value => {
                const selected = filters.placeType === value;
                const caption = value === 'online'
                  ? t.explore.placeOnline
                  : value === 'offline'
                    ? t.explore.placeOffline
                    : t.explore.placeAny;
                return (
                  <TouchableOpacity
                    key={caption}
                    style={[styles.choice, selected && styles.choiceSelected]}
                    onPress={() => onChange({ ...filters, placeType: value })}
                  >
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]} numberOfLines={1}>
                      {caption}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {availableTags.length > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>{t.explore.tags}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsScroll}
              contentContainerStyle={styles.tagsContent}
              // Пока открыта клавиатура, первый тап по метке иначе только
              // закрывал бы клавиатуру, а саму метку не выбирал.
              keyboardShouldPersistTaps="handled"
            >
              {availableTags.map(tag => {
                const selected = filters.selectedTags?.includes(tag) || false;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tag, selected && styles.tagSelected]}
                    onPress={() => {
                      const current = filters.selectedTags || [];
                      const next = selected ? current.filter(x => x !== tag) : [...current, tag];
                      onChange({ ...filters, selectedTags: next.length > 0 ? next : undefined });
                    }}
                  >
                    <Text style={[styles.tagText, selected && styles.tagTextSelected]} numberOfLines={1}>
                      {tagLabels?.[tag] || tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.clearButton} onPress={onClear}>
            <Text style={styles.clearText}>{t.explore.clearFilters || 'Clear'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              // Клавиатуру убираем и по «Apply» — иначе панель закрывается,
              // а клавиатура остаётся висеть поверх экрана.
              Keyboard.dismiss();
              onApply();
            }}
          >
            <Text style={styles.applyText}>{t.explore.applyFilters || 'Apply'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#141417',
    paddingHorizontal: ScreenPadding,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  label: {
    color: 'rgba(244,244,245,0.6)',
    fontSize: 13,
    width: 104,
  },
  inputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f4f4f5',
    fontSize: 14,
  },
  inputWide: { flex: 1 },
  choice: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choiceSelected: { backgroundColor: '#FF8D32' },
  choiceText: { color: 'rgba(244,244,245,0.75)', fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: '#0A0A0A' },
  tagsScroll: { flex: 1 },
  tagsContent: { gap: 8, alignItems: 'center' },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagSelected: { backgroundColor: '#FF8D32', borderColor: '#FF8D32' },
  tagText: { color: 'rgba(244,244,245,0.75)', fontSize: 12.5, fontWeight: '600' },
  tagTextSelected: { color: '#0A0A0A' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  clearText: { color: 'rgba(244,244,245,0.7)', fontSize: 13, fontWeight: '600' },
  applyButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#FF8D32',
  },
  applyText: { color: '#0A0A0A', fontSize: 13, fontWeight: '700' },
});
