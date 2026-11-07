import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Удаление аккаунта — iwent',
  description: 'Запрос на удаление аккаунта и связанных данных в приложении iwent.',
  robots: { index: true, follow: true },
};

const email = 'privacy@iwent.ru';
const subject = encodeURIComponent('Запрос на удаление аккаунта iwent / iwent account deletion request');
const body = encodeURIComponent(
  'Прошу удалить мой аккаунт iwent и связанные с ним данные.\n\nИмя пользователя: \nEmail аккаунта: \n\nI request deletion of my iwent account and associated data.\nUsername: \nAccount email: ',
);

export default function DeleteAccountPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'clamp(28px, 7vw, 64px) 24px',
        color: '#171717',
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.65,
      }}
    >
      <a href="/" style={{ color: '#a84e0a' }}>iwent</a>
      <h1>Удаление аккаунта iwent</h1>
      <p>
        Вы можете удалить аккаунт и связанные с ним данные одним из способов ниже. Удаление
        необратимо.
      </p>

      <h2>В приложении</h2>
      <p>Откройте «Профиль → Настройки → Удалить аккаунт» и подтвердите удаление.</p>

      <h2>Если вы не можете войти в приложение</h2>
      <p>
        Отправьте запрос на удаление аккаунта на адрес{' '}
        <a href={`mailto:${email}?subject=${subject}&body=${body}`}>{email}</a>. Укажите имя пользователя
        и адрес электронной почты, привязанный к аккаунту. Не отправляйте пароль или коды входа.
      </p>
      <p>
        Если у вас больше нет доступа к привязанному адресу, напишите об этом в запросе. Мы можем
        попросить подтвердить, что аккаунт принадлежит вам, прежде чем удалять его.
      </p>
      <p>
        После подтверждения запроса мы удалим аккаунт и связанные с ним данные в течение 30
        календарных дней и сообщим о результате по электронной почте. Удаляются данные профиля,
        события, публикации, сообщения, социальные связи и загруженные файлы, связанные с аккаунтом.
        Отдельные сведения могут сохраняться, если этого требует закон; резервные копии очищаются
        согласно циклу ротации.
      </p>

      <hr style={{ margin: '40px 0', border: 0, borderTop: '1px solid #ddd' }} />

      <h1 lang="en">Delete your iwent account</h1>
      <p lang="en">
        You can delete your iwent account and associated data using either option below. Deletion is
        permanent.
      </p>

      <h2 lang="en">In the app</h2>
      <p lang="en">Go to “Profile → Settings → Delete account” and confirm the deletion.</p>

      <h2 lang="en">If you cannot sign in</h2>
      <p lang="en">
        Email your deletion request to{' '}
        <a href={`mailto:${email}?subject=${subject}&body=${body}`}>{email}</a>. Include your username
        and the email address linked to your account. Do not send your password or sign-in codes.
      </p>
      <p lang="en">
        If you no longer have access to the linked email address, mention this in your request. We may
        ask you to verify that you own the account before deleting it.
      </p>
      <p lang="en">
        After verifying the request, we will delete the account and associated data within 30 calendar
        days and notify you by email. This includes profile data, events, posts, messages, social
        connections, and uploaded files associated with the account. Limited information may be kept
        where required by law; backups are cleared according to their rotation cycle.
      </p>

      <p style={{ marginTop: 36 }}>
        <a href="/privacy">Политика конфиденциальности / Privacy Policy</a>
        {' · '}
        <a href="/support">Поддержка / Support</a>
      </p>
    </main>
  );
}
