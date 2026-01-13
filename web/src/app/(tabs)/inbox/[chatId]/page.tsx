'use client';

import dynamic from 'next/dynamic';
import DesktopThreeColumnLayout from '../../../../components/DesktopThreeColumnLayout';

const ChatScreen = dynamic(
  () => import('@/client/app/(tabs)/inbox/[chatId]').then(mod => ({ default: mod.default })),
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
      color: '#8B5CF6'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      <div className="desktop-three-column-layout" style={{ display: 'none' }}>
        <DesktopThreeColumnLayout />
      </div>
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
      <div style={{ width: '100%', height: '100vh' }}>
        <ChatScreen />
        </div>
      </div>
    </>
  );
}

