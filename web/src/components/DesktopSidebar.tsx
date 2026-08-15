'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/client/context/LanguageContext';

const ACCENT = '#FF8D32';
const SURFACE = '#141417';
const LINE = 'rgba(255,255,255,0.07)';
const TEXT = '#f4f4f5';
const TEXT_DIM = 'rgba(244,244,245,0.45)';

export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_BREAKPOINT = 1024;

const icons = {
  explore: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  ),
  memories: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  ),
  create: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  inbox: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  ),
};

const tabs = [
  { name: 'explore', path: '/explore', iconKey: 'explore' as const, labelKey: 'explore' as const },
  { name: 'memories', path: '/memories', iconKey: 'memories' as const, labelKey: 'memories' as const },
  { name: 'create', path: '/create', iconKey: 'create' as const, labelKey: 'create' as const },
  { name: 'inbox', path: '/inbox', iconKey: 'inbox' as const, labelKey: 'inbox' as const },
  { name: 'profile', path: '/profile', iconKey: 'profile' as const, labelKey: 'profile' as const },
];

function isActivePath(pathname: string | null, path: string) {
  if (path === '/explore') return pathname === '/explore' || pathname === '/';
  return !!pathname?.startsWith(path);
}

/**
 * Глобальная боковая навигация для десктопа (>=1024px).
 * Рендерится один раз в корневом layout — присутствует на всех страницах,
 * в т.ч. на тех, что не подключают WebTabBar (Settings, Auth-gate и т.п.).
 * На мобильном/планшете скрывается через CSS, не влияя на разметку.
 */
const AUTH_PATHS = ['/login', '/verify-email', '/add-account', '/add-account-verify', '/auth'];

export function DesktopSidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();

  if (AUTH_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'))) return null;

  return (
    <>
      <style>{`
        .iwent-desktop-sidebar { display: none; }
        @media (min-width: ${SIDEBAR_BREAKPOINT}px) {
          .iwent-desktop-sidebar { display: flex !important; }
        }
        .iwent-sidebar-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 11px 16px;
          border-radius: 14px;
          color: ${TEXT_DIM};
          text-decoration: none;
          font-size: 14.5px;
          font-weight: 500;
          transition: background-color .15s ease, color .15s ease;
          position: relative;
        }
        .iwent-sidebar-link:hover { background-color: rgba(255,255,255,0.045); color: ${TEXT}; }
        .iwent-sidebar-link.active { background-color: rgba(255,141,50,0.14); color: ${ACCENT}; }
        .iwent-sidebar-link.create { background-color: ${ACCENT}; color: #1a0d00; font-weight: 600; }
        .iwent-sidebar-link.create:hover { background-color: ${ACCENT}; color: #1a0d00; }
      `}</style>

      <nav
        className="iwent-desktop-sidebar"
        aria-label="Main navigation"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: SURFACE,
          borderRight: `1px solid ${LINE}`,
          flexDirection: 'column',
          padding: '28px 16px',
          boxSizing: 'border-box',
          zIndex: 9999,
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 28px' }}>
          <Image
            src="/auth-wordmark.png"
            alt="iwent"
            width={140}
            height={42}
            priority
            style={{ width: 140, height: 'auto', display: 'block' }}
          />
        </div>

        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.path);
          const isCreate = tab.name === 'create';
          return (
            <Link
              key={tab.name}
              href={tab.path}
              prefetch={true}
              aria-current={active ? 'page' : undefined}
              className={`iwent-sidebar-link${active && !isCreate ? ' active' : ''}${isCreate ? ' create' : ''}`}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {icons[tab.iconKey]}
              </span>
              <span>{t.tabs[tab.labelKey]}</span>
            </Link>
          );
        })}

        <div style={{ flex: 1 }} />

        <Link href="/settings" className="iwent-sidebar-link" style={{ marginTop: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>{t.desktop.settings}</span>
        </Link>
      </nav>
    </>
  );
}
