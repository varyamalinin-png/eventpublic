import { useRef, useState } from 'react';
import { NativeSyntheticEvent, Platform, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { Palette, Radius } from '../../constants/DesignSystem';

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Вызывается, когда набраны все шесть цифр — чтобы не жать «подтвердить» вручную. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
};

/**
 * Шесть отдельных окошек под код из письма.
 *
 * Каждая ячейка — свой TextInput, но значение хранится одной строкой: так проще
 * и вставить код целиком из буфера, и не разъехаться при удалении из середины.
 */
export function OtpInput({ value, onChange, onComplete, disabled, hasError }: Props) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);

  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  const setAt = (index: number, raw: string) => {
    // Из буфера может прилететь весь код разом — тогда раскладываем его по ячейкам.
    const onlyDigits = raw.replace(/\D/g, '');
    if (!onlyDigits) return;

    const next = (value.slice(0, index) + onlyDigits + value.slice(index + onlyDigits.length))
      .replace(/\D/g, '')
      .slice(0, LENGTH);
    onChange(next);

    const landed = Math.min(index + onlyDigits.length, LENGTH - 1);
    inputs.current[landed]?.focus();
    if (next.length === LENGTH) {
      inputs.current[LENGTH - 1]?.blur();
      onComplete?.(next);
    }
  };

  const handleKeyPress = (index: number) => (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    // Пустая ячейка — стираем предыдущую и уходим туда, иначе курсор залипает.
    if (!value[index]) {
      const prev = Math.max(0, index - 1);
      onChange(value.slice(0, prev));
      inputs.current[prev]?.focus();
    } else {
      onChange(value.slice(0, index) + value.slice(index + 1));
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length: LENGTH }).map((_, i) => {
        const filled = !!value[i] && value[i] !== ' ';
        return (
          <TextInput
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            style={[
              styles.cell,
              focused === i && styles.cellFocused,
              filled && styles.cellFilled,
              hasError && styles.cellError,
            ]}
            value={filled ? digits[i] : ''}
            onChangeText={(text) => setAt(i, text)}
            onKeyPress={handleKeyPress(i)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            keyboardType="number-pad"
            // Код из СМС/почты подставляется системой в первую ячейку
            textContentType={i === 0 ? 'oneTimeCode' : 'none'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={Platform.OS === 'web' ? LENGTH : 2}
            editable={!disabled}
            selectTextOnFocus
            textAlign="center"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    height: 56,
    borderRadius: Radius.md ?? 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
  },
  cellFocused: { borderColor: Palette.accent },
  cellFilled: { borderColor: 'rgba(255,255,255,0.28)' },
  cellError: { borderColor: Palette.danger ?? '#FF3B30' },
});
