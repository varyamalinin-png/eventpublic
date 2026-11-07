import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { AppIcon } from './ui/AppIcon';
import { ScreenPadding } from '../constants/DesignSystem';

interface MessageFolder {
  id: string;
  name: string;
  /** Сколько чатов папки с непрочитанными — правило то же, что у значка на вкладке. */
  unreadCount?: number;
}

interface MessageFoldersProps {
  folders: MessageFolder[];
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  /** Непрочитанные во всех чатах — для «All». */
  allUnreadCount?: number;
}

/**
 * Папки чатов над списком сообщений.
 *
 * Раньше рядом с названием стояло число чатов в папке — «Event chats (7)».
 * При одном новом сообщении в нижнем меню было непонятно, в какой папке оно
 * лежит, а число чатов читалось как число уведомлений. Теперь рядом с папкой
 * только непрочитанное, и только когда оно есть.
 */
export default function MessageFolders({
  folders,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  allUnreadCount,
}: MessageFoldersProps) {
  const { t } = useLanguage();

  const renderBadge = (count: number | undefined, selected: boolean) =>
    count && count > 0 ? (
      <View style={[styles.unreadBadge, selected && styles.unreadBadgeSelected]}>
        <Text style={[styles.unreadBadgeText, selected && styles.unreadBadgeTextSelected]}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.foldersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foldersScroll}>
        <TouchableOpacity
          style={[styles.folderItem, selectedFolder === null && styles.selectedFolder]}
          onPress={() => onFolderSelect(null)}
        >
          <Text style={[styles.folderText, selectedFolder === null && styles.selectedFolderText]}>
            {t.chat.all || 'All'}
          </Text>
          {renderBadge(allUnreadCount, selectedFolder === null)}
        </TouchableOpacity>

        {folders.map((folder) => {
          const selected = selectedFolder === folder.id;
          return (
            <TouchableOpacity
              key={folder.id}
              style={[styles.folderItem, selected && styles.selectedFolder]}
              onPress={() => onFolderSelect(folder.id)}
            >
              <Text style={[styles.folderText, selected && styles.selectedFolderText]}>
                {folder.name}
              </Text>
              {renderBadge(folder.unreadCount, selected)}
            </TouchableOpacity>
          );
        })}

        {/* Кнопка добавления папки */}
        <TouchableOpacity
          style={styles.addFolderButton}
          onPress={onCreateFolder}
        >
          {/* Иконка вместо текстового «+»: у глифа своя базовая линия,
              из-за неё он сидел в круге не по центру */}
          <AppIcon name="plus" size={14} color="rgba(244,244,245,0.55)" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  foldersContainer: {
    backgroundColor: 'transparent', // Убираем фон
    paddingHorizontal: ScreenPadding,
    paddingVertical: 12,
    borderBottomWidth: 0, // Убираем нижнюю границу
  },
  foldersScroll: {
    flexDirection: 'row',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedFolder: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  folderText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedFolderText: {
    color: '#f4f4f5',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    marginLeft: 6,
    backgroundColor: '#FF8D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeSelected: {
    backgroundColor: '#f4f4f5',
  },
  unreadBadgeText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '700',
  },
  unreadBadgeTextSelected: {
    color: '#FF8D32',
  },
  addFolderButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  addFolderIcon: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 16,
    fontWeight: 'normal',
  },
});
