import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { blockedUserIds } from '../shared/blocks';

/**
 * Условие видимости события — одно на все места, где события читаются списком.
 *
 * Раньше эта логика жила прямо в EventsService.findAll, и остальные выборки её
 * не знали вовсе: рекомендации (`/events/recommended/for-user`) и поиск
 * (`/search/events`, `/search/global`) отдавали всё подряд, включая события
 * «только я» и «только друзьям», кому угодно. У `/search/events` вдобавок нет
 * авторизации, то есть увидеть их мог кто угодно вообще.
 *
 * Правила:
 *  - `all` и событие без настройки видит любой;
 *  - свои события и те, где ты уже в участниках (или приглашён), видны всегда,
 *    даже в режиме «только я» — иначе автор потерял бы собственное событие, а
 *    приглашённый не увидел бы приглашения;
 *  - `friends` — только друзьям организатора;
 *  - `all_except_friends` — всем, кроме друзей организатора;
 *  - `all_except_excluded` — всем, кроме перечисленных;
 *  - `me_and_excluded` — только перечисленным (и автору);
 *  - `only_me` — никому, кроме автора.
 *
 * Аноним не может быть ни другом, ни в списке по id, поэтому ему остаются
 * `all_except_friends` и `all_except_excluded`.
 */
export async function buildEventVisibilityWhere(
  prisma: PrismaService,
  viewerId?: string,
): Promise<any> {
  const or: any[] = [
    { visibility: { equals: Prisma.AnyNull } },
    { visibility: { path: ['type'], equals: 'all' } },
  ];

  if (!viewerId) {
    or.push({ visibility: { path: ['type'], equals: 'all_except_friends' } });
    or.push({ visibility: { path: ['type'], equals: 'all_except_excluded' } });
    return { OR: or };
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const friendIds = friendships.map(link =>
    link.requesterId === viewerId ? link.addresseeId : link.requesterId,
  );

  or.push({ organizerId: viewerId });
  or.push({ memberships: { some: { userId: viewerId } } });

  if (friendIds.length > 0) {
    or.push({
      AND: [
        { visibility: { path: ['type'], equals: 'friends' } },
        { organizerId: { in: friendIds } },
      ],
    });
  }
  or.push({
    AND: [
      { visibility: { path: ['type'], equals: 'all_except_friends' } },
      { organizerId: { notIn: [...friendIds, viewerId] } },
    ],
  });
  or.push({
    AND: [
      { visibility: { path: ['type'], equals: 'all_except_excluded' } },
      { NOT: { visibility: { path: ['excludedUsers'], array_contains: viewerId } } },
    ],
  });
  or.push({
    AND: [
      { visibility: { path: ['type'], equals: 'me_and_excluded' } },
      { visibility: { path: ['excludedUsers'], array_contains: viewerId } },
    ],
  });

  /**
   * Заблокированные исчезают из лент в обе стороны.
   *
   * Условие идёт рядом с видимостью, а не вместо неё: событие должно быть и
   * видимым по настройке, и не принадлежать тому, с кем есть блокировка.
   */
  const blocked = await blockedUserIds(prisma, viewerId);
  if (blocked.length > 0) {
    return { AND: [{ OR: or }, { organizerId: { notIn: blocked } }] };
  }

  return { OR: or };
}
