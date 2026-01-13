'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import dynamicImport from 'next/dynamic';
import DesktopThreeColumnLayout from '../../../components/DesktopThreeColumnLayout';
import { WebTabBar } from '../../../components/WebTabBar';

// Error Boundary для обработки ошибок инициализации
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ExplorePage] Error caught by boundary:', error, errorInfo);
    
    // Если это ошибка инициализации, пробуем перезагрузить через некоторое время
    if (error.message?.includes('Cannot access') || error.message?.includes('before initialization')) {
      console.warn('[ExplorePage] Initialization error detected, will retry...');
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 2000);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#0f0f0f',
          color: '#fff',
          flexDirection: 'column',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <div style={{ fontSize: '18px', marginBottom: '10px', textAlign: 'center' }}>
            Произошла ошибка при загрузке страницы
          </div>
          <div style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginBottom: '20px' }}>
            {this.state.error?.message || 'Неизвестная ошибка'}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8B5CF6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Динамический импорт с обработкой ошибок
const ExploreScreen = dynamicImport(
  () => import('@/client/app/(tabs)/explore')
    .then(mod => {
      if (!mod || !mod.default) {
        throw new Error('ExploreScreen component not found in module');
      }
      return { default: mod.default };
    })
    .catch((error) => {
      console.error('[ExplorePage] Error loading ExploreScreen:', error);
      // Возвращаем компонент-заглушку вместо ошибки
      return {
        default: () => (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#0f0f0f',
            color: '#fff',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
            <div>Ошибка загрузки компонента. Пожалуйста, обновите страницу.</div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#8B5CF6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Обновить
            </button>
          </div>
        )
      };
    }),
  { 
    ssr: false, 
    loading: () => <LoadingScreen /> 
  }
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

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  // На десктопе показываем DesktopThreeColumnLayout, на мобильных - ExploreScreen
  return (
    <ErrorBoundary>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      <div className="desktop-three-column-layout" style={{ display: 'none' }}>
        <DesktopThreeColumnLayout />
      </div>
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <ExploreScreen />
        <WebTabBar />
      </div>
    </ErrorBoundary>
  );
}
