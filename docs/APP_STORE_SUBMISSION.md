# Отгрузка в App Store — от архива до «Waiting for Review»

Инструкция под конкретное состояние проекта: приложение только для iPhone,
bundle ID `com.varyamalinina.iwent`, Team ID `54NZBKX94C`. На проверке —
**1.0.0 (3)** от 07.09.2026; следующая сборка — **1.0.1 (4)** от 11.09.2026
(почему 1.0.1 — в разделе «Версия или только номер сборки» ниже).

Сборка 2 уже загружена в App Store Connect и лежит там со статусом «Готово
к отправке». **Повторно загрузить архив с тем же номером нельзя** — App Store
Connect требует номер строго выше предыдущего. Поэтому каждая новая сборка =
+1 к `CFBundleVersion` (версия `1.0.0` при этом не меняется). Отправлять на
модерацию можно любую из загруженных, но смысл имеет только последняя.

Порядок такой: сначала заливаем сборку из Xcode, пока она обрабатывается —
заполняем карточку в App Store Connect, потом привязываем сборку и
отправляем. Обработка сборки занимает от пары минут до часа, поэтому
заливать лучше первым делом.

---

## Шаг 1. Залить сборку

Только через **Xcode**. Через терминал не получится: `xcodebuild
-exportArchive` отвечает `No Accounts` даже когда Apple ID добавлен в
Xcode — сессия аккаунта командной строке не видна. (Для отгрузки из
терминала нужен отдельный API-ключ App Store Connect, заводить его ради
одной кнопки смысла нет.)

1. **Xcode → Window → Organizer** (⌥⌘⇧O), вкладка **Archives**.
2. Выбрать архив с именем **iwent** — это всегда последний. Остальные
   переименованы («устаревший», «не грузить», «уже загружен»), чтобы не
   перепутать: они собраны до последних правок.
3. **Distribute App** → **App Store Connect** → **Upload** → Next.
4. Подписывание оставить автоматическим («Automatically manage signing»).
   Xcode сам выпустит дистрибутивный профиль с Push Notifications и
   Associated Domains.
5. **Upload**. Дождаться «Upload Successful».

Через несколько минут придёт письмо от Apple, что сборка обработана. Если
вместо этого придёт письмо об ошибке — текст в нём конкретный, покажи мне.

**Проверка, что долетело:** appstoreconnect.apple.com → **My Apps** → iwent →
вкладка **TestFlight**. Там должна появиться строка **1.0.0 (2)**. Пока
статус «Processing» — дальше идти можно, но привязать сборку к версии не
получится.

---

## Шаг 2. Заполнить карточку приложения

App Store Connect → **My Apps** → **iwent** → в левой колонке раздел
**iOS App 1.0.0** (если его нет — синий **+ Version or Platform**).

### 2.1 Информация о версии

| поле | что писать |
|---|---|
| **Promotional Text** | 170 символов, меняется без ревью. Можно оставить пустым. |
| **Description** | Главный текст. Что за приложение, что человек в нём делает. Без обещаний функций, которых нет, и без упоминания других платформ. |
| **Keywords** | 100 символов, через запятую **без пробелов**: `события,друзья,встречи,афиша,мероприятия`. Слова из названия дублировать не нужно. |
| **Support URL** | `https://iwent.ru` |
| **Marketing URL** | необязательно, можно тот же |
| **Version** | `1.0.0` |
| **Copyright** | `2026 <имя правообладателя>` |

### 2.2 Скриншоты

Обязателен **только один размер — 6.9″**: 1320 × 2868 (подойдут также
1290 × 2796 или 1260 × 2736), вертикально. Один набор в этом размере App
Store Connect сам масштабирует на все остальные айфоны вплоть до SE. Нужно
от 3 до 10 штук. Планшетные не нужны — приложение только для iPhone.

Снять можно прямо в симуляторе iPhone 17 Pro Max (⌘S сохраняет скриншот на
рабочий стол). Показать стоит: ленту событий, карточку события, профиль,
создание события, чат.

⚠️ Скриншоты должны показывать **реальные экраны приложения**. Коллажи с
рекламными надписями поверх Apple пропускает, а вот несуществующие экраны и
чужие логотипы — повод для отказа.

### 2.3 App Review Information

Самый важный блок — это то, что читает живой человек.

- **Sign-in required** — поставить галочку.
- **User name:** `appreview@iwent.ru`
- **Password:** `AppReview2026`
- **Contact info** — имя, фамилия, телефон и почта, куда писать вопросы
  (лучше свою настоящую, отвечать придётся быстро).
- **Notes** — сюда стоит написать по-английски примерно следующее:

```
iWent is a social app for finding and joining local events.

Test account: appreview@iwent.ru / AppReview2026
The account already has friends, events and past-event memories,
so the feed and profile are not empty.

User-generated content safeguards (Guideline 1.2):
- Report: three-dot menu on any event card or user profile.
- Block: three-dot menu in a user profile. A blocked user disappears
  from feeds, search and requests, and cannot send messages.
  The list of blocked users is in Settings - Blocked users.
- Moderation: reports are reviewed by our team; abusive content is removed.

Account deletion is available in the app: Settings - Delete account.
```

### 2.4 Возрастной рейтинг (Age Rating)

Раздел **General Information → Age Rating → Edit**. Отвечать честно:

- **User-Generated Content** — да, приложение содержит пользовательский
  контент. Дальше Apple спросит про механизмы защиты — у нас есть все три:
  жалобы, блокировка и модерация.
- **Unrestricted Web Access** — **нет**. Встроенный браузер в приложении
  один и открывает только карту для выбора точки.
- Алкоголь, азартные игры, насилие, ужасы — нет.

Скорее всего получится **12+**.

### 2.5 App Privacy — анкета о данных

**App Privacy → Edit**. Заполняем по факту кода:

| раздел | ответ |
|---|---|
| **Contact Info** | Email, Phone Number, Name — собираются, **связаны с личностью**, цель — App Functionality |
| **User Content** | Photos or Videos + Other User Content (события, посты, сообщения) — связаны с личностью, App Functionality |
| **Identifiers** | User ID — связан с личностью, App Functionality |
| **Location** | **не собирается** — геопозиция нужна только чтобы центрировать карту на устройстве, на сервер не уходит |
| **Data Used to Track You** | **ничего**. Ни аналитики, ни рекламных SDK в проекте нет |

На вопрос «Do you or your third-party partners use data for tracking?» —
**No**. Поэтому и системного запроса на отслеживание в приложении нет, и
быть не должно.

### 2.6 Экспортное соответствие

Не спросят: в `Info.plist` уже стоит `ITSAppUsesNonExemptEncryption = false`.
Приложение использует только HTTPS, это стандартное исключение.

### 2.7 Что заполнять не нужно

- **Sign in with Apple** — требуется только тем, у кого есть вход через
  сторонние сервисы. У нас вход по почте и паролю, Google и Apple
  выключены флагами, так что правило 4.8 к нам не относится.
- **In-App Purchases** — покупок нет.
- **Game Center, iPad-скриншоты** — не наш случай.

---

## Шаг 3. Привязать сборку и отправить

1. В разделе **iOS App 1.0.0** прокрутить до **Build** → **+** → выбрать
   последнюю загруженную сборку. (Пункт появится, только когда обработка
   закончилась.)
2. **Version Release** — «Automatically release this version» (выйдет сразу
   после одобрения) или «Manually release» (выйдет по кнопке — удобнее,
   если хочется выбрать день).
3. **Save**, затем **Add for Review** → **Submit to App Review**.

Статус сменится на **Waiting for Review**. Дальше: «In Review» обычно через
несколько часов — сутки, решение чаще всего в течение суток после этого.

---

## Если проверка затянулась

Статус «Ожидание проверки» (Waiting for Review) значит, что очередь до сборки
ещё не дошла и проверка не начиналась. Дольше двух-трёх дней — уже не норма:
Apple проверяет около 90% сборок за сутки. Здесь так вышло дважды: первая
отправка (версия 1.0, сборка 3) провисела неделю, повторная (сборка 5,
отправлена 16.09.2026) — к 18.09.2026 двое суток.

Что проверить, прежде чем писать:

1. **Resolution Center** в карточке приложения и почту Apple ID, включая спам.
   Вопрос проверяющего останавливает проверку молча: снаружи это выглядит
   ровно как «всё ещё ждём».
2. **Agreements, Tax, and Banking** — плашка «Pending Agreements». Непринятое
   соглашение не пускает версию в очередь.
3. **Демо-аккаунт должен пускать в приложение.** Быстрая проверка боевого
   сервера (пароль берётся из этого же файла, в команду не вписывается):

   ```bash
   EMAIL=$(grep -m1 'User name:' docs/APP_STORE_SUBMISSION.md | grep -o '[a-z]*@iwent\.ru')
   PASS=$(grep -m1 'Password:' docs/APP_STORE_SUBMISSION.md | sed 's/.*`\(.*\)`.*/\1/')
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://iwent.ru/api/auth/login \
     -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
   ```

   201 — вход работает. Проверялось 14.09.2026 (10 друзей, 105 видимых
   событий) и 18.09.2026 — оба раза вход есть, то есть «не смогли войти»
   причиной быть не может.

Если всё чисто — писать в Apple: App Store Connect, внизу страницы
**«Контакты» (Contact Us) → App Review → статус проверки** (или
developer.apple.com/contact/app-store). Указать название, **Apple ID
приложения** (числовой, в App Information), версию, номер сборки и дату
отправки. Текст:

```
Hello,

Our first submission of i.went (Apple ID 6794462880), version 1.0, build 3,
has been in "Waiting for Review" since <дата> — about a week now. We have
received no messages in Resolution Center and no request for additional
information, and all agreements are accepted.

Could you please check the status of this submission and let us know if
anything is needed from us? The demo account provided in App Review
Information (appreview@iwent.ru) is active — we verified today that it signs
in and shows content.

Thank you.
```

Для **повторной** отправки после отказа текст другой — важно сказать, что
сборка исправляет их же замечание, и что ответ в Resolution Center оставлен
(отправлено 18.09.2026 по сборке 5):

```
Hello,

Our app i.went (Apple ID 6794462880, bundle ID com.varyamalinina.iwent) is
waiting for review again.

Version 1.0, build 5, was submitted on 16 September 2026 and has been in
"Waiting for Review" since then (submission ID
ee1c4f25-6c2e-4a79-9513-75319e33cf91). This build addresses the single issue
raised in your previous review under Guideline 5.1.1(v): the phone number is
no longer required to create an account. We replied in Resolution Center on
the same day describing the change.

The previous submission of this version also stayed in "Waiting for Review"
for about a week before it was reviewed, so we would like to ask whether
anything is needed from us or the submission is simply in the queue. We have
received no messages in Resolution Center, all agreements are accepted, and
the demo account provided in App Review Information (appreview@iwent.ru) is
active — we verified today that it signs in and shows content.

Thank you.
```

**Не снимать версию с проверки и не отправлять заново «чтобы подтолкнуть»** —
она уйдёт в конец очереди. Expedited Review (отдельная форма,
`?topic=expedite`) — только для срочных случаев вроде поломки у пользователей
или привязки к дате; её удовлетворяют редко, и тратить её на ожидание в
очереди не стоит.

## Если пришёл отказ

Придёт письмо и сообщение в **Resolution Center** внутри App Store Connect —
там будет номер правила и, как правило, скриншот. Отвечать нужно там же.

Что чаще всего просят у приложений с пользовательским контентом и что у нас
уже сделано:

- **1.2 Safety — User-Generated Content:** жалобы, блокировка, модерация —
  всё есть, в заметках для ревьюера это расписано.
- **5.1.1(v) Account Deletion:** удаление аккаунта прямо в приложении, в
  настройках. Есть.
- **2.1 App Completeness:** пустых заглушек и кнопок «в разработке» в
  интерфейсе не осталось, они скрыты флагами.
- **2.3.3 Screenshots:** скриншоты должны быть с реальных экранов.
- **4.0 Design:** приложение только для iPhone, планшетной вёрстки от нас
  не ждут.

Исправление, не требующее новой сборки (текст, скриншоты, ответы в анкете),
делается прямо в карточке и отправляется заново.

### Версия или только номер сборки

- Пока версия **не одобрена**, новой сборке достаточно поднять **номер
  сборки** (`CFBundleVersion` в `ios/iwent/Info.plist` и `ios.buildNumber` в
  `app.json`). Номер самой версии в карточке тоже можно исправить — после того
  как версию сняли с проверки или её отклонили.
- После **одобрения** версия закрыта: сборку с тем же номером версии
  (`CFBundleShortVersionString` в Info.plist и `version` в app.json) App Store
  Connect больше не примет. Для обновления поднимаем версию.

Сборка 4 была собрана как 1.0.1 на случай одобрения 1.0.0. Версию отклонили,
поэтому трейн 1.0 остался открытым и сборка 4 не понадобилась: **сборка 5 —
это снова 1.0.0**, она идёт в ту же карточку версии 1.0.

### Отказ 15 сентября 2026: 5.1.1(v), телефон при регистрации

Причина: **нельзя требовать данные, без которых приложение работает**. Телефон
мы не подтверждали и никуда не отправляли — значит, требовать его нельзя.
Само поле убирать не нужно, достаточно сделать необязательным.

Что изменено в сборке 5 (сервер уже на проде, 16 сентября):

- телефон необязателен и на сервере, и в форме; пустое поле больше не ошибка;
- под полем всегда видна подпись «Телефон (необязательно)» — именно её
  ревьюер и увидит на том же экране, где был отказ;
- начатый, но слишком короткий номер по-прежнему не примут.

Порядок пересдачи:

1. Organizer → **Distribute App** → App Store Connect → загрузить сборку
   **1.0.0 (5)**. Подождать, пока она перестанет быть «Processing».
2. В карточке версии **1.0** (она снова редактируется) → раздел Build → «+» →
   выбрать сборку 5.
3. **Resolution Center** → ответить на сообщение Apple (текст ниже) →
   **Add for Review** / Submit for Review.

Текст ответа в Resolution Center (по-английски, отвечать нужно там же, где
пришёл отказ):

> Thank you for the review.
>
> The phone number is no longer required to create an account. In the new
> build the field is optional: the sign-up form shows it as "Phone
> (optional)", the app no longer blocks registration when it is empty, and
> the server accepts and creates accounts without a phone number. No other
> personal information is required beyond the email address, username and
> password needed to create and sign in to the account.
>
> This is fixed in build 5 of version 1.0, attached to this submission.

Демо-аккаунт и заметки для ревьюера менять не нужно — они остались прежними.

---

## Что должно быть сделано ДО отправки

- [x] Ключ APNs создан и прописан на сервере — пуши работают
- [x] Почта на домене: `support@`, `moderation@`, `appeal@`, `privacy@`
      принимают письма
- [x] Ключи заменены: JWT, Yandex Cloud; Google убран с сервера
- [x] База вычищена, тестовых аккаунтов нет, у событий есть участники и фото
- [x] Демо-аккаунт `appreview` живой, с друзьями и событиями
- [x] Блокировка, жалобы, модерация, удаление аккаунта — на месте
- [x] Разрешения по-английски, микрофон убран, только iPhone
- [x] OAuth-клиент в Google Cloud удалён, алиас `dpo@` добавлен
- [ ] Удалить в Яндекс Облаке старый ключ `YCAJEiJUyrG7g6cxRIF6pITKd` и
      сервисные аккаунты `email-api-sender`, `vsmalininaeduhseru`
      (не блокирует отправку, но лучше до релиза)
- [ ] Проверить последнюю сборку на телефоне: выход из аккаунта, три точки
      после отмены участия, сброс пароля, пуш, свайп карточки в ленте
