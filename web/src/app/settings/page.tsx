'use client';

import dynamic from 'next/dynamic';
import { Providers } from '../providers';

const SettingsScreen = dynamic(
  () => {
    console.log('[Settings] Starting dynamic import...');
    return import('@/client/app/settings')
      .then(mod => {
        console.log('[Settings] Import successful, module keys:', Object.keys(mod));
        console.log('[Settings] Default export:', mod.default);
        return { default: mod.default };
      })
      .catch(err => {
        console.error('[Settings] Error loading Settings screen:', err);
        console.error('[Settings] Error stack:', err.stack);
        return { 
          default: () => (
            <div style={{ padding: 20, color: '#fff', backgroundColor: '#0f0f0f', minHeight: '100vh' }}>
              <h2 style={{ color: '#ff0000' }}>Ошибка загрузки настроек</h2>
              <p>Ошибка: {err?.message || String(err)}</p>
              <p>Пожалуйста, обновите страницу или обратитесь в поддержку.</p>
            </div>
          ) 
        };
      });
  },
  { ssr: false, loading: () => <LoadingScreen /> }
);

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f0f0f',
      color: '#FF8D32'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  console.log('[SettingsPage] Component rendering');
  
  return (
    <Providers>
      <div style={{ width: '100%', height: '100vh' }}>
        <SettingsScreen />
      </div>
    </Providers>
  );
}

