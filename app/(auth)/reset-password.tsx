import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { OtpInput } from '../../components/auth/OtpInput';
import { useResendCooldown } from '../../hooks/useResendCooldown';
import { checkPassword, PASSWORD_RULES } from '../../utils/passwordRules';
import { validateEmail } from '../../utils/validation';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ResetPassword');

type Step = 'email' | 'code' | 'password';

/**
 * Восстановление пароля.
 *
 * Три шага в одном экране: почта → код из письма → новый пароль. Код тот же
 * шестизначный, что и при подтверждении адреса, и живёт он 15 минут; ссылок в
 * письмах нет вовсе, поэтому и здесь всё вводится руками.
 *
 * Сам код сервер не проверяет отдельным запросом — проверка происходит вместе
 * со сменой пароля. Поэтому шаг «код» просто запоминает введённое, а ошибка
 * «код неверный» может прийти уже на третьем шаге; в этом случае возвращаем
 * человека на шаг с кодом, чтобы не пришлось начинать сначала.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { requestPasswordReset, resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cooldown = useResendCooldown();

  const passwordCheck = useMemo(() => checkPassword(password), [password]);
  const ruleLabels: Record<string, string> = {
    length: t.auth.pwLength,
    lower: t.auth.pwLower,
    upper: t.auth.pwUpper,
    digit: t.auth.pwDigit,
  };

  const readServerMessage = (error: any): string | undefined => {
    const raw = error?.body?.message;
    return typeof raw === 'string' ? raw : raw?.message;
  };

  const sendCode = useCallback(async () => {
    const address = email.trim();
    if (validateEmail(address)) {
      setErrorMessage(t.auth.enterEmailAddress);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await requestPasswordReset(address);
      cooldown.start();
      setStatusMessage(t.auth.resetCodeSent);
      setStep('code');
    } catch (error: any) {
      logger.error('Не удалось отправить код для сброса пароля', error);
      // Сервер разрешает одно письмо в две минуты и присылает остаток секунд.
      if (error?.body?.retryAfterSeconds) cooldown.startFromError(error);
      setErrorMessage(readServerMessage(error) || error?.message || t.auth.sendFailed);
    } finally {
      setLoading(false);
    }
  }, [email, requestPasswordReset, cooldown, t]);

  const submitNewPassword = useCallback(async () => {
    if (!passwordCheck.isValid) return;
    if (password !== repeat) {
      setErrorMessage(t.auth.resetPasswordsDontMatch);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await resetPassword(email.trim(), code, password);
      Alert.alert(t.auth.resetDoneTitle, t.auth.resetDoneBody, [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      logger.error('Не удалось сменить пароль', error);
      const message = readServerMessage(error) || error?.message || t.auth.tokenInvalid;
      setErrorMessage(message);
      // Неверный или просроченный код — возвращаем на его ввод, пароль остаётся
      // набранным, чтобы не набирать заново.
      if (/code/i.test(message)) {
        setCode('');
        setStep('code');
      }
    } finally {
      setLoading(false);
    }
  }, [passwordCheck.isValid, password, repeat, resetPassword, email, code, router, t]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>{t.auth.resetTitle}</Text>

          {step === 'email' && <Text style={styles.subtitle}>{t.auth.resetSubtitleEmail}</Text>}
          {step === 'code' && (
            <Text style={styles.subtitle}>
              {t.auth.resetSubtitleCode} {email.trim()}
            </Text>
          )}
          {step === 'password' && <Text style={styles.subtitle}>{t.auth.resetSubtitlePassword}</Text>}

          {statusMessage && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {step === 'email' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.auth.enterEmail}
                  placeholderTextColor="rgba(244,244,245,0.35)"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  editable={!loading}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={sendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#f4f4f5" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.auth.resetSendCode}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 'code' && (
            <>
              <View style={styles.inputContainer}>
                <OtpInput
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onComplete={() => setStep('password')}
                  disabled={loading}
                  hasError={!!errorMessage}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, code.length < 6 && styles.disabledButton]}
                onPress={() => setStep('password')}
                disabled={code.length < 6}
              >
                <Text style={styles.primaryButtonText}>{t.auth.resetContinue}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, (loading || cooldown.isCoolingDown) && styles.disabledButton]}
                onPress={sendCode}
                disabled={loading || cooldown.isCoolingDown}
              >
                <Text style={styles.secondaryButtonText}>
                  {cooldown.isCoolingDown ? `${t.auth.resendEmail} (${cooldown.label})` : t.auth.resendEmail}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setStatusMessage(null);
                  setErrorMessage(null);
                }}
              >
                <Text style={styles.linkText}>{t.auth.resetChangeEmail}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'password' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.auth.resetNewPassword}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.auth.resetNewPassword}
                  placeholderTextColor="rgba(244,244,245,0.35)"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                  editable={!loading}
                />
              </View>

              <View style={styles.rules}>
                {PASSWORD_RULES.map((rule) => {
                  const passed = passwordCheck.passed.includes(rule.id);
                  return (
                    <Text key={rule.id} style={[styles.ruleItem, passed && styles.ruleItemPassed]}>
                      {passed ? '✓' : '•'} {ruleLabels[rule.id]}
                    </Text>
                  );
                })}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.auth.resetRepeatPassword}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.auth.resetRepeatPassword}
                  placeholderTextColor="rgba(244,244,245,0.35)"
                  value={repeat}
                  onChangeText={(value) => {
                    setRepeat(value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (loading || !passwordCheck.isValid || !repeat) && styles.disabledButton,
                ]}
                onPress={submitNewPassword}
                disabled={loading || !passwordCheck.isValid || !repeat}
              >
                {loading ? (
                  <ActivityIndicator color="#f4f4f5" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.auth.resetAction}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/(auth)/login')}>
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
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(244,244,245,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f4f4f5',
  },
  rules: {
    marginBottom: 20,
    gap: 4,
  },
  ruleItem: {
    fontSize: 13,
    color: 'rgba(244,244,245,0.45)',
  },
  ruleItemPassed: {
    color: '#4ade80',
  },
  primaryButton: {
    backgroundColor: '#FF8D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#0a0a0c',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(244,244,245,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#f4f4f5',
    fontSize: 15,
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
    color: 'rgba(244,244,245,0.6)',
    fontSize: 14,
  },
  statusBox: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusText: {
    color: '#4ade80',
    fontSize: 14,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
});
