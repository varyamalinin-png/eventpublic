import { useCallback, useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import {
  AdaptivityProvider,
  AppRoot,
  ConfigProvider,
  Placeholder,
} from '@vkontakte/vkui';
import { API_BASE_URL, MAIN_WEB_URL, VK_GROUP_ID } from './env';
import { LandingView } from './LandingView';

type LaunchParams = Record<string, unknown>;

function toStringRecord(lp: LaunchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(lp)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string>('');
  const [allowStatus, setAllowStatus] = useState<string>('');
  const [siteHint, setSiteHint] = useState<string>('');

  const openUrl = useCallback(async (url: string) => {
    setSiteHint('');
    try {
      const win = window.open(url, '_blank', 'noreferrer');
      if (win != null) {
        try {
          win.opener = null;
        } catch {
          /* ignore */
        }
        return;
      }
    } catch {
      /* ignore */
    }
    try {
      await bridge.send('VKWebAppOpenLink', { url });
      return;
    } catch {
      /* ignore */
    }
    try {
      await bridge.send('VKWebAppCopyText', { text: url });
      setSiteHint('Ссылка скопирована — вставьте её в адресную строку браузера.');
    } catch (e) {
      setSiteHint(
        e instanceof Error ? e.message : 'Не удалось открыть ссылку или скопировать её',
      );
    }
  }, []);

  const openMainSite = useCallback(() => openUrl(MAIN_WEB_URL), [openUrl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await bridge.send('VKWebAppInit');

        // Десктоп vk.com: расширить окно мини-приложения (иначе узкий iframe + поля по бокам).
        // См. https://dev.vk.ru/bridge/VKWebAppResizeWindow — на mvk/мобильных вызов может отклониться.
        try {
          const sw = window.screen?.availWidth ?? 1280;
          const sh = window.screen?.availHeight ?? 900;
          const width = Math.min(Math.max(800, sw - 120), 1600);
          const height = Math.min(Math.max(600, sh - 160), 1200);
          await bridge.send('VKWebAppResizeWindow', { width, height });
        } catch {
          /* не desktop VK или версия клиента без поддержки */
        }

        const lp = (await bridge.send('VKWebAppGetLaunchParams')) as LaunchParams;
        if (cancelled) return;

        const user = await bridge.send('VKWebAppGetUserInfo', {});
        if (!cancelled) {
          setUserLabel(
            [user.first_name, user.last_name].filter(Boolean).join(' ') ||
              `id ${user.id}`,
          );
        }

        if (API_BASE_URL) {
          void fetch(`${API_BASE_URL}/vk/mini-app/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ launchParams: toStringRecord(lp) }),
          }).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allowMessages = async () => {
    if (!VK_GROUP_ID) {
      setAllowStatus('Задайте VITE_VK_GROUP_ID (ID сообщества ВК)');
      return;
    }
    try {
      await bridge.send('VKWebAppAllowMessagesFromGroup', {
        group_id: VK_GROUP_ID,
      });
      setAllowStatus('Разрешение на сообщения от сообщества запрошено');
    } catch (e) {
      setAllowStatus(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ConfigProvider appearance="light">
      <AdaptivityProvider>
        <AppRoot
          style={{
            minHeight: '100vh',
            width: '100%',
            maxWidth: '100%',
            background: '#F0EDEA',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                padding: 48,
                minHeight: '40vh',
              }}
            >
              <span className="vk-app-loading-dot" aria-hidden />
              <span className="vk-app-loading-label vk-app-loading-label--light">
                Загрузка…
              </span>
            </div>
          ) : error ? (
            <Placeholder header="Ошибка">{error}</Placeholder>
          ) : (
            <LandingView
              userLabel={userLabel}
              onOpenSite={openMainSite}
              onOpenUrl={openUrl}
              onAllowMessages={allowMessages}
              allowStatus={allowStatus}
              siteHint={siteHint}
            />
          )}
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
