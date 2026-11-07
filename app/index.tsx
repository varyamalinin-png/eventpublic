import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function EntryPoint() {
  const { initializing } = useAuth();
  
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#FF8D32" />
      </View>
    );
  }
  
  // Гость тоже попадает в ленту — Explore открыт без аккаунта
  // (параметры карточек заблюрены, остальные разделы ведут на регистрацию).
  return <Redirect href="/(tabs)/explore" />;
}