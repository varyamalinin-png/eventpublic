'use client';

import { APP_STORE_URL, isRussianUi } from '@/web/lib/publicPage';

// Ссылку на профиль тоже присылают в мессенджере, а /users/:id без входа
// отвечает 401 — раньше страница рисовала пустой каркас с именем «user» и
// нулями. Показываем честную заглушку вместо него.

export function PublicSignInPrompt() {
  const ru = isRussianUi();
  const t = ru
    ? {
        title: 'Профиль виден после входа',
        body: 'Войдите в iwent, чтобы посмотреть профиль, события и воспоминания этого человека.',
        open: 'Открыть в приложении',
        signIn: 'Войти',
      }
    : {
        title: 'Sign in to view this profile',
        body: 'Sign in to iwent to see this person’s profile, events and memories.',
        open: 'Open in the app',
        signIn: 'Sign in',
      };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.body}>{t.body}</p>
        <a href="/login" style={styles.primaryButton}>
          {t.signIn}
        </a>
        <a href={APP_STORE_URL} style={styles.secondaryButton}>
          {t.open}
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0A0A0C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#141418',
    borderRadius: 20,
    padding: 24,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  title: { color: '#F4F4F5', fontSize: 20, margin: '0 0 10px' },
  body: { color: 'rgba(244,244,245,0.7)', fontSize: 15, lineHeight: 1.45, margin: '0 0 20px' },
  primaryButton: {
    display: 'block',
    textAlign: 'center',
    background: '#FF8D32',
    color: '#141418',
    fontWeight: 600,
    fontSize: 15,
    padding: '13px 16px',
    borderRadius: 12,
    textDecoration: 'none',
  },
  secondaryButton: {
    display: 'block',
    textAlign: 'center',
    color: 'rgba(244,244,245,0.75)',
    fontSize: 15,
    padding: '12px 16px',
    marginTop: 8,
    textDecoration: 'none',
  },
};
