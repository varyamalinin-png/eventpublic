import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, Platform, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from './ui/AppIcon';
import { Palette } from '../constants/DesignSystem';

interface CreateFolderModalProps {
  visible?: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, coverPhoto?: { uri: string; type: string; name: string }) => void;
}

export default function CreateFolderModal({ visible = true, onClose, onSubmit }: CreateFolderModalProps) {

  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<{ uri: string; type: string; name: string } | null>(null);

  const handlePickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            setCoverPhoto({
              uri: URL.createObjectURL(file),
              type: file.type || 'image/jpeg',
              name: file.name || 'cover.jpg',
              file: file,
            } as any);
          }
        };
        input.click();
        return;
      }

      const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (hasPermission.status !== 'granted') {
        Alert.alert(t.common.error, 'Нет доступа к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result && !result.canceled && result.assets && result.assets[0]) {
        setCoverPhoto({
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || 'image/jpeg',
          name: 'cover.jpg',
        });
      }
    } catch (error) {
      Alert.alert(t.common.error, t.eventProfile.photoPickFailed);
    }
  };

  const handleSubmit = () => {
    onSubmit(name, description, coverPhoto || undefined);
  };

  const inner = (
    <View style={styles.sheet}>
      {/* Handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.folder.createTitle}</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="close" size={16} color={Palette.textDim} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Cover photo */}
        <TouchableOpacity style={styles.coverSelector} onPress={handlePickImage} activeOpacity={0.8}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto.uri }} style={styles.coverPreview} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverPlaceholderIcon}>
                <AppIcon name="image" size={22} color={Palette.textDim} />
              </View>
              <Text style={styles.coverPlaceholderText}>{t.folder.addCover}</Text>
              <Text style={styles.coverPlaceholderSub}>JPG, PNG, WEBP</Text>
            </View>
          )}
        </TouchableOpacity>

        {coverPhoto && (
          <TouchableOpacity
            style={styles.removePhotoBtn}
            onPress={() => setCoverPhoto(null)}
            activeOpacity={0.7}
          >
            <AppIcon name="close" size={13} color="rgba(255,59,48,0.8)" />
            <Text style={styles.removePhotoBtnText}>{t.folder.removePhoto}</Text>
          </TouchableOpacity>
        )}

        {/* Name field */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.folder.nameLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.folder.enterFolderNamePh}
            placeholderTextColor={Palette.textFaint}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
        </View>

        {/* Description field */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.common.descriptionLabel} <Text style={styles.fieldOptional}>{t.common.optional}</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t.folder.addDescription}
            placeholderTextColor={Palette.textFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !name.trim() && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!name.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>{t.common.create}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 14,
  },
  coverSelector: {
    width: '100%',
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
    borderStyle: 'dashed',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  coverPlaceholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  coverPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.textDim,
  },
  coverPlaceholderSub: {
    fontSize: 11,
    color: Palette.textFaint,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    paddingVertical: 4,
    marginTop: -8,
  },
  removePhotoBtnText: {
    fontSize: 13,
    color: 'rgba(255,59,48,0.8)',
    fontWeight: '500',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textDim,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldOptional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    color: Palette.textFaint,
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Palette.text,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
  },
});
