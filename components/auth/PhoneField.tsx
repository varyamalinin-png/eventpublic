import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Palette, Radius } from '../../constants/DesignSystem';
import { COUNTRIES, Country, DEFAULT_COUNTRY } from '../../constants/countries';
import { useLanguage } from '../../context/LanguageContext';

type Props = {
  /** Национальный номер без кода страны — только цифры. */
  nationalNumber: string;
  onChangeNationalNumber: (digits: string) => void;
  country: Country;
  onChangeCountry: (country: Country) => void;
  onBlur?: () => void;
  hasError?: boolean;
  disabled?: boolean;
};

export function PhoneField({
  nationalNumber,
  onChangeNationalNumber,
  country,
  onChangeCountry,
  onBlur,
  hasError,
  disabled,
}: Props) {
  const { language } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) =>
      c.nameRu.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      c.iso2.toLowerCase().includes(q)
    );
  }, [search]);

  const countryName = (c: Country) => (language === 'en' ? c.nameEn : c.nameRu);

  return (
    <>
      <View style={[styles.row, hasError && styles.rowError]}>
        <Pressable
          style={styles.countryButton}
          onPress={() => !disabled && setPickerOpen(true)}
          disabled={disabled}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dial}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
        <View style={styles.divider} />
        <TextInput
          style={styles.numberInput}
          placeholder="999 123-45-67"
          placeholderTextColor="rgba(244,244,245,0.35)"
          // Только цифры: буквы отсекаем на onChangeText, а не полагаемся
          // на одну лишь клавиатуру — на вебе type="tel" их не блокирует.
          keyboardType={Platform.OS === 'web' ? 'numeric' : 'phone-pad'}
          textContentType="telephoneNumber"
          value={nationalNumber}
          onChangeText={(text) => onChangeNationalNumber(text.replace(/\D/g, ''))}
          onBlur={onBlur}
          editable={!disabled}
          maxLength={15}
        />
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'en' ? 'Search country' : 'Поиск страны'}
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={search}
              onChangeText={setSearch}
              autoFocus={Platform.OS !== 'web'}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.iso2}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    onChangeCountry(item);
                    setPickerOpen(false);
                    setSearch('');
                  }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.countryRowName}>{countryName(item)}</Text>
                  <Text style={styles.countryRowDial}>{item.dial}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {language === 'en' ? 'Nothing found' : 'Ничего не найдено'}
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export { DEFAULT_COUNTRY };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rowError: { borderColor: Palette.danger },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  flag: { fontSize: 18 },
  dial: { color: Palette.text, fontSize: 16, fontWeight: '600' },
  chevron: { color: Palette.textDim, fontSize: 10, marginLeft: 2 },
  divider: { width: 1, height: 24, backgroundColor: '#2a2a2a' },
  numberInput: {
    flex: 1,
    color: Palette.text,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: Palette.background,
    color: Palette.text,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  countryRowName: { color: Palette.text, fontSize: 15, flex: 1 },
  countryRowDial: { color: Palette.textDim, fontSize: 14 },
  emptyText: {
    color: Palette.textDim,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
