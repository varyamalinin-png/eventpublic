// Старый адрес события. Приложение делится ссылками вида /event-profile/<id>
// (см. client/components/EventShareModal), а эта страница осталась с прежних
// времён и рисовала тот же экран вторым, ничего при этом не зная о входе.
// Чтобы у события был один адрес, просто переводим сюда пришедших по старой
// ссылке.
import { redirect } from 'next/navigation';

export default async function LegacyEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/event-profile/${id}`);
}
