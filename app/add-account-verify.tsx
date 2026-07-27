import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createLogger } from '../utils/logger';
import { Ionicons } from '@expo/vector-icons';

const logger = createLogger('AddAccountVerify');

export default function AddAccountVerifyScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ email?: string }>();
  const { resendVerificationEmail, verifyEmail, user, isAuthenticated } = useAuth();
  
  const [email, setEmail] = useState(params.email || user?.email || '');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Отслеживаем, был ли выполнен успешный verify на этой странице
  const hasVerifiedOnThisPage = useRef(false);
  const initialUserId = useRef<string | null>(user?.id || null);

  // После успешного подтверждения и авторизации переходим в настройки
  // НО только если:
  // 1. Это был успешный verify на этой странице (hasVerifiedOnThisPage.current === true)
  // 2. ИЛИ userId изменился (переключились на новый аккаунт)
  useEffect(() => {
    const currentUserId = user?.id || null;
    const userIdChanged = initialUserId.current !== null && currentUserId !== null && initialUserId.current !== currentUserId;
    const targetEmail = params.email || email;
    const isDifferentEmail = targetEmail && user?.email && targetEmail.toLowerCase() !== user.email.toLowerCase();
    
    // Перенаправляем ТОЛЬКО если:
    // 1. Пользователь авторизован И
    // 2. Email подтвержден И
    // 3. Был успешный verify на этой странице (hasVerifiedOnThisPage.current === true)
    // НЕ перенаправляем, если это просто старый аккаунт с подтвержденным email
    if (isAuthenticated && user?.emailVerified && hasVerifiedOnThisPage.current) {
      // После подтверждения второго аккаунта возвращаемся в настройки
      // Небольшая задержка, чтобы убедиться, что состояние обновилось
      setTimeout(() => {
        router.replace('/settings');
      }, 100);
    }
  }, [isAuthenticated, user, router, params.email, email]);

  const handleResendEmail = useCallback(async () => {
    if (!email.trim()) {
      setErrorMessage(t.auth.enterEmailAddress);
      return;
    }

    setResending(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await resendVerificationEmail(email.trim());
      setStatusMessage(t.auth.verificationSent);
      Alert.alert(
        t.auth.emailSent,
        'Проверьте вашу почту (включая папку "Спам") и следуйте инструкциям в письме для подтверждения email.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      logger.error('Failed to resend verification email', error);
      const message = error?.body?.message || error?.message || t.auth.sendFailed;
      setErrorMessage(message);
      Alert.alert(t.common.error, message);
    } finally {
      setResending(false);
    }
  }, [email, resendVerificationEmail]);

  const handleVerifyToken = useCallback(async () => {
    if (!token.trim()) {
      setErrorMessage(t.auth.enterToken);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await verifyEmail(token.trim());
      
      // Если сервер вернул токены, пользователь автоматически залогинен
      if (result && result.accessToken && result.user) {
        hasVerifiedOnThisPage.current = true; // Отмечаем, что verify был успешным на этой странице
        setStatusMessage(t.auth.verifiedAndSignedIn);
        // useEffect выше обработает переход в настройки
      } else {
        // Если токены не вернулись, перенаправляем на логин
        setStatusMessage(t.auth.verifiedCanSignIn);
        Alert.alert(
          t.auth.emailVerified,
          t.auth.verifiedBody,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/add-account'),
            },
          ]
        );
      }
    } catch (error: any) {
      logger.error('Failed to verify email', error);
      const message = error?.body?.message || error?.message || t.auth.tokenInvalid;
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [token, verifyEmail, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Кнопка "Назад" */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#f4f4f5" />
            <Text style={styles.backButtonText}>Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Подтверждение Email</Text>
          <Text style={styles.subtitle}>
            Для завершения регистрации необходимо подтвердить ваш email адрес
          </Text>

              {/* Инструкция */}
              <View style={styles.instructionBox}>
                <Text style={styles.instructionTitle}>Как подтвердить email:</Text>
                <View style={styles.instructionList}>
                  <Text style={styles.instructionItem}>
                    1. Проверьте вашу почту ({email || t.auth.usedAtSignUp})
                  </Text>
                  <Text style={styles.instructionItem}>
                    2. ⚠️ Обязательно проверьте папку "Спам" - письмо может попасть туда
                  </Text>
                  <Text style={styles.instructionItem}>
                    3. Найдите письмо от нашего сервиса
                  </Text>
                  <Text style={styles.instructionItem}>
                    4. Скопируйте токен из письма и вставьте его ниже
                  </Text>
                </View>
              </View>

          {/* Статус сообщение */}
          {statusMessage && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}

          {/* Ошибка */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Повторная отправка письма */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Не получили письмо?</Text>
            <Text style={styles.sectionDescription}>
              Введите ваш email и мы отправим письмо с подтверждением повторно
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.enterEmail}
                placeholderTextColor="rgba(244,244,245,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                editable={!resending}
              />
            </View>
            <TouchableOpacity
              style={[styles.secondaryButton, resending && styles.disabledButton]}
              onPress={handleResendEmail}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.secondaryButtonText}>Отправить письмо повторно</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Ввод токена */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Введите токен подтверждения</Text>
            <Text style={styles.sectionDescription}>
              Скопируйте токен из письма и вставьте его здесь
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Токен подтверждения</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.pasteToken}
                placeholderTextColor="rgba(244,244,245,0.35)"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                textContentType="none"
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleVerifyToken}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.primaryButtonText}>Подтвердить</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 24,
    textAlign: 'center',
  },
  instructionBox: {
    backgroundColor: '#141417',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  instructionTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionList: {
    gap: 8,
  },
  instructionItem: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    lineHeight: 20,
  },
  statusBox: {
    backgroundColor: '#1a3a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#3a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#141417',
    color: '#f4f4f5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  primaryButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#141417',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF8D32',
  },
  secondaryButtonText: {
    color: '#FF8D32',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

