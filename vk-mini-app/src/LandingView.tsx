import {
  PRIVACY_POLICY_URL,
  TELEGRAM_URL,
  VK_COMMUNITY_URL,
} from './env';

const TICKER = [
  '📍 погулять с собакой',
  '🎬 сходить в кино',
  '🎵 на концерт',
  '☕ выпить кофе',
  '🏃 пробежка',
  '🎨 на выставку',
  '🎮 поиграть в кс',
  '🛍 на шопинг',
];

type Props = {
  userLabel: string;
  onOpenSite: () => void;
  onOpenUrl: (url: string) => void;
  onAllowMessages: () => void;
  allowStatus: string;
  siteHint: string;
};

export function LandingView({
  userLabel,
  onOpenSite,
  onOpenUrl,
  onAllowMessages,
  allowStatus,
  siteHint,
}: Props) {
  const tickerItems = [...TICKER, ...TICKER];
  const WORDMARK_SRC = `${import.meta.env.BASE_URL}auth-wordmark.png`;

  return (
    <div className="vk-landing">
      <div className="hero-full">
        <div className="hero">
          <div className="hero-top">
            <img className="hero-wordmark" src={WORDMARK_SRC} alt="iwent" />
          </div>
          <div className="hero-tag">скоро запуск · бета</div>
          <div className="hero-headline">
            Найди, с кем
            <br />
            разделить <em>момент</em>
          </div>
          <div className="hero-sub">
            Приложение для тех, кто хочет что-то сделать — но не в одиночку.
            Любое событие, любой масштаб.
          </div>
          {userLabel ? <div className="hero-user">Привет, {userLabel}</div> : null}
        </div>
      </div>

      <div className="ticker-wrap">
        <div className="ticker">
          {tickerItems.map((t, i) => (
            <span key={`${t}-${i}`} className="ticker-item">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="page-narrow">
        <div className="section">
          <div className="card">
            <div className="card-label">Ранний доступ</div>
            <div className="card-title">Попади в первую волну беты</div>
            <div className="card-desc">
              Оставь заявку — и окажешься среди первых, кто попробует iwent.
              Ждём тебя на сайте.
            </div>
            <button type="button" className="btn-primary" onClick={onOpenSite}>
              Попасть в бету →
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenSite}>
              Узнать больше
            </button>
          </div>
        </div>

        <div className="section">
          <div className="card">
            <div className="card-label">Как это выглядит</div>
            <div className="card-title">Листай события — как TikTok</div>
            <div className="card-desc">
              Алгоритм подбирает события под твои интересы. Нашёл — присоединяйся.
            </div>
            <div className="feed-preview">
              <div className="feed-item">
                <div className="feed-ava" style={{ background: '#fff0f0' }}>
                  🐕
                </div>
                <div className="feed-body">
                  <div className="feed-title">Погулять с собакой в Сокольниках</div>
                  <div className="feed-sub">сегодня в 18:00 · 1 из 3 мест</div>
                </div>
                <button type="button" className="feed-join" onClick={onOpenSite}>
                  Войти
                </button>
              </div>
              <div className="feed-item">
                <div className="feed-ava" style={{ background: '#f0f0ff' }}>
                  🎬
                </div>
                <div className="feed-body">
                  <div className="feed-title">На «Гражданина Кейна» в Мире искусств</div>
                  <div className="feed-sub">завтра в 20:15 · 2 из 2 мест</div>
                </div>
                <button type="button" className="feed-join" onClick={onOpenSite}>
                  Войти
                </button>
              </div>
              <div className="feed-item">
                <div className="feed-ava" style={{ background: '#f0fff4' }}>
                  🎸
                </div>
                <div className="feed-body">
                  <div className="feed-title">Запись на студии — ищу вокалиста</div>
                  <div className="feed-sub">в эти выходные · 1 место</div>
                </div>
                <button type="button" className="feed-join" onClick={onOpenSite}>
                  Войти
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card">
            <div className="card-label">Как это работает</div>
            <div className="card-title">Три шага до события</div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-text">
                  <strong>Создай событие</strong> — любое. От «дойти до метро» до
                  «сгонять в Питер».
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-text">
                  <strong>Алгоритм покажет тебя</strong> подходящим людям — или ты
                  найдёшь чужое событие в ленте.
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-text">
                  <strong>Сходили — сохранили.</strong> Общий альбом события
                  остаётся в профиле у всех участников.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div
            className="card"
            style={{
              background: 'var(--black)',
              color: 'var(--white)',
            }}
          >
            <div
              className="card-label"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Зачем это
            </div>
            <div
              className="card-title"
              style={{
                color: 'var(--white)',
                fontSize: '15px',
                lineHeight: 1.4,
              }}
            >
              «Хочешь, но не с кем» — знакомое чувство?
            </div>
            <div
              className="card-desc"
              style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}
            >
              У всех бывает: друзья заняты, никто не разделяет этот интерес, стыдно
              идти одному. iwent убирает эти барьеры. Не знакомства, не нетворкинг —
              просто разделить момент.
            </div>
            <button type="button" className="btn-accent" onClick={onOpenSite}>
              Хочу попробовать
            </button>
          </div>
        </div>

        <div className="section">
          <div className="card">
            <div className="card-label">Проблема реальна</div>
            <div className="card-title">Данные говорят сами</div>
            <div className="stats">
              <div className="stat">
                <div className="stat-num">
                  59<span>%</span>
                </div>
                <div className="stat-label">
                  россиян чувствуют одиночество хотя бы иногда
                </div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  40<span>%</span>
                </div>
                <div className="stat-label">
                  хотят участвовать в объединяющих проектах
                </div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  165<span>₽</span>
                </div>
                <div className="stat-label" style={{ fontSize: 10 }}>
                  млрд — рынок офлайн-событий в 2026 году
                </div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  88<span>%</span>
                </div>
                <div className="stat-label">
                  молодёжи хотят больше времени с людьми вживую
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card">
            <div className="card-label">Подписывайся</div>
            <div className="card-title">Следи за запуском</div>
            <div className="card-desc">
              Новости, инсайты из исследований, бекстейдж разработки — всё здесь.
            </div>
            <div className="social-row">
              <button
                type="button"
                className="social-btn"
                onClick={() => onOpenUrl(TELEGRAM_URL)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="12" fill="#229ED9" />
                  <path
                    d="M17.5 7L10.5 13.5L8 11.5L5 8.5L17.5 7Z"
                    fill="white"
                    opacity="0.7"
                  />
                  <path d="M10.5 13.5L12 18L14 14.5L17.5 7L10.5 13.5Z" fill="white" />
                </svg>
                Telegram
              </button>
              <button
                type="button"
                className="social-btn"
                onClick={() => onOpenUrl(VK_COMMUNITY_URL)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect width="24" height="24" rx="6" fill="#0077FF" />
                  <path
                    d="M12.9 16.5H11.5C11.5 16.5 9 16.5 6.5 14C4.5 12 4 9 4 9H6C6 9 6.3 11.5 8.2 13.3C9.2 14.3 10 14.7 10 14.7V10.5H12V12.8C12 12.8 12.3 12.7 13 12C13.8 11.2 14 9 14 9H16C16 9 15.8 11.5 14.5 12.8C14.2 13.1 13.9 13.3 13.7 13.4C13.7 13.4 15.2 14 16.5 16.5H14.3C14.3 16.5 13.7 15 12.9 14.2C12.6 13.9 12.3 13.7 12 13.6V16.5H12.9Z"
                    fill="white"
                  />
                </svg>
                ВКонтакте
              </button>
            </div>
            <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={onOpenSite}>
              iwent.ru →
            </button>
            <button type="button" className="btn-ghost" onClick={onAllowMessages}>
              Сообщения от сообщества
            </button>
            {allowStatus ? <div className="hint">{allowStatus}</div> : null}
            {siteHint ? <div className="hint">{siteHint}</div> : null}
          </div>
        </div>

        <div className="footer">
          <div>© 2026 iwent</div>
          <div>
            <button
              type="button"
              className="linkish"
              onClick={() => onOpenUrl(PRIVACY_POLICY_URL)}
            >
              Политика конфиденциальности
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
