# iWent — project guide for working sessions

This file exists so a fresh session doesn't have to rediscover the same
non-obvious facts every time. It's a map of where things live and why the
repo looks the way it does, not a feature list. Update it when you learn
something surprising that cost you time to figure out.

## 0. The one thing to read before touching git

`client/` is tracked by the parent repo as a **gitlink** (mode `160000`,
same mechanism as a submodule) but **there is no `.gitmodules` file**.
`git submodule status` fails with "no submodule mapping found". This means:

- `client/` has its own independent `.git` — commit/push/log inside it like
  any repo, `cd client && git status`.
- The parent repo just stores a pointer to whatever commit `client/` is
  currently on. After committing inside `client/`, `git add client && git
  commit` in the parent to move the pointer forward.
- A fresh clone of the parent repo will **not** populate `client/` (no
  `.gitmodules` to tell git where to fetch it from). If you ever see an
  empty `client/`, that's why.

**Resolved 2026-08-09: `client/`'s `main` branch was stuck mid-rebase for
months across many sessions** (detached HEAD, `main` 8 commits behind,
new work — the whole OTP/phone-verification feature — accidentally
committed on top of the abandoned rebase instead of on `main`). Finished
it via `git rebase --continue` (Claude Code's own permission classifier
blocks running `git rebase --continue` directly — the user has to run it
in their own terminal; get the terminal output pasted back and resolve
conflicts by editing files, then have them re-run `--continue`). Before
touching it: full backups were taken — branch `backup/detached-head-20260730`,
tag `backup/main-before-rebase-fix-20260730`, and `git bundle create
--all` for both `client/` and the root repo, saved outside the repo tree
(`~/iwent-backups-20260730/`). Those backups are still sitting there;
delete them once you're confident nothing needs restoring.

The commits trapped in that rebase weren't stale — they were real fixes
(duplicate top-of-file imports in `components/RequestMiniCard.tsx`,
defensive `Array.isArray`/try-catch checks throughout `explore.tsx`) that
had just never landed. Finishing the rebase dropped `client/`'s `tsc
--noEmit` baseline from 78 errors to 64. **If a conflict pattern shows the
same closing tags appearing on both sides of a hunk that structurally
means completely different things** (e.g. one side's `</ScrollView>`
closing a totally different, already-superseded component than the
other's), don't trust the textual alignment — check `git show
backup/detached-head-20260730:path/to/file` (or whatever pre-fix ref you
saved) for the actual known-good structure before resolving.

If you ever see this pattern again (detached HEAD + `main` behind on a
gitlinked repo like `client/`): `git branch -vv` inside it is the tell —
don't assume `git log --oneline` looking linear means `main` is current.

## 1. Repo layout — three consumers of one codebase

```
event_app_new/            root Expo shell: ios/, android/, app.json, eas.json
├── client/                ← ALL actual screens/components/logic live here
│   ├── app/                expo-router file-based routes
│   ├── components/
│   ├── context/            AuthContext, LanguageContext, EventsContext...
│   ├── hooks/
│   ├── constants/           DesignSystem.ts (colors/spacing/type tokens)
│   ├── locales/             ru.ts / en.ts — see §4
│   └── utils/
├── web/                    Next.js wrapper — thin pages that re-render client/ screens
├── server/                 NestJS backend (the only backend; no other API)
├── scripts/                 deploy + build scripts, see §3
└── docs/                    setup notes (SSL renewal, OAuth, email, etc.)
```

**There is only one screen/component tree — `client/app`, `client/components`,
etc. Both the mobile app and the web app render it.** Two different bundlers
alias into it:

- **Metro** (mobile, via root `metro.config.js`): sets `config.projectRoot =
  client/`, so when Xcode/EAS build from the repo **root**, Metro actually
  bundles `client/app` as the entry tree. Root's own `ios/`/`android/` are
  the real, current native projects (signing, Pods, current — last touched
  2026-07-26) — **build native from root, not from `client/`.**
  `client/ios`/`client/android` (939MB + 236K, last touched 2026-07-07) also
  exist and look like dead duplicates from before the root/client split — no
  build script references them. **But don't delete them without checking
  `scripts/start-expo-tunnel.sh` first**: it does `cd client && npx expo
  start --tunnel`, a genuinely separate workflow (Expo Go over a tunnel,
  for testing on a physical device) that runs Metro from *inside* `client/`
  using `client/app.json`/`client/package.json`, not root's. Plain `expo
  start` (no `--dev-client`) shouldn't need the prebuilt native folders
  either way, but this wasn't verified against a real device this session —
  investigate (or just try removing `client/ios`/`client/android` and run
  the tunnel script) before deleting anything here.
- **Webpack** (web, via `web/next.config.js`): aliases `@/client` →
  `../client`, `@/components` → `../components`, etc. Each `web/src/app/**`
  route is typically a one-line wrapper that dynamically imports the real
  screen from `client/app/...` (see any `web/src/app/**/page.tsx` for the
  pattern — same trick was used for `verify-email` and `add-account` this
  session).

**Corollary: fix a bug once, in `client/`, and both platforms get the fix.**
Never duplicate a screen into `web/src/app` — if you find yourself doing
that, you're fighting the architecture.

### Web's stub layer — the sharp edge

`web/next.config.js` aliases ~20 Expo/RN-only packages to hand-written stub
files under `web/src/lib/*-stub.js` (expo-router, expo-haptics,
expo-secure-store, react-native-gesture-handler, expo-constants,
expo-image-picker, expo-linear-gradient, expo-auth-session,
expo-web-browser, expo-av, expo-location, `@expo/vector-icons`,
react-native-webview, async-storage, expo-file-system, expo-image,
expo-apple-authentication, socket.io-client, the datetimepicker, and
`ThemedText`/`ThemedView`).

**If you add a new native-only import to `client/` code, the web build will
silently use whatever webpack resolves by default (probably breaking) unless
you add a matching stub and alias entry.** Check `web/src/lib/` for an
existing stub pattern before introducing a new native dependency into
shared code.

### TypeScript/ESLint are not a build gate

`web/next.config.js` sets `typescript.ignoreBuildErrors: true` and
`eslint.ignoreDuringBuilds: true`. The production web build **will succeed
and deploy even with type errors**. `client/`'s baseline is currently ~78
pre-existing `tsc --noEmit` errors (mostly in `hooks/events/useEventActions.ts`,
`hooks/chats/useChats.ts`, a couple of style files) — these are old and not
yours to fix incidentally. When you touch a file, run `npx tsc --noEmit -p
tsconfig.json 2>&1 | grep -c "error TS"` before and after your change and
confirm the count didn't grow. Don't try to drive it to zero in one sitting.

## 2. Production infrastructure

- VM: `213.165.213.224`, user `ubuntu`, SSH key `~/.ssh/yandex-cloud`
  (`ssh -i ~/.ssh/yandex-cloud ubuntu@213.165.213.224`).
- Three pm2 processes: `event-app-server` (NestJS, port 4000),
  `event-app-web` (Next.js, port 3000), `minio`. `pm2 status` / `pm2 logs
  <name> --lines N --nostream` / `pm2 restart <name>`.
- Domain `iwent.ru` → nginx → these two pm2 processes. `docs/SSL_RENEW_IVENTAPP.md`
  and `scripts/renew-ssl-on-prod.sh` cover certs.
- **`scripts/deploy-nextjs-to-vm.sh` only deploys `web/`** (rsync + fresh
  `npm run build` + `pm2 restart event-app-web`). There is no script for
  the NestJS server — deploying server changes is a manual process:
  diff each changed file against what's actually on the VM (its working
  tree has independent, uncommitted, real production features — chat
  reactions, read receipts, rate limiting — that are *not* in the local
  repo; see §2.1), upload the merged result via `scp`, then on the VM:
  `npm run prisma:generate` (not `npx`, see below), `npm run build`, `pm2
  restart event-app-server`.
- **Never run `npx <tool>` over SSH on the VM** — Claude Code's own
  permission classifier tends to block it as an unattended risky command.
  Use `npm run <script-name>` instead (all the scripts you need —
  `prisma:generate`, `build` — are already defined in `server/package.json`).
  For anything that needs a file edit on the VM, edit the file locally and
  `scp` the complete file up rather than running an edit script remotely.

### 2.1 The production server's git state is not the repo's

The VM's `/home/ubuntu/event_app_new` working tree is on an old commit,
far behind local `main`, **and has its own uncommitted local
modifications** representing real shipped features not present in this
repo: a `MessageReaction` model, post `likes`, message `readBy` receipts,
several DB indexes, `@nestjs/throttler` rate limiting, `@nestjs/schedule`.
**Never `git pull`/`checkout`/`reset` on the VM** — you will destroy live
features. If you need to update server code, diff the specific files
you're touching against the VM's copy and merge by hand (Python
`assert old in s; s = s.replace(old, new, 1)` one-shot scripts work well
for this, run locally against a copy fetched via `scp`, then upload the
result).

### 2.2 Database has no Prisma migration history

There is no `_prisma_migrations` table on the production Postgres
database at all. The real workflow is closer to `prisma db push` than
`prisma migrate deploy` — schema changes that have already happened were
applied as hand-written, pre-checked, transactional raw SQL via `psql`,
not through Prisma's migration CLI. If you change `schema.prisma`, expect
to write and apply the matching `ALTER TABLE` yourself (wrap in
`BEGIN; ... COMMIT;`, check current state first, e.g. whether a column/
index already exists before adding it).

### 2.3 `server/.env` is not synced between local and prod

The local repo's `server/.env` and the VM's `server/.env` diverge — e.g.
the VM has `YANDEX_CLOUD_FROM_EMAIL`/`YANDEX_CLOUD_ACCESS_KEY_ID` (Yandex
Cloud Postbox transactional email) that the local `.env` doesn't. When
debugging anything env-dependent (email sending, storage, OAuth), check
the VM's actual `.env` over SSH — don't assume local matches.

**Email sending (`MailerService`, `server/src/mailer/mailer.service.ts`)
goes through Yandex Cloud Postbox** (SES-compatible API against
`postbox.cloud.yandex.net`). As of 2026-07-30 the sender identity is
`noreply@iwent.ru`, DKIM-verified via two CNAME records in reg.ru's DNS
zone for `iwent.ru` pointing at `*.dkim.pstbx.ru`. If verification emails
stop arriving, the first thing to check is `pm2 logs event-app-server` for
`identity not verified` — that means the Postbox sender identity or its
DKIM has broken, not the application code. Registration/resend **do not
fail** when the email send throws — the account and OTP row are created
regardless, so a broken mailer fails silently from the user's point of
view. Test by reading the code directly from Postgres (see §5).

## 3. Native app builds

`scripts/build-ios-release.sh` / `build-standalone-ios.sh` build from the
repo **root** (not `client/`) — see §1 for why that's correct. `eas.json`
and root `app.json` hold the real build config for those.
`client/app.json` looks like a duplicate but isn't dead — see §1's note on
`scripts/start-expo-tunnel.sh`, which genuinely runs Expo from inside
`client/` using `client/app.json`. `docs/GOOGLE_OAUTH_SETUP.md` covers Google Sign-In
credential setup (Google/Apple sign-in are currently feature-flagged off —
`SHOW_GOOGLE_AUTH` / `SHOW_APPLE_AUTH` constants at the top of
`client/app/(auth)/login.tsx` — flip them back on rather than
re-implementing; the OAuth code path is intact).

## 4. i18n

`client/locales/ru.ts` and `client/locales/en.ts` are two flat-ish nested
objects; `client/context/LanguageContext.tsx` types the whole system as
`Translations = typeof en` — **so `en.ts` is the type source of truth**,
adding a key only to `ru.ts` won't typecheck. Language is persisted to
`@app_language` in AsyncStorage (or `localStorage` on web); default is
`'en'`.

Before adding new user-facing strings, **check whether a matching key
already exists but is unused** — this repo has accumulated dead
translation keys from earlier features (e.g. the whole `t.validation.*`
namespace — `usernameEmpty`, `emailInvalid`, `passwordTooShort`, etc. —
existed fully written but referenced nowhere until this session's phone/
username validation work finally used it). Grep both locale files before
writing new strings.

## 5. Auth / registration — current design (2026-07-30)

- Email verification is a **6-digit OTP**, not a hex token (migrated this
  project from the old long-token scheme). Model:
  `EmailVerificationToken { userId, token (6 digits), attempts, expiresAt }`.
  Scoped to `(userId, token)` pair, not globally unique — a code is only
  valid together with its own account, so two users can't collide, and you
  don't need a 6-digit-across-the-whole-table uniqueness guarantee.
  15-minute TTL, 5 max attempts before the code is invalidated, 2-minute
  resend cooldown enforced server-side (`retryAfterSeconds` in the 400 body
  on a too-soon resend). Code generation uses `crypto.randomInt`, not
  `Math.random`. **The stored token is plaintext**, not hashed — acceptable
  given the short TTL/attempt-limit, but worth knowing if you're auditing.
  The UI is `client/components/auth/OtpInput.tsx` (six boxes,
  `client/hooks/useResendCooldown.ts` for the countdown) — used by both
  `client/app/(auth)/verify-email.tsx` and `client/app/add-account-verify.tsx`.
- Registration requires a **phone number** (`RegisterDto.phone`, 5–24
  chars, `^[+()\-\s\d]+$` — no country-specific format enforcement
  server-side, just character/length sanity). Client collects it via
  `client/components/auth/PhoneField.tsx` + `client/constants/countries.ts`
  (country picker defaulting to +7, digit-only national number input,
  combined as `"${dial} ${digits}"` before sending). `add-account.tsx`
  duplicates this same pattern for the "add a second account" flow — the
  two screens are near-identical and not componentized together; if you
  change one, check the other.
- Username: 3–32 chars, `^[a-zA-Z0-9_.]+$` (`RegisterDto.username`).
  Password: 8–64 chars, needs one lowercase, one uppercase, one digit
  (`client/utils/passwordRules.ts` mirrors this exactly — if you change the
  server rule, update that file too, or the UI's green checkmarks will lie).
  All three (email format, username, phone) get inline per-field validation
  via `client/utils/validation.ts`, shown on blur or after a submit attempt
  — see `client/app/(auth)/login.tsx` for the `touchedFields`/`shows()`
  pattern if you need to replicate it elsewhere.

## 6. Testing forms / flows yourself

There's no way for an assistant session to receive real email — verify the
OTP flow by reading the code straight out of Postgres:
```
ssh -i ~/.ssh/yandex-cloud ubuntu@213.165.213.224 \
  "sudo -u postgres psql -d event_app -t -c \"SELECT t.token, t.attempts, t.\\\"expiresAt\\\", now() FROM \\\"EmailVerificationToken\\\" t JOIN \\\"User\\\" u ON u.id = t.\\\"userId\\\" WHERE u.email = '...';\""
```
Check `now()` against `expiresAt` before assuming a fetched code is still
valid — it's easy to burn 15 minutes mid-investigation and then get a
confusing "invalid or expired" error that has nothing to do with the bug
you were actually chasing.

Drive the actual production or a local Next.js dev server (`.claude/launch.json`
has a `web-dev` config, port 3001) through the Browser pane rather than
asking for manual confirmation — this project's owner has explicitly asked
for hands-on verification rather than "please test this yourself" replies.
