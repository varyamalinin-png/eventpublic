import styles from './privacy.module.css';

/**
 * English rendering of the privacy policy.
 *
 * The Russian text in PolicyDocument.tsx remains the operative version: the
 * document is built around Federal Law 152-FZ and is signed in Russian. This
 * translation is provided for readability and says so in the note below —
 * keep both files in step when the policy changes.
 */
export function PolicyDocumentEn() {
  return (
    <>
      <h1 className={styles.h1}>Privacy Policy &amp; Data Processing Policy</h1>
      <p className={styles.sub}>Политика конфиденциальности и обработки персональных данных</p>

      <div className={styles.intro}>
        <p className={styles.p}>
          This Privacy Policy describes what personal data the iwent service collects, how that data
          is used, stored, shared and protected, and what rights you have in relation to it. The
          document was drafted to meet the requirements of Federal Law No. 152-FZ &laquo;On Personal
          Data&raquo; (Russia), the General Data Protection Regulation (GDPR, EU) and the industry
          standards of major platforms (Meta, TikTok, Snap).
        </p>
        <p className={styles.p}>
          By using iwent you accept the terms of this Policy. If you do not agree with it, please do
          not use the service.
        </p>
        <p className={styles.p}>
          <strong>This is a translation.</strong> The Russian version of this Policy is the operative
          text; in the event of any discrepancy, the Russian version prevails.
        </p>
      </div>

      <section className={styles.section} id="s1">
        <h2 className={styles.h2}>1. General provisions</h2>
        <h3 className={styles.h3}>1.1 Who we are</h3>
        <p className={styles.p}>
          The personal data operator is iwent (hereinafter &laquo;iwent&raquo;, &laquo;we&raquo;).
          Email for privacy enquiries:{' '}
          <a className={styles.mail} href="mailto:privacy@iwent.ru">
            privacy@iwent.ru
          </a>
          .
        </p>
        <h3 className={styles.h3}>1.2 Who this Policy applies to</h3>
        <p className={styles.p}>
          The Policy applies to all natural persons (hereinafter &laquo;users&raquo;,
          &laquo;you&raquo;) who register in the iwent mobile application or otherwise interact with
          our services, including the web version, the API and partner integrations.
        </p>
        <p className={styles.p}>
          Legal entities and sole traders who have entered into an event-placement agreement
          (business accounts) are additionally subject to section 9 of this Policy.
        </p>
        <h3 className={styles.h3}>1.3 Changes to the Policy</h3>
        <p className={styles.p}>
          We reserve the right to amend the Policy. We notify users of material changes by push
          notification and/or email at least 30 days before they take effect. Continued use of the
          service after the effective date constitutes acceptance of the new version.
        </p>
      </section>

      <section className={styles.section} id="s2">
        <h2 className={styles.h2}>2. Data we collect</h2>
        <h3 className={styles.h3}>2.1 Data you provide directly</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Identification</td>
                <td>Name or pseudonym, date of birth, gender (optional), profile photo</td>
              </tr>
              <tr>
                <td>Contact details</td>
                <td>Phone number (required), email address (required)</td>
              </tr>
              <tr>
                <td>Identity verification</td>
                <td>
                  Passport or other identity document series and number (required at registration
                  under 152-FZ)
                </td>
              </tr>
              <tr>
                <td>Profile and interests</td>
                <td>Interest tags, short bio, links to external profiles (optional)</td>
              </tr>
              <tr>
                <td>Event content</td>
                <td>Photos, videos, text notes and music tracks uploaded to event profiles</td>
              </tr>
              <tr>
                <td>Financial data</td>
                <td>
                  Payment method details are passed directly to the payment provider (Stripe /
                  YooKassa); we do not store card data
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className={styles.h3}>2.2 Data collected automatically</h3>
        <p className={styles.p}>
          <strong>Technical data:</strong> IP address, operating system type and version, device
          model, unique device identifier (IDFA/GAID), application version, interface language.
        </p>
        <p className={styles.p}>
          <strong>Location data:</strong> with your explicit consent — precise real-time geolocation
          (GPS) to show events on the map; approximate location is derived from the IP address to
          personalise the feed.
        </p>
        <p className={styles.p}>
          <strong>Behavioural data:</strong> session duration, event cards viewed, swipes, clicks,
          search history, the list of events created and attended, interaction with advertising.
        </p>
        <p className={styles.p}>
          <strong>Logs:</strong> date and time of server requests, application errors, crash reports.
        </p>

        <h3 className={styles.h3}>2.3 Data from third-party sources</h3>
        <ul className={styles.ul}>
          <li className={styles.li}>
            When signing in via Apple ID, Google or VK — the name, email address and unique
            identifier provided by that platform.
          </li>
          <li className={styles.li}>
            From advertising partners — aggregated audience data for targeting (without direct
            identification of individuals).
          </li>
          <li className={styles.li}>
            From public registries when verifying business accounts (EGRUL/EGRIP).
          </li>
        </ul>
      </section>

      <section className={styles.section} id="s3">
        <h2 className={styles.h2}>3. Purposes of processing and legal bases</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Data</th>
                <th>Legal basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account registration and verification</td>
                <td>Phone, email, identity document details, date of birth</td>
                <td>Performance of a contract (GDPR art. 6(1)(b); 152-FZ art. 6(1)(5))</td>
              </tr>
              <tr>
                <td>Core functionality (feed, events, chat)</td>
                <td>Geolocation, profile, content, behavioural data</td>
                <td>Performance of a contract; legitimate interest</td>
              </tr>
              <tr>
                <td>Feed and recommendation personalisation</td>
                <td>Behavioural data, interests, geolocation</td>
                <td>Consent (at first launch) + legitimate interest</td>
              </tr>
              <tr>
                <td>Safety and moderation</td>
                <td>All data categories, logs</td>
                <td>Legitimate interest; legal compliance</td>
              </tr>
              <tr>
                <td>Serving advertising</td>
                <td>Behavioural data, geolocation, IDFA/GAID</td>
                <td>Consent (may be withdrawn in settings)</td>
              </tr>
              <tr>
                <td>Analytics and product improvement</td>
                <td>Aggregated and anonymised data</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>Meeting statutory requirements</td>
                <td>Upon request from authorised bodies</td>
                <td>Legal compliance (GDPR art. 6(1)(c))</td>
              </tr>
              <tr>
                <td>Marketing communications</td>
                <td>Email, push, phone</td>
                <td>Consent (may be withdrawn at any time)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} id="s4">
        <h2 className={styles.h2}>4. Data retention and deletion</h2>
        <h3 className={styles.h3}>4.1 Retention periods</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data category</th>
                <th>Retention period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account data</td>
                <td>Until the account is deleted + 30 days in backups</td>
              </tr>
              <tr>
                <td>Event content</td>
                <td>Until deleted by the user or with the account</td>
              </tr>
              <tr>
                <td>Financial transactions</td>
                <td>5 years (Russian tax law requirement)</td>
              </tr>
              <tr>
                <td>Identity document data</td>
                <td>Until the account is deleted + 1 year (152-FZ requirement)</td>
              </tr>
              <tr>
                <td>Logs</td>
                <td>12 months</td>
              </tr>
              <tr>
                <td>Advertising data and cookies</td>
                <td>13 months</td>
              </tr>
              <tr>
                <td>Moderation data (complaints, blocks)</td>
                <td>3 years</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3 className={styles.h3}>4.2 Account deletion</h3>
        <p className={styles.p}>
          You may delete your account at any time via Settings → Account → Delete account. After
          confirmation:
        </p>
        <ul className={styles.ul}>
          <li className={styles.li}>Within 24 hours the account becomes unavailable to other users.</li>
          <li className={styles.li}>Within 30 days the data is removed from the primary databases.</li>
          <li className={styles.li}>Within 90 days the data is removed from backups.</li>
        </ul>
        <p className={styles.p}>
          Data we are required by law to keep (financial records, moderation data) is retained for
          the period prescribed by law.
        </p>
      </section>

      <section className={styles.section} id="s5">
        <h2 className={styles.h2}>5. Sharing data with third parties</h2>
        <h3 className={styles.h3}>5.1 We do not sell your data</h3>
        <p className={styles.p}>
          iwent does not sell users&apos; personal data to third parties. Data is shared only in the
          cases described below.
        </p>
        <h3 className={styles.h3}>5.2 Categories of recipients</h3>
        <ul className={styles.ul}>
          <li className={styles.li}>
            <strong>Payment providers</strong> (Stripe Inc., YooKassa NCO LLC): payment instrument
            data for processing transactions. Data is transmitted encrypted directly to the provider;
            we neither receive nor store card details.
          </li>
          <li className={styles.li}>
            <strong>Cloud infrastructure:</strong> Yandex Cloud (Russia) — primary storage; AWS
            (Ireland, EU) — backup. Servers located in Russia are used for the primary storage of
            Russian citizens&apos; personal data (152-FZ art. 18(5)).
          </li>
          <li className={styles.li}>
            <strong>Analytics services:</strong> Amplitude Inc. (USA) — behavioural analytics; only
            pseudonymised event identifiers are transmitted, without names.
          </li>
          <li className={styles.li}>
            <strong>Push notification services:</strong> Apple APNs (USA), Firebase Cloud Messaging /
            Google (USA) — device tokens for delivering notifications.
          </li>
          <li className={styles.li}>
            <strong>Advertising partners:</strong> where you have given explicit consent —
            anonymised audience segments (hashed identifiers) for targeted advertising.
          </li>
          <li className={styles.li}>
            <strong>Authorised bodies:</strong> Roskomnadzor, the Ministry of Internal Affairs,
            courts and other bodies — upon lawful request, to the extent prescribed by law.
          </li>
          <li className={styles.li}>
            <strong>Emergency services:</strong> in the event of an immediate threat to the life or
            health of a user or a third party.
          </li>
        </ul>
        <h3 className={styles.h3}>5.3 Cross-border data transfers</h3>
        <p className={styles.p}>
          When transferring data outside the Russian Federation we act under art. 12(3) of Federal
          Law No. 152-FZ and ensure an adequate level of protection through standard contractual
          clauses (SCCs, GDPR) and by processing in countries that provide an adequate level of
          personal data protection.
        </p>
      </section>

      <section className={styles.section} id="s6">
        <h2 className={styles.h2}>6. Your rights</h2>
        <h3 className={styles.h3}>6.1 List of rights</h3>
        <p className={styles.p}>
          Under 152-FZ and the GDPR you have the following rights in relation to your personal data:
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Right</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Right of access</td>
                <td>Obtain a copy of the data we process about you</td>
              </tr>
              <tr>
                <td>Right to rectification</td>
                <td>
                  Update or correct inaccurate data (most of it can be edited in profile settings)
                </td>
              </tr>
              <tr>
                <td>Right to erasure</td>
                <td>
                  Request deletion of your data (see 4.2); limited by statutory retention obligations
                </td>
              </tr>
              <tr>
                <td>Right to restriction of processing</td>
                <td>Suspend processing in disputed situations</td>
              </tr>
              <tr>
                <td>Right to data portability</td>
                <td>Receive your data in a machine-readable format (JSON/CSV)</td>
              </tr>
              <tr>
                <td>Right to object</td>
                <td>
                  Object to processing based on legitimate interest or for direct marketing purposes
                </td>
              </tr>
              <tr>
                <td>Right to withdraw consent</td>
                <td>
                  Withdraw consent at any time without affecting the lawfulness of processing carried
                  out beforehand
                </td>
              </tr>
              <tr>
                <td>Right to lodge a complaint</td>
                <td>
                  Complain to Roskomnadzor (rkn.gov.ru) or to the EU supervisory authority where you
                  live
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3 className={styles.h3}>6.2 How to exercise your rights</h3>
        <p className={styles.p}>
          Send your request to{' '}
          <a className={styles.mail} href="mailto:privacy@iwent.ru">
            privacy@iwent.ru
          </a>
          . We respond within 30 calendar days. We may ask you to confirm your identity via the
          linked phone number. Data export is available under Settings → Privacy → Download my data
          (prepared within 72 hours).
        </p>
      </section>

      <section className={styles.section} id="s7">
        <h2 className={styles.h2}>7. Data security</h2>
        <h3 className={styles.h3}>7.1 Technical safeguards</h3>
        <ul className={styles.ul}>
          <li className={styles.li}>
            <strong>Encryption in transit:</strong> TLS 1.3 for all connections between the app and
            our servers.
          </li>
          <li className={styles.li}>
            <strong>Encryption at rest:</strong> AES-256 for databases and file storage.
          </li>
          <li className={styles.li}>
            <strong>Chat message encryption:</strong> end-to-end encryption based on the Signal
            Protocol.
          </li>
          <li className={styles.li}>
            <strong>Authentication:</strong> mandatory two-factor authentication via SMS/TOTP for
            higher-risk actions (changing email, deleting the account).
          </li>
          <li className={styles.li}>
            <strong>Access control:</strong> least-privilege principle (RBAC) and multi-factor
            authentication for staff with access to production data.
          </li>
          <li className={styles.li}>
            <strong>Monitoring and threat detection:</strong> a SIEM system monitoring anomalous
            activity 24/7.
          </li>
          <li className={styles.li}>
            <strong>Penetration testing:</strong> at least once a year by independent auditors.
          </li>
        </ul>
        <h3 className={styles.h3}>7.2 Identity verification</h3>
        <p className={styles.p}>
          At registration you must complete identity verification using an identity document
          (Russian passport, international passport or other). Verification is carried out through a
          partner SDK (Sumsub or equivalent); the document data is processed by the partner and is
          not stored in full on iwent servers — we receive only the check result (passed/failed) and
          your age bracket.
        </p>
        <h3 className={styles.h3}>7.3 Incident response</h3>
        <p className={styles.p}>
          In the event of a breach or unauthorised access to data capable of harming users&apos;
          rights, we undertake to:
        </p>
        <ul className={styles.ul}>
          <li className={styles.li}>Notify Roskomnadzor within 24 hours of detection.</li>
          <li className={styles.li}>
            Notify affected users within 72 hours by push notification and/or email, describing the
            nature of the incident, the data likely affected and the measures taken.
          </li>
          <li className={styles.li}>Investigate and publish the findings within 30 days.</li>
        </ul>
      </section>

      <section className={styles.section} id="s8">
        <h2 className={styles.h2}>8. Cookies and analytics SDKs</h2>
        <h3 className={styles.h3}>8.1 Types of cookies and trackers</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Purpose</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Strictly necessary</td>
                <td>Authentication, session security, core app functionality</td>
                <td>Cannot be disabled</td>
              </tr>
              <tr>
                <td>Analytics</td>
                <td>Amplitude: usage statistics, funnels, retention</td>
                <td>Disable under Settings → Privacy</td>
              </tr>
              <tr>
                <td>Advertising (IDFA/GAID)</td>
                <td>Install attribution, ad targeting</td>
                <td>Disable in OS settings (Limit Ad Tracking / Opt Out)</td>
              </tr>
              <tr>
                <td>Functional</td>
                <td>Storing preferences (language, theme, filters)</td>
                <td>Disable in app settings</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.p}>
          To opt out of advertising analytics: iOS — Settings → Privacy → Tracking → deny for iwent;
          Android — Settings → Privacy → Ads → Opt out of Ads Personalisation.
        </p>
      </section>

      <section className={styles.section} id="s9">
        <h2 className={styles.h2}>9. Business accounts and partners</h2>
        <h3 className={styles.h3}>9.1 Organisation data</h3>
        <p className={styles.p}>
          When a business account is registered we collect: organisation name, INN, OGRN/OGRNIP,
          registered address, contact details of the authorised representative and bank details for
          payouts. This data is processed on the basis of a contract and legitimate interest.
        </p>
        <h3 className={styles.h3}>9.2 Advertising dashboard</h3>
        <p className={styles.p}>
          Campaign data (reach, clicks, conversions, spend) is kept in the organisation&apos;s
          dashboard for 24 months and is available only to authorised users of that account.
        </p>
        <h3 className={styles.h3}>9.3 Sharing user data with advertisers</h3>
        <p className={styles.p}>
          Advertisers do not gain access to the personal data of users who click an advertisement.
          Only aggregated statistics are shared (numbers of clicks, impressions and conversions),
          with no way to identify specific individuals. Attribution is implemented through hashed
          identifiers.
        </p>
      </section>

      <section className={styles.section} id="s10">
        <h2 className={styles.h2}>10. Protection of minors</h2>
        <p className={styles.p}>
          iwent is available from the age of 12. Users aged 12 to 17 may use the app only with the
          consent of a parent or legal guardian, confirmed during verification. We apply additional
          restrictions for minors:
        </p>
        <ul className={styles.ul}>
          <li className={styles.li}>
            A minor&apos;s profile is private by default (visible only to confirmed contacts).
          </li>
          <li className={styles.li}>Direct messages are available only with users in their contacts.</li>
          <li className={styles.li}>
            Location is shown at district level rather than as a precise point.
          </li>
          <li className={styles.li}>Behavioural ad targeting is disabled.</li>
          <li className={styles.li}>Events rated 18+ are not shown in the feed.</li>
        </ul>
        <p className={styles.p}>
          If we learn that a child under 12 has registered by circumventing verification, we will
          delete the account and all associated data without delay.
        </p>
      </section>

      <section className={styles.section} id="s11">
        <h2 className={styles.h2}>11. Applicable law and regulatory requirements</h2>
        <h3 className={styles.h3}>11.1 Russian law</h3>
        <ul className={styles.ul}>
          <li className={styles.li}>
            Federal Law No. 152-FZ of 27 July 2006 &laquo;On Personal Data&raquo; and Roskomnadzor
            secondary legislation.
          </li>
          <li className={styles.li}>
            Storage of Russian citizens&apos; personal data on servers located in the Russian
            Federation (152-FZ art. 18(5)).
          </li>
          <li className={styles.li}>
            Notification of Roskomnadzor regarding personal data processing (operators register).
          </li>
        </ul>
        <h3 className={styles.h3}>11.2 European law (GDPR)</h3>
        <p className={styles.p}>
          For users located in the European Economic Area, Regulation (EU) 2016/679 applies. The
          legal bases for processing are: performance of a contract (art. 6(1)(b)), legitimate
          interest (art. 6(1)(f)), consent (art. 6(1)(a)) and compliance with legal obligations
          (art. 6(1)(c)).
        </p>
        <h3 className={styles.h3}>11.3 Data Protection Officer (DPO)</h3>
        <p className={styles.p}>
          A Data Protection Officer has been appointed under GDPR art. 37. Contact:{' '}
          <a className={styles.mail} href="mailto:dpo@iwent.app">
            dpo@iwent.app
          </a>
          .
        </p>
      </section>

      <section className={styles.section} id="s12">
        <h2 className={styles.h2}>12. Contacts and enquiries</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <th scope="row">General privacy enquiries</th>
                <td>
                  <a className={styles.mail} href="mailto:privacy@iwent.ru">
                    privacy@iwent.ru
                  </a>
                </td>
              </tr>
              <tr>
                <th scope="row">Data Protection Officer (DPO)</th>
                <td>
                  <a className={styles.mail} href="mailto:dpo@iwent.app">
                    dpo@iwent.app
                  </a>
                </td>
              </tr>
              <tr>
                <th scope="row">Data deletion / export</th>
                <td>In the app: Settings → Privacy</td>
              </tr>
              <tr>
                <th scope="row">Complaints and incidents</th>
                <td>
                  <a className={styles.mail} href="mailto:privacy@iwent.ru?subject=Incident">
                    privacy@iwent.ru
                  </a>{' '}
                  (subject: &laquo;Incident&raquo;)
                </td>
              </tr>
              <tr>
                <th scope="row">Postal address</th>
                <td>
                  Aivent LLC, <strong>[registered address]</strong>, marked &laquo;Personal
                  Data&raquo;
                </td>
              </tr>
              <tr>
                <th scope="row">Supervisory authority (Russia)</th>
                <td>Roskomnadzor, rkn.gov.ru</td>
              </tr>
              <tr>
                <th scope="row">Supervisory authority (EU)</th>
                <td>The authority where the data subject resides</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className={styles.note}>
        Effective date: <strong>1 January 2026</strong>. Document version: <strong>1.0</strong>.
        <br />
        <br />
        Chief Executive Officer, Aivent LLC: _______________________ / ____________________
        <br />
        Seal.
      </p>
    </>
  );
}
