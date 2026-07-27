import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Modal } from 'react-native';
import { useEvents } from '../context/EventsContext';
import { AppIcon } from './ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { useLanguage } from '../context/LanguageContext';

interface AddToFolderModalProps {
  visible?: boolean;
  eventIds: string[];
  onClose: () => void;
  onSubmit: (folderIds: string[]) => void;
  onCreateNewFolder?: () => void;
}

export default function AddToFolderModal({ visible = true, eventIds, onClose, onSubmit, onCreateNewFolder }: AddToFolderModalProps) {
  const { t } = useLanguage();
  const { eventFolders } = useEvents();
  const [selectedFolderIdsLocal, setSelectedFolderIdsLocal] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    const next = new Set(selectedFolderIdsLocal);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    setSelectedFolderIdsLocal(next);
  };

  const inner = (
    <View style={styles.sheet}>
      {/* Handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.folder.selectFolder}</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="close" size={16} color={Palette.textDim} />
        </TouchableOpacity>
      </View>

      {/* Folder list */}
      <ScrollView
        style={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0 ? (
          eventFolders.map((folder: any, index: number) => {
            const isSelected = selectedFolderIdsLocal.has(folder.id);
            const isLast = index === eventFolders.length - 1;

            return (
              <TouchableOpacity
                key={folder.id}
                style={[styles.folderRow, !isLast && styles.folderRowBorder, isSelected && styles.folderRowSelected]}
                onPress={() => toggleFolder(folder.id)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/44' }}
                  style={styles.folderAvatar}
                />
                <View style={styles.folderInfo}>
                  <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                  <Text style={styles.folderCount}>
                    {folder.eventCount || folder.events?.length || 0} событий
                  </Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <AppIcon name="check" size={13} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.folder.noFolders}</Text>
          </View>
        )}
      </ScrollView>

      {/* Create new folder */}
      {onCreateNewFolder && (
        <TouchableOpacity style={styles.createBtn} onPress={onCreateNewFolder} activeOpacity={0.75}>
          <View style={styles.createBtnIcon}>
            <AppIcon name="add" size={16} color={Palette.accent} />
          </View>
          <Text style={styles.createBtnText}>{t.folder.createNew}</Text>
        </TouchableOpacity>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, selectedFolderIdsLocal.size === 0 && styles.submitBtnDisabled]}
          onPress={() => onSubmit(Array.from(selectedFolderIdsLocal))}
          disabled={selectedFolderIdsLocal.size === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {t.common.add}{selectedFolderIdsLocal.size > 0 ? ` (${selectedFolderIdsLocal.size})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Support both modal-wrapped and inline usage
  if (visible !== undefined) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          {inner}
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.overlayAbsolute}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  overlayAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: '#18181e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '80%',
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.text,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    maxHeight: 320,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  folderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  folderRowSelected: {
    // subtle tint handled by checkbox
  },
  folderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Palette.surfaceElevated,
  },
  folderInfo: {
    flex: 1,
    gap: 3,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.text,
    letterSpacing: -0.1,
  },
  folderCount: {
    fontSize: 12,
    color: Palette.textDim,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Palette.textFaint,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,141,50,0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,141,50,0.05)',
    gap: 10,
  },
  createBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,141,50,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.accent,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.7)',
  },
  submitBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: Palette.accent,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
  },
});
