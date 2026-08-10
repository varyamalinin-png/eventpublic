import { createElement } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, Radius } from '../../constants/DesignSystem';

// WebView не существует на вебе как нативный компонент — там показываем
// тот же документ через iframe (тоже без ухода со страницы формы).
let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebView = require('react-native-webview').WebView;
}

export type LegalDocKind = 'terms' | 'privacy';

type Props = {
  kind: LegalDocKind | null;
  onClose: () => void;
};

const TITLES: Record<LegalDocKind, string> = {
  terms: 'Условия использования',
  privacy: 'Политика конфиденциальности',
};

export function LegalDocumentModal({ kind, onClose }: Props) {
  return (
    <Modal visible={!!kind} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{kind ? TITLES[kind] : ''}</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        {kind && Platform.OS === 'web' &&
          createElement('iframe', {
            src: `/${kind}`,
            style: { flex: 1, border: 'none', backgroundColor: Palette.background },
          })}
        {kind && Platform.OS !== 'web' && WebView && (
          <WebView source={{ uri: `https://iwent.ru/${kind}` }} style={styles.webview} />
        )}
      </View>
    </Modal>
  );
}

/**
 * Открывает документ поверх текущего экрана (модалкой — на native через
 * WebView, на вебе через iframe), не уводя пользователя со страницы:
 * иначе он теряет то, что успел заполнить в форме регистрации.
 */
export function openLegalDoc(kind: LegalDocKind, setModalKind: (k: LegalDocKind) => void) {
  setModalKind(kind);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  title: { color: Palette.text, fontSize: 17, fontWeight: '700', flex: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: { color: Palette.text, fontSize: 15 },
  webview: { flex: 1, backgroundColor: Palette.background },
});
