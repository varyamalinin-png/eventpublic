import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Поддержка — iwent',
  description: 'Как связаться со службой поддержки iwent: почта, сроки ответа, частые вопросы.',
  robots: { index: true, follow: true },
};

export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
