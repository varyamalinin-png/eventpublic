'use client';

import Link from 'next/link';
import { PolicyDocument } from './PolicyDocument';
import { PolicyDocumentEn } from './PolicyDocument.en';
import styles from './privacy.module.css';
import { useLanguage } from '@/client/context/LanguageContext';

export default function PrivacyPage() {
  const { t, language } = useLanguage();
  return (
    <div className={`privacy-legal-page ${styles.wrap}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.brand}>iwent</span>
          <Link href="/" className={styles.back}>
            {t.desktop.home}
          </Link>
        </header>
        {language === 'en' ? <PolicyDocumentEn /> : <PolicyDocument />}
      </div>
    </div>
  );
}
