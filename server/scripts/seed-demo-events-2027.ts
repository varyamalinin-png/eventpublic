/**
 * Создаёт демо-события (даты в 2027) от имени всех пользователей в БД.
 *
 * Запуск из каталога server/ (нужен .env с DATABASE_URL):
 *   npx ts-node scripts/seed-demo-events-2027.ts
 *   npx ts-node scripts/seed-demo-events-2027.ts --yes   # без интерактивного подтверждения
 *
 * Переменные окружения:
 *   SEED_EVENTS_PER_USER=5   — сколько событий на пользователя (по умолчанию 5)
 */

import { PrismaClient, EventRole, MembershipStatus } from '@prisma/client';
import { demoCoverUrls } from './demo-event-cover-urls';

const prisma = new PrismaClient();

const EVENTS_PER_USER = Math.max(
  1,
  Math.min(20, parseInt(process.env.SEED_EVENTS_PER_USER || '5', 10) || 5),
);

/** Заголовки из ТЗ (порядок сохранён). */
const TITLES: string[] = [
  'сходить в музей востока',
  'обсудить башара асада',
  'поход в военкомат печатники',
  'посидеть со скуфами',
  'вместе помыть машину',
  'закрытые блошиные рынки',
  'сводить трек по зуму',
  'хочу с кем-то создать форум',
  'авто забег по мкаду фанатов хонды цивик',
  'похавать в додо пицца',
  'сходить в тир',
  'починить мебель',
  'сходить в зал',
  'вместе записаться на борьбу',
  'сходить в поликлинику',
  'пройти майнкрафт',
  'сходить в компы',
  'сгонять в чайную',
  'сходить в библиотеку со знающим типом',
  'поспорить о независимости кавказа',
  'съездить в кратово',
  'поиграть во дворе в волейбол',
  'маршрут москва — троице-сергиева лавра пешком с ночёвкой',
  'придумать маршрут и проехать на велосипедах',
  'вечер настольных игр',
  'обход всех секондов столичный гардероб в центре',
  'поехать на калязинскую радиоастрономическую обсерваторию',
  'сплав на байдарках',
  'пойти в лазертаг',
  'посмотреть по зуму фильм и обсудить',
  'поехать в приют погулять с собаками',
  'покататься на лошадях',
  'поехать на целый день в любой маленький город и обойти его полностью',
  'йога в парке, потом пикник',
  'пойти на детективный хоррор квест',
  'в перерыве между парами встретиться на обед',
  'пойти на лекцию по совершенно новой теме',
  'провести день посещая места где первое посещение бесплатно',
  'турнир по настольному теннису',
  'сходить подряд на йогу + массаж + в баню',
  'пойти на экскурсию на завод',
  'записать совместный подкаст или голосовое интервью',
  'сходить на птичий рынок просто посмотреть',
  'пожарить шашлык на заброшенной даче',
  'пройтись по всем кофейням одной улицы и сравнить американо',
  'поиграть в дворовой баскетбол у любой школы',
  'съездить на рыбалку без снастей — просто посидеть у воды',
  'найти в ближайшем лесу самое старое дерево',
  'сходить на бесплатную репетицию студенческого театра',
  'обойти все дворы района и найти самый странный арт-объект',
];

const MOSCOW_SPOTS = [
  { name: 'Москва, ул. Рождественка, 3', lat: 55.7558, lon: 37.6176 },
  { name: 'Москва, Патриаршие пруды', lat: 55.7639, lon: 37.5922 },
  { name: 'Москва, ВДНХ', lat: 55.8294, lon: 37.6387 },
  { name: 'Москва, Парк Горького', lat: 55.7312, lon: 37.6013 },
  { name: 'Москва, Красная площадь', lat: 55.7539, lon: 37.6208 },
  { name: 'Москва, Третьяковская набережная', lat: 55.7417, lon: 37.6056 },
  { name: 'Москва, Бауманская', lat: 55.7726, lon: 37.6784 },
  { name: 'Москва, Сокольники', lat: 55.7932, lon: 37.6765 },
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function rnd(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function isOnlineTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes('зум') ||
    t.includes('zoom') ||
    t.includes('форум') ||
    t.includes('майнкрафт') ||
    t.includes('компы') ||
    t.includes('подкаст') ||
    t.includes('голосовое интервью') ||
    t.includes('фильм и обсудить')
  );
}

function pickPrice(title: string, r: () => number): string | null {
  const t = title.toLowerCase();
  if (isOnlineTitle(title) && r() > 0.4) return 'Бесплатно';
  if (t.includes('музей')) return `${400 + Math.floor(r() * 200)} ₽`;
  if (t.includes('додо')) return `от ${500 + Math.floor(r() * 300)} ₽`;
  if (t.includes('тир') || t.includes('лазертаг') || t.includes('квест'))
    return `${800 + Math.floor(r() * 700)} ₽`;
  if (t.includes('зал') || t.includes('йога') || t.includes('борьбу'))
    return `${600 + Math.floor(r() * 400)} ₽`;
  if (t.includes('байдарк') || t.includes('лошад')) return `${2000 + Math.floor(r() * 1500)} ₽`;
  if (t.includes('обсерватор')) return `от ${1500 + Math.floor(r() * 1000)} ₽`;
  if (t.includes('экскурсию на завод')) return `${1200 + Math.floor(r() * 800)} ₽`;
  if (r() > 0.55) return 'Бесплатно';
  if (r() > 0.35) return `от ${300 + Math.floor(r() * 500)} ₽`;
  return null;
}

function describeEvent(title: string): string {
  const t = title.toLowerCase();
  if (isOnlineTitle(title))
    return 'Онлайн-формат: договоримся о времени в чате. Нужны наушники и стабильный интернет.';
  if (t.includes('пешком') || t.includes('маршрут'))
    return 'Ищу компанию на спокойный темп, ночёвка по договорённости. Соберём снарягу списком.';
  if (t.includes('приют') || t.includes('собак'))
    return 'Погуляем с теми, кому нужна социализация. Одежда по погоде, без резких движений у собак.';
  if (t.includes('музей'))
    return 'Билеты можно взять на входе или заранее. Можем аудиогид или просто идти вместе.';
  if (t.includes('йога') && t.includes('пикник'))
    return 'Коврик с собой, еда на шаринг. Точку в парке скидываю за день.';
  return 'Напишите в чате события, чем удобно заняться и есть ли ограничения по времени. Без давления — если не зайдёт, можно отмениться.';
}

/** Локальная дата/время в 2027 (часовой пояс — сервер). */
function startLocal2027(seed: number, r: () => number): { start: Date; end: Date } {
  const month = 1 + (seed % 12);
  const day = 1 + (Math.floor(seed / 12) % 28);
  const h = 11 + Math.floor(r() * 7);
  const m = [0, 30][Math.floor(r() * 2)];
  const start = new Date(2027, month - 1, day, h, m, 0, 0);
  const durH = 2 + Math.floor(r() * 4);
  const end = new Date(start.getTime() + durH * 3600 * 1000);
  return { start, end };
}

async function main() {
  const yes = process.argv.includes('--yes');
  if (!yes) {
    console.log(
      `Создаст до ${EVENTS_PER_USER} событий на каждого пользователя (не заблокированных), всего до ${TITLES.length} уникальных тем.`,
    );
    console.log('Запустите с флагом --yes для выполнения.');
    process.exit(0);
  }

  const users = await prisma.user.findMany({
    where: { isBlocked: false },
    select: { id: true, username: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    console.error('Нет пользователей в БД.');
    process.exit(1);
  }

  console.log(`Пользователей: ${users.length}, событий на каждого: ${EVENTS_PER_USER}`);

  let titleCursor = 0;
  let globalIdx = 0;
  let created = 0;

  for (const user of users) {
    const r = rnd(hashSeed(user.id));
    for (let k = 0; k < EVENTS_PER_USER; k++) {
      const title = TITLES[titleCursor % TITLES.length];
      titleCursor += 1;
      globalIdx += 1;

      const online = isOnlineTitle(title);
      const spot = MOSCOW_SPOTS[Math.floor(r() * MOSCOW_SPOTS.length)]!;
      const { start, end } = startLocal2027(globalIdx + hashSeed(user.id), r);
      const maxP = 3 + Math.floor(r() * 8);
      const price = pickPrice(title, r);

      const otherIds = users
        .map((u) => u.id)
        .filter((id) => id !== user.id)
        .sort(() => r() - 0.5);
      const addParticipants = r() > 0.45;
      const extraCount = addParticipants ? 1 + Math.floor(r() * Math.min(3, otherIds.length, maxP - 2)) : 0;
      const picked = otherIds.slice(0, extraCount);

      const { mediaUrl, originalMediaUrl } = demoCoverUrls(`${user.id}-${globalIdx}`);

      const event = await prisma.event.create({
        data: {
          organizerId: user.id,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: describeEvent(title),
          startTime: start,
          endTime: end,
          location: online ? 'Онлайн' : spot.name,
          latitude: online ? null : spot.lat + (r() - 0.5) * 0.04,
          longitude: online ? null : spot.lon + (r() - 0.5) * 0.04,
          mediaUrl,
          originalMediaUrl,
          mediaType: 'image',
          mediaAspectRatio: 16 / 9,
          maxParticipants: maxP,
          price,
          isRecurring: false,
          isMassEvent: false,
          autoTags: [],
          customTags: ['демо', '2027'],
          memberships: {
            create: [
              {
                userId: user.id,
                role: EventRole.ORGANIZER,
                status: MembershipStatus.ACCEPTED,
              },
              ...picked.map((uid) => ({
                userId: uid,
                role: EventRole.PARTICIPANT,
                status: MembershipStatus.ACCEPTED,
                invitedBy: user.id,
              })),
            ],
          },
        },
      });

      created += 1;
      console.log(`+ ${event.id.slice(0, 8)}… «${event.title}» — ${user.username || user.name || user.id}`);
    }
  }

  console.log(`\nГотово. Создано событий: ${created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
