'use client';

import Link from 'next/link';
import { TermsDocument } from './TermsDocument';
import styles from '../privacy/privacy.module.css';
import { useLanguage } from '@/client/context/LanguageContext';

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <div className={`privacy-legal-page ${styles.wrap}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.brand}>iwent</span>
          <Link href="/" className={styles.back}>
            {t.desktop.home}
          </Link>
        </header>
        <TermsDocument />
      </div>
    </div>
  );
}
