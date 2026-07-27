import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

export default function CreateEvent() {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.createEvent.newEventTitle}</Text>
      
      <TextInput 
        style={styles.input}
        placeholder={t.common.nameLabel}
      />
      
      <TextInput
        style={styles.input}
        placeholder={t.common.descriptionLabel}
        multiline
      />
      
      <Button title={t.common.create} onPress={() => alert('Событие создано!')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, marginBottom: 15 },
  input: { 
    borderWidth: 1, 
    padding: 10, 
    marginBottom: 15,
    borderRadius: 5 
  }
});