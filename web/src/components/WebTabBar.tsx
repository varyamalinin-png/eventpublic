'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Иконки для веб-версии (используем emoji или SVG)
const TabIcons = {
  explore: '🧭',
  memories: '📖',
  create: '➕',
  inbox: '💬',
  profile: '👤',
};

export function WebTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Пока используем 0 для непрочитанных, так как контекст может быть не доступен
  const unreadCount = 0;

  const tabs = [
    { name: 'explore', path: '/explore', icon: TabIcons.explore, label: 'Explore' },
    { name: 'memories', path: '/memories', icon: TabIcons.memories, label: 'Memories' },
    { name: 'create', path: '/create', icon: TabIcons.create, label: 'Create' },
    { name: 'inbox', path: '/inbox', icon: TabIcons.inbox, label: 'Inbox', badge: unreadCount },
    { name: 'profile', path: '/profile', icon: TabIcons.profile, label: 'Profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/explore') {
      return pathname === '/explore' || pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  return (
    <nav 
      className="web-tab-bar"
      role="tablist"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#121212',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 99999,
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        boxSizing: 'border-box',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}>
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.name}
            onClick={() => router.push(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 16px',
              color: active ? '#FFF' : '#888',
              transition: 'color 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FFF';
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = '#888';
              }
            }}
          >
            <div style={{
              fontSize: '24px',
              position: 'relative',
            }}>
              {tab.icon}
              {tab.badge && tab.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-10px',
                  backgroundColor: '#FF3B30',
                  borderRadius: '10px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#FFF',
                  border: '2px solid #121212',
                }}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: active ? '600' : '400',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

