'use client';

import { useEffect, useState } from 'react';
import { APP_STORE_URL, isRussianUi } from '@/web/lib/publicPage';

// Что видит человек без входа, открыв ссылку на событие. Сам экран события
// тянет /events/:id/profile, а он требует авторизации и отвечает 401 — раньше
// из-за этого страница показывала пустое «No posts yet». Данные самого события
// (/events/:id) открытые, их и показываем.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru/api';

type PublicEvent = {
  title?: string;
  description?: string;
  mediaUrl?: string;
  startTime?: string;
  location?: string;
};

function formatWhen(startTime: string | undefined, ru: boolean): string {
  if (!startTime) return '';
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(ru ? 'ru-RU' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PublicEventPreview({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [failed, setFailed] = useState(false);
  const ru = isRussianUi();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/events/${eventId}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(data => {
        if (!cancelled) setEvent(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const t = ru
    ? {
        notFound: 'Событие не найдено или больше недоступно',
        open: 'Открыть в приложении',
        signIn: 'Войти',
        more: 'Фотографии, участники и чат события — в приложении.',
      }
    : {
        notFound: 'This event is not available any more',
        open: 'Open in the app',
        signIn: 'Sign in',
        more: 'Photos, participants and the event chat are in the app.',
      };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {event?.mediaUrl ? (
          // Обычный img: next/image на внешнем домене хранилища требует
          // отдельной настройки, а превью должно работать всегда.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.mediaUrl} alt="" style={styles.cover} />
        ) : (
          <div style={{ ...styles.cover, ...styles.coverEmpty }} />
        )}

        <div style={styles.body}>
          {failed && !event ? (
            <h1 style={styles.title}>{t.notFound}</h1>
          ) : (
            <>
              <h1 style={styles.title}>{event?.title || ' '}</h1>
              {formatWhen(event?.startTime, ru) && (
                <p style={styles.meta}>{formatWhen(event?.startTime, ru)}</p>
              )}
              {event?.location && <p style={styles.meta}>{event.location}</p>}
              {event?.description && <p style={styles.description}>{event.description}</p>}
            </>
          )}

          <p style={styles.hint}>{t.more}</p>

          <a href={APP_STORE_URL} style={styles.primaryButton}>
            {t.open}
          </a>
          <a href="/login" style={styles.secondaryButton}>
            {t.signIn}
          </a>
        </div>
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
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  cover: { width: '100%', height: 220, objectFit: 'cover', display: 'block' },
  coverEmpty: { background: 'linear-gradient(160deg, #22202a 0%, #0f0f13 100%)' },
  body: { padding: 20 },
  title: { color: '#F4F4F5', fontSize: 22, lineHeight: 1.25, margin: '0 0 10px' },
  meta: { color: 'rgba(244,244,245,0.66)', fontSize: 14, margin: '0 0 4px' },
  description: {
    color: 'rgba(244,244,245,0.8)',
    fontSize: 15,
    lineHeight: 1.45,
    margin: '12px 0 0',
    whiteSpace: 'pre-wrap',
  },
  hint: { color: 'rgba(244,244,245,0.45)', fontSize: 13, margin: '18px 0 14px' },
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
