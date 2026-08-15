import { useCallback, useEffect, useState } from 'react';
import { MAIN_WEB_URL, TELEGRAM_BOT_CHAT_URL } from './env';
import { LandingView } from './LandingView';
import { openExternalUrl } from './openExternal';

export function App() {
  const [ready, setReady] = useState(false);
  const [userLabel, setUserLabel] = useState('');
  const openUrl = useCallback((url: string) => {
    openExternalUrl(url);
  }, []);

  const openMainSite = useCallback(() => openUrl(MAIN_WEB_URL), [openUrl]);

  const writeBot = useCallback(() => {
    openExternalUrl(TELEGRAM_BOT_CHAT_URL);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor?.('#0a0a0a');
        tg.setBackgroundColor?.('#f0edea');
      } catch {
        /* старые клиенты */
      }
      const u = tg.initDataUnsafe?.user;
      if (u) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        setUserLabel(name || (u.username ? `@${u.username}` : u.id != null ? `id ${u.id}` : ''));
      }
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          padding: 48,
          minHeight: '40vh',
          background: '#f0edea',
        }}
      >
        <span className="vk-app-loading-dot" aria-hidden />
        <span className="vk-app-loading-label vk-app-loading-label--light">Загрузка…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100%',
        background: '#F0EDEA',
      }}
    >
      <LandingView
        userLabel={userLabel}
        onOpenSite={openMainSite}
        onOpenUrl={openUrl}
        onWriteBot={writeBot}
      />
    </div>
  );
}
