import styles from './privacy.module.css';

export function PolicyDocumentEn() {
  return (
    <>
      <h1 className={styles.h1}>Privacy Policy</h1>
      <p className={styles.sub}>iwent service · version dated 4 November 2026</p>

      <div className={styles.intro}>
        <p className={styles.p}>
          This Policy explains how Aivent LLC (the iwent service, “we”) processes data when you use
          the iwent website and app. For privacy enquiries, contact{' '}
          <a className={styles.mail} href="mailto:privacy@iwent.ru">privacy@iwent.ru</a>.
        </p>
      </div>

      <section className={styles.section} id="data-collected">
        <h2 className={styles.h2}>Data we process</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            <strong>Account and profile:</strong> email address, username, password (stored as a
            cryptographic hash), and an internal account identifier. A phone number and display name
            are optional. A user may add a profile photo, bio, age or date of birth, gender, and
            visibility settings.
          </li>
          <li className={styles.li}>
            <strong>Content and activity:</strong> events you create and their selected place and
            coordinates, photos and videos, posts, comments, messages, reactions, connections with
            other users, event participation, reports, and app settings.
          </li>
          <li className={styles.li}>
            <strong>Location:</strong> if you grant permission, the app obtains your precise device
            location to show your position on a map and sort events by distance. Feed sorting is
            performed on your device. When you search for an address, select a place, or request an
            address for coordinates, the relevant search query or coordinates are sent to Yandex Maps
            for geocoding. A place you select and save for an event is sent to iwent and shown
            according to the event’s visibility settings.
          </li>
          <li className={styles.li}>
            <strong>Notifications:</strong> if you allow push notifications, the app sends the device
            token, platform, and language to our server. The token is used to deliver notifications.
          </li>
          <li className={styles.li}>
            <strong>Technical data:</strong> IP address, request time and path, request type, and
            technical error information may appear in server logs to operate and protect the service.
            We do not use ad tracking or advertising IDs in the app.
          </li>
        </ul>
        <p className={styles.p}>
          We do not ask for passport details. The app has no built-in payment service or advertising
          analytics. A phone number is not required to register. We do not collect your device’s
          address book contacts.
        </p>
      </section>

      <section className={styles.section} id="purposes">
        <h2 className={styles.h2}>How we use data</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>to create accounts, sign users in, verify email addresses, and restore access;</li>
          <li className={styles.li}>to provide the feed, profiles, events, map, messages, posts, and social features;</li>
          <li className={styles.li}>to deliver push notifications selected by the user;</li>
          <li className={styles.li}>to protect accounts, prevent abuse, and resolve technical failures;</li>
          <li className={styles.li}>to respond to user requests and comply with applicable law.</li>
        </ul>
        <p className={styles.p}>We do not sell personal data or use it to serve targeted ads.</p>
      </section>

      <section className={styles.section} id="sharing">
        <h2 className={styles.h2}>Who may receive data</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            <strong>Hosting and storage providers:</strong> reg.ru hosts the iwent server and database;
            Yandex Cloud Object Storage stores uploaded files. Yandex Cloud Postbox delivers service
            emails.
          </li>
          <li className={styles.li}>
            <strong>Yandex Maps:</strong> address searches and coordinates for which the user requests
            geocoding or reverse geocoding.
          </li>
          <li className={styles.li}>
            <strong>Platform map provider:</strong> Apple Maps on iOS and Google Maps on Android
            display maps and selected places. When the “My Location” layer is enabled, the map
            provider may process location data to show the location dot.
          </li>
          <li className={styles.li}>
            <strong>Apple Push Notification service and Firebase Cloud Messaging:</strong> the device
            token and information needed to deliver a push notification on the relevant platform.
          </li>
          <li className={styles.li}>
            <strong>Email provider:</strong> the email address and service email content used to
            verify the address or restore access.
          </li>
          <li className={styles.li}>Government authorities, where disclosure is required by applicable law.</li>
        </ul>
        <p className={styles.p}>
          Profiles, events, posts, comments, and other materials may be visible to other users
          according to privacy settings and the visibility selected in the app. Do not post
          information publicly if you do not want to share it.
        </p>
      </section>

      <section className={styles.section} id="retention">
        <h2 className={styles.h2}>Storage and deletion</h2>
        <p className={styles.p}>
          Account data and related materials are kept while the account is active or while needed to
          provide service features. You can delete your account in the app: “Profile → Settings →
          Delete account”. If you cannot access the app, submit a request through the{' '}
          <a href="/delete-account" className={styles.mail}>account deletion page</a>.
        </p>
        <p className={styles.p}>
          When an account is deleted, the server deletes the account and associated records, including
          events, posts, messages, and connections created by that user. Files uploaded by the user
          for their profile and events are deleted from storage. Backups may contain data until their
          rotation cycle expires. Limited information may be retained where required by law and is
          restricted to that purpose.
        </p>
        <p className={styles.p}>
          Requests to access, correct, or delete data can be sent to{' '}
          <a className={styles.mail} href="mailto:privacy@iwent.ru">privacy@iwent.ru</a>.
        </p>
      </section>

      <section className={styles.section} id="security">
        <h2 className={styles.h2}>Data security</h2>
        <p className={styles.p}>
          We use secure network connections to protect data in transit. Passwords are not stored in
          plaintext, and access to account data is limited to what is needed to operate the service.
          No method of transmission or storage can guarantee absolute security.
        </p>
      </section>

      <section className={styles.section} id="rights">
        <h2 className={styles.h2}>Your choices and requests</h2>
        <p className={styles.p}>
          You can revoke location and notification permissions in your device settings. Profile data
          and content visibility can be changed in the app. For questions about data processing, email{' '}
          <a className={styles.mail} href="mailto:privacy@iwent.ru">privacy@iwent.ru</a> or contact
          support at <a className={styles.mail} href="/support">iwent.ru/support</a>.
        </p>
      </section>
    </>
  );
}
