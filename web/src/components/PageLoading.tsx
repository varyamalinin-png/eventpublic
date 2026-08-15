'use client';

/**
 * Лёгкий индикатор загрузки страницы: скелетон + минимальный спиннер.
 * Используется как fallback для dynamic() и в loading.tsx для мгновенной отрисовки при переходах.
 */
export function PageLoading() {
  return (
    <div
      className="page-loading"
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 12,
        }}
      >
        <div
          className="page-loading-spinner"
          style={{
            width: 28,
            height: 28,
            border: '3px solid rgba(255, 141, 50, 0.22)',
            borderTopColor: '#ff8d32',
            borderRadius: '50%',
            animation: 'page-loading-spin 0.65s linear infinite',
          }}
        />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Загрузка</span>
      </div>
    </div>
  );
}
