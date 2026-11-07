import Link from 'next/link';
import { PolicyDocument } from './PolicyDocument';
import { PolicyDocumentEn } from './PolicyDocument.en';
import styles from './privacy.module.css';

/** Keep the complete policy in the initial HTML so it is readable without app JavaScript. */
export default function PrivacyPage() {
  return (
    <main className={`privacy-legal-page ${styles.wrap}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.brand}>iwent</span>
          <Link href="/" className={styles.back}>На главную / Home</Link>
        </header>
        <PolicyDocument />
        <hr style={{ margin: '48px 0', border: 0, borderTop: '1px solid #ddd' }} />
        <PolicyDocumentEn />
      </div>
    </main>
  );
}
