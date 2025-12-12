'use client';

import dynamicImport from 'next/dynamic';
import { useEffect, useState } from 'react';

const WebTabBar = dynamicImport(
  () => import('../../components/WebTabBar').then(mod => ({ default: mod.WebTabBar })),
  { ssr: false }
);

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
    <>
      <div style={{ paddingBottom: '60px', minHeight: '100vh' }}>
        {children}
      </div>
      {mounted && <WebTabBar />}
    </>
  );
}

