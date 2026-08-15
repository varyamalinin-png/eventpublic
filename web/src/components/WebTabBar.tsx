'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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
  { name: 'explore', path: '/explore', iconKey: 'explore' as const, label: 'Explore' },
  { name: 'memories', path: '/memories', iconKey: 'memories' as const, label: 'Memories' },
  { name: 'create', path: '/create', iconKey: 'create' as const, label: 'Create' },
  { name: 'inbox', path: '/inbox', iconKey: 'inbox' as const, label: 'Inbox', badge: 0 },
  { name: 'profile', path: '/profile', iconKey: 'profile' as const, label: 'Profile' },
];

export const SIDEBAR_BREAKPOINT = 1024;

function isActivePath(pathname: string | null, path: string) {
  if (path === '/explore') return pathname === '/explore' || pathname === '/';
  return !!pathname?.startsWith(path);
}

function Badge({ value }: { value?: number }) {
  if (!value || value <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#e53935',
        borderRadius: 10,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 600,
        color: '#fff',
        border: '1.5px solid rgba(15,15,15,0.98)',
      }}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

export function WebTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  // optimistic — мгновенно подсвечиваем нажатый таб до окончания навигации
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const handleTabPress = useCallback((path: string) => {
    setPendingPath(path);
    router.push(path);
    // Сбрасываем pending когда pathname обновится (через useEffect ниже)
  }, [router]);

  // Сбрасываем optimistic state как только pathname совпал
  React.useEffect(() => {
    if (pendingPath && isActivePath(pathname, pendingPath)) {
      setPendingPath(null);
    }
  }, [pathname, pendingPath]);

  return (
    <>
      <style>{`
        .iwent-bottombar { display: flex; }
        @media (min-width: ${SIDEBAR_BREAKPOINT}px) {
          .iwent-bottombar { display: none !important; }
        }
      `}</style>

      <nav
        className="iwent-bottombar web-tab-bar"
        role="tablist"
        aria-label="Main navigation"
        style={{
          position: 'fixed',
          bottom: 'max(14px, env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%) translateZ(0)',
          height: '64px',
          backgroundColor: 'rgba(22, 22, 26, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: 24,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 99999,
          width: 'calc(100% - 28px)',
          maxWidth: '472px',
          boxSizing: 'border-box',
          backfaceVisibility: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        } as React.CSSProperties}
      >
        {tabs.map((tab) => {
          const committed = isActivePath(pathname, tab.path);
          // Optimistic: подсвечиваем мгновенно при нажатии
          const active = committed || pendingPath === tab.path;

          return (
            <Link
              key={tab.name}
              href={tab.path}
              prefetch={true}
              aria-current={committed ? 'page' : undefined}
              aria-label={tab.label}
              onClick={(e) => {
                e.preventDefault();
                handleTabPress(tab.path);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '9px 10px',
                color: active ? '#FF8D32' : 'rgba(244, 244, 245, 0.4)',
                // Убираем transition при optimistic — цвет меняется мгновенно
                transition: pendingPath ? 'none' : 'color 0.15s ease',
                position: 'relative',
                flex: '1 1 0',
                minWidth: 0,
                maxWidth: '100%',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  width: 38,
                  height: 30,
                  borderRadius: 13,
                  backgroundColor: active ? 'rgba(255, 141, 50, 0.14)' : 'transparent',
                  transition: pendingPath ? 'none' : 'background-color 0.15s ease',
                }}
              >
                {icons[tab.iconKey]}
                <Badge value={tab.badge} />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: 0.1 }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
