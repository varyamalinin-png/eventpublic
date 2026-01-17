'use client';

import dynamicImport from 'next/dynamic';
import { useEffect, useState } from 'react';
import { WebTabBar } from '../../components/WebTabBar';

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div className="mobile-layout">
        {children}
        {mounted && <WebTabBar />}
      </div>
    </div>
  );
}
