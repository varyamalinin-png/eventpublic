'use client';

import dynamicImport from 'next/dynamic';
import { useEffect, useState } from 'react';
import DesktopThreeColumnLayout from '../../components/DesktopThreeColumnLayout';
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

  // В Next.js App Router layout должен оборачивать children
  // Но мы хотим показывать DesktopThreeColumnLayout на десктопе
  // Решение: всегда рендерим DesktopThreeColumnLayout, но передаем children как fallback
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      <div className="desktop-three-column-layout" style={{ display: 'none' }}>
        <DesktopThreeColumnLayout />
      </div>
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        {children}
        {mounted && <WebTabBar />}
      </div>
    </div>
  );
}
