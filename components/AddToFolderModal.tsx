import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useEvents } from '../context/EventsContext';

interface AddToFolderModalProps {
  eventIds: string[];
  onClose: () => void;
  onSubmit: (folderIds: string[]) => void;
  onCreateNewFolder?: () => void;
}

export default function AddToFolderModal({ eventIds, onClose, onSubmit, onCreateNewFolder }: AddToFolderModalProps) {
  const { eventFolders } = useEvents();
  const [selectedFolderIdsLocal, setSelectedFolderIdsLocal] = useState<Set<string>>(new Set());

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>Выберите папку</Text>
        <ScrollView style={styles.scrollView}>
          {eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0 ? (
            eventFolders.map((folder: any) => {
              const isSelected = selectedFolderIdsLocal.has(folder.id);
              
              return (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.item}
                  onPress={() => {
                    const newSelected = new Set(selectedFolderIdsLocal);
                    if (newSelected.has(folder.id)) {
                      newSelected.delete(folder.id);
                    } else {
                      newSelected.add(folder.id);
                    }
                    setSelectedFolderIdsLocal(newSelected);
                  }}
                >
                  <Image
                    source={{ 
                      uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/40'
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{folder.name}</Text>
                    <Text style={styles.itemSubtext}>
                      {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'событие' : 'событий'}
                    </Text>
                  </View>
                  <Text style={styles.checkbox}>
                    {isSelected ? '☑' : '☐'}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>У вас пока нет папок</Text>
          )}
        </ScrollView>
        
        {/* Кнопка создания новой папки */}
        {onCreateNewFolder && (
          <TouchableOpacity 
            style={styles.createNewButton}
            onPress={onCreateNewFolder}
          >
            <Text style={styles.createNewButtonText}>+ Создать новую папку</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, selectedFolderIdsLocal.size === 0 && styles.buttonDisabled]}
            onPress={() => onSubmit(Array.from(selectedFolderIdsLocal))}
            disabled={selectedFolderIdsLocal.size === 0}
          >
            <Text style={styles.submitButtonText}>
              Добавить ({selectedFolderIdsLocal.size})
            </Text>
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
  scrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  createNewButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#4A4A4A',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
  },
  createNewButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemSubtext: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  checkbox: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
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
