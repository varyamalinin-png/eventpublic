import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
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
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('VerifyEmail');

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ email?: string; addAccount?: string; token?: string }>();
  const isAddingAccount = params.addAccount === 'true';
  const { resendVerificationEmail, verifyEmail, user, isAuthenticated } = useAuth();
  
  // Извлекаем токен из URL параметров
  // Expo Router автоматически декодирует URL параметры, но на всякий случай проверяем
  const tokenFromUrl = params.token || '';
  
  const [email, setEmail] = useState(params.email || user?.email || '');
  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAutoVerified, setHasAutoVerified] = useState(false);

  // После успешного подтверждения и авторизации переходим в приложение или настройки
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      // Если это добавление аккаунта, возвращаемся на страницу настроек
      if (isAddingAccount) {
        router.replace('/settings');
      } else {
        router.replace('/(tabs)/explore');
      }
    }
  }, [isAuthenticated, user, router, isAddingAccount]);

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
      // Токен должен быть уже декодирован expo-router, но на всякий случай пробуем декодировать
      // Если декодирование не нужно, оно не сломает токен (токены hex не содержат %)
      let processedToken = token.trim();
      try {
        // Пробуем декодировать только если токен содержит % (признак URL encoding)
        if (processedToken.includes('%')) {
          processedToken = decodeURIComponent(processedToken);
        }
      } catch (e) {
        // Если декодирование не удалось, используем оригинальный токен
        logger.warn('Failed to decode token, using original', e);
      }
      
      logger.debug('Verifying token', { 
        originalLength: token.trim().length, 
        processedLength: processedToken.length,
        tokenPreview: processedToken.substring(0, 20) + '...',
        containsPercent: token.trim().includes('%')
      });
      const result = await verifyEmail(processedToken);
      
      // Если сервер вернул токены, пользователь автоматически залогинен
      if (result && result.accessToken && result.user) {
        setStatusMessage(t.auth.verifiedAndSignedIn);
        // useEffect выше обработает переход в приложение
      } else {
        // Если токены не вернулись, перенаправляем на логин
        setStatusMessage(t.auth.verifiedCanSignIn);
        Alert.alert(
          t.auth.emailVerified,
          t.auth.verifiedBody,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/login'),
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

  // Если токен пришел из URL, автоматически пытаемся верифицировать (только один раз)
  useEffect(() => {
    if (tokenFromUrl && !loading && !isAuthenticated && !hasAutoVerified && tokenFromUrl === token) {
      logger.debug('Token found in URL, attempting automatic verification', { tokenLength: tokenFromUrl.length });
      setHasAutoVerified(true);
      // Небольшая задержка чтобы убедиться что компонент полностью смонтирован
      setTimeout(() => {
        handleVerifyToken();
      }, 500);
    }
  }, [tokenFromUrl, token, loading, isAuthenticated, hasAutoVerified, handleVerifyToken]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>{t.auth.verifyEmailTitle}</Text>
          <Text style={styles.subtitle}>
            Для завершения регистрации необходимо подтвердить ваш email адрес
          </Text>

              {/* Инструкция */}
              <View style={styles.instructionBox}>
                <Text style={styles.instructionTitle}>{t.auth.howToVerify}</Text>
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
            <Text style={styles.sectionTitle}>{t.auth.notReceived}</Text>
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
                <Text style={styles.secondaryButtonText}>{t.auth.resendEmail}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Ввод токена */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.auth.enterToken}</Text>
            <Text style={styles.sectionDescription}>
              Скопируйте токен из письма и вставьте его здесь
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t.auth.tokenLabel}</Text>
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
                <Text style={styles.primaryButtonText}>{t.auth.verifyAction}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Кнопка возврата к логину */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.linkText}>{t.auth.backToLogin}</Text>
          </TouchableOpacity>
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
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#FF8D32',
    fontSize: 14,
  },
});
