import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function EntryPoint() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? '/(tabs)/explore' : '/(auth)/login'} />;
}