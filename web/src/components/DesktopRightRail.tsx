'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEvents } from '@/client/context/EventsContext';
import { useAuth } from '@/client/context/AuthContext';
import { useLanguage } from '@/client/context/LanguageContext';

const ACCENT = '#FF8D32';
const SURFACE = '#141417';
const SURFACE_2 = '#1c1c20';
const LINE = 'rgba(255,255,255,0.07)';
const TEXT = '#f4f4f5';
const TEXT_DIM = 'rgba(244,244,245,0.55)';
const TEXT_FAINT = 'rgba(244,244,245,0.32)';

export const RIGHT_RAIL_WIDTH = 300;
export const RIGHT_RAIL_BREAKPOINT = 1320;

const cardStyle: React.CSSProperties = {
  backgroundColor: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 20,
  padding: '20px',
};

const linkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderRadius: 12,
  color: TEXT_DIM,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  backgroundColor: SURFACE_2,
  border: `1px solid ${LINE}`,
  marginTop: 8,
  transition: 'border-color .15s ease, color .15s ease',
};

// t и locale приходят из компонента: функция вне провайдера, своего useLanguage у неё быть не может
function timeAgo(date: Date | string | undefined, t: any, locale: string) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t.desktop.justNow;
  if (min < 60) return `${min} ${t.desktop.minShort}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ${t.desktop.hourShort}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${t.desktop.dayShort}`;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function initialsOf(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

/**
 * Виджет последних сообщений — превью чатов прямо во второй колонке десктопа,
 * по аналогии с панелью "Messages" в X/LinkedIn. Кликабельные строки ведут
 * в соответствующий чат (/inbox/[chatId]).
 */
function MessagesWidget() {
  const { t, language } = useLanguage();
  const { chats } = useEvents();
  const { user } = useAuth();

  const recentChats = useMemo(() => {
    return [...(chats ?? [])]
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, 5);
  }, [chats]);

  if (!user) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: TEXT_FAINT, fontWeight: 600 }}>
          {t.desktop.messages}
        </span>
        <Link href="/inbox" style={{ fontSize: 12.5, color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>
          {t.desktop.all} →
        </Link>
      </div>

      {recentChats.length === 0 ? (
        <p style={{ fontSize: 13.5, color: TEXT_DIM, margin: '6px 0 2px' }}>
          {t.desktop.noChats}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recentChats.map((chat) => {
            const preview = chat.lastMessage?.text
              ? chat.lastMessage.text
              : chat.lastMessage?.eventId
                ? `📅 ${t.desktop.eventPreview}`
                : chat.lastMessage?.postId
                  ? `🖼 ${t.desktop.memoryPreview}`
                  : t.desktop.noMessages;
            return (
              <Link
                key={chat.id}
                href={`/inbox/${chat.id}`}
                className="iwent-rail-chat-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 10px',
                  borderRadius: 14,
                  textDecoration: 'none',
                  transition: 'background-color .15s ease',
                }}
              >
                {chat.avatar ? (
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0, backgroundColor: SURFACE_2 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      backgroundColor: SURFACE_2, border: `1px solid ${LINE}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: TEXT_DIM,
                    }}
                  >
                    {initialsOf(chat.name)}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.name}
                    </span>
                    <span style={{ fontSize: 11.5, color: TEXT_FAINT, flexShrink: 0 }}>
                      {timeAgo(chat.lastMessage?.createdAt ?? chat.lastActivity, t, language === 'ru' ? 'ru-RU' : 'en-US')}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, color: TEXT_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {preview}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Правая панель десктопа (>=1320px) — стильная вторая колонка рядом с основным
 * "холстом". Чисто аддитивный элемент: не вмешивается в логику/компоненты
 * приложения, добавляет превью сообщений, быстрые действия и полезные ссылки.
 */
const AUTH_PATHS = ['/login', '/verify-email', '/add-account', '/add-account-verify', '/auth'];

export function DesktopRightRail() {
  const { t } = useLanguage();
  const pathname = usePathname();

  if (AUTH_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'))) return null;

  return (
    <>
      <style>{`
        .iwent-right-rail { display: none; }
        @media (min-width: ${RIGHT_RAIL_BREAKPOINT}px) {
          .iwent-right-rail { display: flex !important; }
        }
        .iwent-rail-link:hover { border-color: ${ACCENT} !important; color: ${TEXT} !important; }
        .iwent-rail-chat-row:hover { background-color: ${SURFACE_2} !important; }
      `}</style>

      <aside
        className="iwent-right-rail"
        style={{
          position: 'fixed',
          top: 28,
          right: 'max(24px, calc((100vw - 248px - 500px) / 2 - 300px))',
          width: RIGHT_RAIL_WIDTH,
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          flexDirection: 'column',
          gap: 16,
          zIndex: 50,
        }}
      >
        {/* Превью последних сообщений */}
        <MessagesWidget />

        {/* Быстрое создание события */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: TEXT_FAINT, marginBottom: 10, fontWeight: 600 }}>
            {t.desktop.quickActions}
          </div>
          <Link
            href="/create"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 46,
              borderRadius: 14,
              backgroundColor: ACCENT,
              color: '#1a0d00',
              fontSize: 14.5,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t.desktop.createEvent}
          </Link>

          <Link href="/explore" className="iwent-rail-link" style={linkRowStyle}>
            <span>{t.desktop.eventsFeed}</span>
            <span style={{ color: TEXT_FAINT }}>→</span>
          </Link>
          <Link href="/calendar" className="iwent-rail-link" style={linkRowStyle}>
            <span>{t.desktop.calendar}</span>
            <span style={{ color: TEXT_FAINT }}>→</span>
          </Link>
          <Link href="/memories" className="iwent-rail-link" style={linkRowStyle}>
            <span>{t.desktop.memories}</span>
            <span style={{ color: TEXT_FAINT }}>→</span>
          </Link>
        </div>

        {/* Полезные ссылки */}
        <div style={cardStyle}>
          <Link href="/privacy" className="iwent-rail-link" style={{ ...linkRowStyle, marginTop: 0 }}>
            <span>{t.desktop.privacyPolicy}</span>
            <span style={{ color: TEXT_FAINT }}>→</span>
          </Link>
          <Link href="/settings" className="iwent-rail-link" style={linkRowStyle}>
            <span>{t.desktop.settings}</span>
            <span style={{ color: TEXT_FAINT }}>→</span>
          </Link>
        </div>

        <div style={{ padding: '0 6px' }}>
          <span style={{ fontSize: 12, color: TEXT_FAINT }}>
            i<span style={{ color: ACCENT }}>w</span>ent · {new Date().getFullYear()}
          </span>
        </div>
      </aside>
    </>
  );
}
