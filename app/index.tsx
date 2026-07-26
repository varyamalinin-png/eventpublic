import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function EntryPoint() {
  const { isAuthenticated, initializing } = useAuth();
  
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#FF8D32" />
      </View>
    );
  }
  
  return <Redirect href={isAuthenticated ? '/(tabs)/explore' : '/(auth)/login'} />;
}