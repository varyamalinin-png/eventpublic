import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/logger';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { PASSWORD_RULES, checkPassword } from '../../utils/passwordRules';
import { validateEmail, validateUsername, validatePhoneDigits, ValidationKey } from '../../utils/validation';
import { PhoneField } from '../../components/auth/PhoneField';
import { Country, DEFAULT_COUNTRY } from '../../constants/countries';

// Завершаем сессию OAuth для правильной работы на веб
WebBrowser.maybeCompleteAuthSession();

const logger = createLogger('Auth');

/** Вход и регистрация через Google и Apple временно скрыты.
 *  Вся логика (OAuth, loginWithGoogle, AppleAuthentication) сохранена —
 *  вернуть можно флагом, без переписывания экрана. */
const SHOW_GOOGLE_AUTH = false;
const SHOW_APPLE_AUTH = false;

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; addAccount?: string }>();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as Mode;
  const isAddingAccount = params.addAccount === 'true';
  
  const {
    login,
    register,
    loginWithGoogle,
    loading,
    isAuthenticated,
    user,
  } = useAuth();
  
  const { t } = useLanguage();

  // После успешной авторизации переходим в приложение или настройки
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      // Если это добавление аккаунта, возвращаемся на страницу настроек
      if (isAddingAccount) {
        router.replace('/settings');
      } else {
        router.replace('/(tabs)/explore');
      }
    } else if (isAuthenticated && user && !user.emailVerified) {
      // Email не подтвержден - переходим на подтверждение
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { 
          email: user.email,
          ...(isAddingAccount ? { addAccount: 'true' } : {}),
        },
      });
    }
  }, [isAuthenticated, user, router, isAddingAccount]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Поля для входа
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Поля для регистрации
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhoneDigits, setRegisterPhoneDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  // Подсвечиваем незаполненное только после первой попытки отправки —
  // краснеть при открытии формы неприятно
  const [registerAttempted, setRegisterAttempted] = useState(false);
  // ...или как только пользователь ушёл с конкретного поля — так ошибка
  // видна сразу, не дожидаясь клика по кнопке (как у большинства форм регистрации).
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouchedFields((prev) => ({ ...prev, [field]: true }));
  const shows = (field: string) => touchedFields[field] || registerAttempted;

  // На логине не ругаемся "обязательное поле", пока не начали печатать —
  // формат проверяем только когда есть что проверять.
  const loginEmailErrorKey = loginEmail.trim() ? validateEmail(loginEmail) : null;

  const passwordCheck = checkPassword(registerPassword);
  const emailErrorKey = validateEmail(registerEmail);
  const usernameErrorKey = validateUsername(registerUsername);
  const phoneErrorKey = validatePhoneDigits(registerPhoneDigits);
  const missing = {
    email: !!emailErrorKey,
    username: !!usernameErrorKey,
    phone: !!phoneErrorKey,
    password: !passwordCheck.isValid,
  };
  const fieldError = (key: ValidationKey | null) => (key ? t.validation[key] : null);

  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1095670285353-5u0ap40ms4ccqmc8hbfh32pmudi54f1v.apps.googleusercontent.com';
  const googleClientId = WEB_CLIENT_ID;

  // Для веба используем прямой подход через Google OAuth API
  // Для мобильных приложений используем expo-auth-session
  const mobileRedirectUri = AuthSession.makeRedirectUri({ scheme: 'iwent', path: 'auth', preferLocalhost: false });
  const webRedirectUri = Platform.OS === 'web' && typeof window !== 'undefined' && window.location ? `${window.location.origin}/auth` : 'https://iwent.ru/auth';

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: Platform.OS === 'web' ? webRedirectUri : mobileRedirectUri,
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  // Обработка ответа от Google OAuth (только для мобильных приложений)
  useEffect(() => {
    if (Platform.OS !== 'web' && response?.type === 'success' && response.params?.id_token) {
      handleGoogleSignIn(response.params.id_token);
    } else if (Platform.OS !== 'web' && response?.type === 'error') {
      logger.error('Google OAuth error:', response.error);
      setErrorMessage(t.auth.googleSignInFailed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Функция для прямого запуска Google OAuth на вебе
  const handleGoogleSignInWeb = () => {
    if (Platform.OS !== 'web' || !googleClientId) {
      setErrorMessage(t.auth.googleNotConfigured);
      return;
    }

    const redirectUri = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth`
      : 'https://iwent.ru/auth';
    
    // Генерируем state для защиты от CSRF
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('google_oauth_state', state);

    // Формируем URL для Google OAuth
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', Math.random().toString(36).substring(2, 15));

    // Перенаправляем на Google OAuth
    if (typeof window !== 'undefined') {
      window.location.href = authUrl.toString();
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    setErrorMessage(null);
    try {
      await loginWithGoogle(idToken);
      // После успешного логина useEffect выше обработает переход
    } catch (error: any) {
      logger.error('Google sign in failed', error);
      const errorMsg = error?.body?.message || error?.message || t.auth.googleSignInFailed;
      setErrorMessage(errorMsg);
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage(t.auth.enterEmailAndPassword);
      return;
    }

    try {
      await login(loginEmail.trim(), loginPassword);
      // После успешного логина useEffect выше обработает переход
    } catch (error: any) {
      logger.error('login failed', error);
      const errorMsg = error?.body?.message || error?.message || t.auth.signInFailed;
      
      // Если email не подтвержден, переходим на подтверждение
      if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes(t.auth.verified)) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { 
            email: loginEmail.trim(),
            ...(isAddingAccount ? { addAccount: 'true' } : {}),
          },
        });
      } else {
        setErrorMessage(errorMsg);
      }
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    // С этого момента незаполненные поля подсвечиваются
    setRegisterAttempted(true);

    if (missing.email || missing.username || missing.phone) {
      setErrorMessage(t.auth.fillRequiredFields);
      return;
    }

    // Те же правила, что проверит сервер, — см. utils/passwordRules.ts
    if (!passwordCheck.isValid) {
      setErrorMessage(t.messages.passwordTooShort);
      return;
    }

    try {
      await register({
        email: registerEmail.trim(),
        username: registerUsername.trim(),
        phone: `${phoneCountry.dial} ${registerPhoneDigits}`,
        password: registerPassword,
        name: registerName.trim() || undefined,
      });
      // После регистрации переходим на подтверждение email
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { 
          email: registerEmail.trim(),
          ...(isAddingAccount ? { addAccount: 'true' } : {}),
        },
      });
    } catch (error: any) {
      logger.error('register failed', error);
      setErrorMessage(error?.body?.message || error?.message || t.auth.signUpFailed);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.auth.welcome}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? t.auth.signInToAccount : t.auth.createNewAccount}
        </Text>

        {/* Переключатель режимов */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
            onPress={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            disabled={loading}
          >
            <Text style={[styles.tabButtonText, mode === 'login' && styles.tabButtonTextActive]}>
              {t.auth.signIn}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'register' && styles.tabButtonActive]}
            onPress={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            disabled={loading}
          >
            <Text style={[styles.tabButtonText, mode === 'register' && styles.tabButtonTextActive]}>
              {t.auth.signUp}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Сообщение об ошибке */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Форма входа */}
        {mode === 'login' && (
          <View style={styles.formBlock}>
            <View>
              <TextInput
                style={[styles.input, shows('loginEmail') && loginEmailErrorKey && styles.inputError]}
                placeholder="Email"
                placeholderTextColor="rgba(244,244,245,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={loginEmail}
                onChangeText={setLoginEmail}
                onBlur={() => touch('loginEmail')}
                editable={!loading}
              />
              {shows('loginEmail') && loginEmailErrorKey && (
                <Text style={styles.fieldErrorText}>{fieldError(loginEmailErrorKey)}</Text>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.auth.password}
              placeholderTextColor="rgba(244,244,245,0.35)"
              secureTextEntry
              value={loginPassword}
              onChangeText={setLoginPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.auth.signInButton}</Text>
              )}
            </TouchableOpacity>

            {(SHOW_GOOGLE_AUTH || (SHOW_APPLE_AUTH && Platform.OS === 'ios')) && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t.auth.or}</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {SHOW_GOOGLE_AUTH && (
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.disabledButton]}
                onPress={Platform.OS === 'web' ? handleGoogleSignInWeb : () => promptAsync()}
                disabled={loading || !googleClientId}
              >
                <Text style={styles.googleButtonText}>{t.auth.continueWithGoogle}</Text>
              </TouchableOpacity>
            )}

            {SHOW_APPLE_AUTH && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: '#000', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    const credential = await AppleAuthentication.signInAsync({
                      requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                      ],
                    });
                    if (credential.identityToken) {
                      await loginWithGoogle(credential.identityToken);
                    }
                  } catch (e: any) {
                    if (e.code !== 'ERR_REQUEST_CANCELED') {
                      setErrorMessage(t.auth.appleSignInFailed);
                    }
                  }
                }}
              >
                <Text style={[styles.googleButtonText, { color: '#fff' }]}> {t.auth.continueWithApple}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Форма регистрации */}
        {mode === 'register' && (
          <View style={styles.formBlock}>
            <View>
              <TextInput
                style={[styles.input, shows('email') && missing.email && styles.inputError]}
                placeholder="Email"
                placeholderTextColor="rgba(244,244,245,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={registerEmail}
                onChangeText={setRegisterEmail}
                onBlur={() => touch('email')}
                editable={!loading}
              />
              {shows('email') && emailErrorKey && (
                <Text style={styles.fieldErrorText}>{fieldError(emailErrorKey)}</Text>
              )}
            </View>
            <View>
              <TextInput
                style={[styles.input, shows('username') && missing.username && styles.inputError]}
                placeholder={t.auth.username}
                placeholderTextColor="rgba(244,244,245,0.35)"
                autoCapitalize="none"
                value={registerUsername}
                onChangeText={setRegisterUsername}
                onBlur={() => touch('username')}
                editable={!loading}
              />
              {shows('username') && usernameErrorKey && (
                <Text style={styles.fieldErrorText}>{fieldError(usernameErrorKey)}</Text>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.auth.nameOptional}
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={registerName}
              onChangeText={setRegisterName}
              editable={!loading}
            />
            <View>
              <PhoneField
                country={phoneCountry}
                onChangeCountry={setPhoneCountry}
                nationalNumber={registerPhoneDigits}
                onChangeNationalNumber={setRegisterPhoneDigits}
                onBlur={() => touch('phone')}
                hasError={shows('phone') && missing.phone}
                disabled={loading}
              />
              {shows('phone') && phoneErrorKey && (
                <Text style={styles.fieldErrorText}>{fieldError(phoneErrorKey)}</Text>
              )}
            </View>
            <TextInput
              style={[styles.input, shows('password') && missing.password && styles.inputError]}
              placeholder={t.auth.password}
              placeholderTextColor="rgba(244,244,245,0.35)"
              secureTextEntry
              value={registerPassword}
              onChangeText={setRegisterPassword}
              onBlur={() => touch('password')}
              editable={!loading}
            />
            {registerPassword.length > 0 && (
              <View style={styles.pwRules}>
                {PASSWORD_RULES.map((rule) => {
                  const ok = passwordCheck.passed.includes(rule.id);
                  const label = {
                    length: t.auth.pwLength,
                    lower: t.auth.pwLower,
                    upper: t.auth.pwUpper,
                    digit: t.auth.pwDigit,
                  }[rule.id];
                  return (
                    <Text key={rule.id} style={[styles.pwRule, ok && styles.pwRuleOk]}>
                      {ok ? '✓' : '•'} {label}
                    </Text>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.auth.signUpAction}</Text>
              )}
            </TouchableOpacity>

            {(SHOW_GOOGLE_AUTH || (SHOW_APPLE_AUTH && Platform.OS === 'ios')) && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t.auth.or}</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {SHOW_GOOGLE_AUTH && (
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.disabledButton]}
                onPress={Platform.OS === 'web' ? handleGoogleSignInWeb : () => promptAsync()}
                disabled={loading || !googleClientId}
              >
                <Text style={styles.googleButtonText}>{t.auth.signUpWithGoogle}</Text>
              </TouchableOpacity>
            )}

            {SHOW_APPLE_AUTH && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: '#000', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    const credential = await AppleAuthentication.signInAsync({
                      requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                      ],
                    });
                    if (credential.identityToken) {
                      await loginWithGoogle(credential.identityToken);
                    }
                  } catch (e: any) {
                    if (e.code !== 'ERR_REQUEST_CANCELED') {
                      setErrorMessage(t.auth.appleSignInFailed);
                    }
                  }
                }}
              >
                <Text style={[styles.googleButtonText, { color: '#fff' }]}> {t.auth.signUpWithApple}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inputError: { borderColor: '#FF3B30' },
  fieldErrorText: {
    color: '#FF6B6B',
    fontSize: 12.5,
    marginTop: 6,
    marginLeft: 4,
  },
  pwRules: { gap: 4, marginTop: -4, marginBottom: 4, paddingHorizontal: 4 },
  pwRule: { color: 'rgba(244,244,245,0.45)', fontSize: 12.5 },
  pwRuleOk: { color: '#4ADE80' },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#0a0a0c',
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
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: '#141417',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FF8D32',
  },
  tabButtonText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  formBlock: {
    gap: 12,
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
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1c1c20',
  },
  dividerText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginHorizontal: 12,
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  googleButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
});
