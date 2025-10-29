import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function CreateEvent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Новое событие</Text>
      
      <TextInput 
        style={styles.input}
        placeholder="Название"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Описание"
        multiline
      />
      
      <Button title="Создать" onPress={() => alert('Событие создано!')} />
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