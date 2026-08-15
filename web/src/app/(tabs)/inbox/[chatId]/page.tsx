'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const ChatScreen = dynamic(
  () => import('@/client/app/(tabs)/inbox/[chatId]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function ChatPage() {
  return (
    <div className="mobile-layout chat-page-scroll">
      <div
        style={{
          width: '100%',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <ChatScreen />
      </div>
    </div>
  );
}

