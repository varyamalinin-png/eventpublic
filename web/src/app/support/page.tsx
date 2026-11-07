'use client';

import Link from 'next/link';
import styles from '../privacy/privacy.module.css';
import { useLanguage } from '@/client/context/LanguageContext';

/**
 * Страница поддержки.
 *
 * Нужна не «для галочки»: App Store Connect требует рабочий Support URL, а
 * на /support был 404 — существовал только вложенный /support/complaints.
 * Оформление берём из privacy, чтобы юридические страницы выглядели одинаково.
 */
export default function SupportPage() {
  const { t, language } = useLanguage();
  const isEn = language === 'en';

  return (
    <div className={`privacy-legal-page ${styles.wrap}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.brand}>iwent</span>
          <Link href="/" className={styles.back}>
            {t.desktop.home}
          </Link>
        </header>

        <h1 className={styles.h1}>{isEn ? 'Support' : 'Поддержка'}</h1>
        <p className={styles.sub}>
          {isEn
            ? 'We answer within one business day.'
            : 'Отвечаем в течение одного рабочего дня.'}
        </p>

        <section className={styles.section}>
          <h2 className={styles.h2}>{isEn ? 'Contact us' : 'Как с нами связаться'}</h2>
          <p className={styles.p}>
            {isEn ? 'Email: ' : 'Почта: '}
            <a href="mailto:support@iwent.ru" className={styles.back}>
              support@iwent.ru
            </a>
          </p>
          <p className={styles.p}>
            {isEn
              ? 'Please include your username and, if the question is about an event, its name and date — that saves a round trip.'
              : 'Укажите, пожалуйста, свой ник, а если вопрос про событие — его название и дату: так не придётся переспрашивать.'}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{isEn ? 'Frequent questions' : 'Частые вопросы'}</h2>

          <h3 className={styles.h3}>
            {isEn ? 'How do I delete my account?' : 'Как удалить аккаунт?'}
          </h3>
          <p className={styles.p}>
            {isEn
              ? 'In the app: Profile → Settings → Delete account. Deletion is immediate and permanent — the account, your events, posts and messages are removed and cannot be restored.'
              : 'В приложении: Профиль → Настройки → Удалить аккаунт. Удаление происходит сразу и навсегда — аккаунт, ваши события, публикации и сообщения удаляются без возможности восстановления.'}
          </p>

          <h3 className={styles.h3}>
            {isEn ? 'The confirmation code did not arrive' : 'Не приходит код подтверждения'}
          </h3>
          <p className={styles.p}>
            {isEn
              ? 'Check the spam folder. The code is valid for 15 minutes; a new one can be requested two minutes after the previous one. If it still does not arrive, write to us from the address you registered with.'
              : 'Проверьте папку «Спам». Код действует 15 минут, повторный можно запросить через две минуты после предыдущего. Если письма всё равно нет — напишите нам с адреса, на который регистрировались.'}
          </p>

          <h3 className={styles.h3}>
            {isEn ? 'How do I report an event or a user?' : 'Как пожаловаться на событие или пользователя?'}
          </h3>
          <p className={styles.p}>
            {isEn
              ? 'Use the «…» menu on the event card or on the profile. We review reports within 24 hours.'
              : 'Через меню «…» на карточке события или в профиле. Жалобы рассматриваем в течение 24 часов.'}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{isEn ? 'Legal' : 'Документы'}</h2>
          <ul className={styles.ul}>
            <li className={styles.li}>
              <Link href="/privacy" className={styles.back}>
                {isEn ? 'Privacy Policy' : 'Политика конфиденциальности'}
              </Link>
            </li>
            <li className={styles.li}>
              <Link href="/terms" className={styles.back}>
                {isEn ? 'Terms of Use' : 'Пользовательское соглашение'}
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
