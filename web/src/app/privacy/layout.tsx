import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — iwent',
  description:
    'Политика конфиденциальности и обработки персональных данных сервиса iwent (ООО «Айвент»).',
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
