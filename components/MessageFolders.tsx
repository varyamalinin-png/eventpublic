import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

interface MessageFolder {
  id: string;
  name: string;
  messageCount?: number;
}

interface MessageFoldersProps {
  folders: MessageFolder[];
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
}

export default function MessageFolders({ 
  folders, 
  selectedFolder, 
  onFolderSelect, 
  onCreateFolder 
}: MessageFoldersProps) {
  return (
    <View style={styles.foldersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foldersScroll}>
        <TouchableOpacity 
          style={[styles.folderItem, selectedFolder === null && styles.selectedFolder]}
          onPress={() => onFolderSelect(null)}
        >
          <Text style={[styles.folderText, selectedFolder === null && styles.selectedFolderText]}>
            Все
          </Text>
        </TouchableOpacity>
        
        {folders.map((folder) => (
          <TouchableOpacity
            key={folder.id}
            style={[
              styles.folderItem, 
              selectedFolder === folder.id && styles.selectedFolder
            ]}
            onPress={() => onFolderSelect(folder.id)}
          >
            <Text style={[styles.folderText, selectedFolder === folder.id && styles.selectedFolderText]}>
              {folder.name}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Кнопка добавления папки */}
        <TouchableOpacity 
          style={styles.addFolderButton}
          onPress={onCreateFolder}
        >
          <Text style={styles.addFolderIcon}>+</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  foldersContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  foldersScroll: {
    flexDirection: 'row',
  },
  folderItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedFolder: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  folderText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedFolderText: {
    color: '#FFF',
    fontWeight: '600',
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
    color: '#999',
    fontSize: 16,
    fontWeight: 'normal',
  },
});
