import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface CreateFolderModalProps {
  onClose: () => void;
  onSubmit: (name: string, description?: string, coverPhoto?: { uri: string; type: string; name: string }) => void;
}

export default function CreateFolderModal({ onClose, onSubmit }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<{ uri: string; type: string; name: string } | null>(null);

  const handlePickImage = async () => {
    try {
      const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (hasPermission.status !== 'granted') {
        Alert.alert('Ошибка', 'Нет доступа к галерее');
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
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>Создать папку</Text>
        
        {/* Выбор фото */}
        <TouchableOpacity style={styles.coverPhotoSelector} onPress={handlePickImage}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto.uri }} style={styles.coverPhotoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.coverPhotoPlaceholder}>
              <Text style={styles.coverPhotoPlaceholderText}>+ Добавить фото</Text>
            </View>
          )}
        </TouchableOpacity>
        {coverPhoto && (
          <TouchableOpacity style={styles.removePhotoButton} onPress={() => setCoverPhoto(null)}>
            <Text style={styles.removePhotoButtonText}>Удалить фото</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          placeholder="Название папки"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <TextInput
          style={styles.textArea}
          placeholder="Описание (необязательно)"
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, !name.trim() && styles.buttonDisabled]}
            onPress={() => onSubmit(name, description, coverPhoto || undefined)}
            disabled={!name.trim()}
          >
            <Text style={styles.submitButtonText}>Создать</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  coverPhotoSelector: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  coverPhotoPreview: {
    width: '100%',
    height: '100%',
  },
  coverPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A4A4A',
    borderStyle: 'dashed',
  },
  coverPhotoPlaceholderText: {
    fontSize: 16,
    color: '#AAAAAA',
  },
  removePhotoButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 12,
  },
  removePhotoButtonText: {
    color: '#FF4444',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
