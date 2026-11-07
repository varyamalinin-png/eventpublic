// СЕРВЕРНЫЙ компонент — намеренно без 'use client'.
// Именно он даёт превью ссылки на событие в мессенджерах и соцсетях
// (фото, название, описание, дата): Open Graph-теги должны быть в HTML,
// который отдаёт сервер, поэтому сам экран вынесен в EventProfileClient.
import type { Metadata } from 'next';
import EventProfileClient from './EventProfileClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://iwent.ru/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://iwent.ru';

type EventMeta = {
  title?: string;
  description?: string;
  mediaUrl?: string;
  startTime?: string;
  location?: string;
  mediaAspectRatio?: number;
};

async function fetchEventMeta(id: string): Promise<EventMeta | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/events/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as EventMeta;
  } catch {
    // Превью — не критичный путь: если API недоступен, отдаём базовые теги,
    // а не роняем страницу.
    return null;
  }
}

function formatWhen(startTime?: string): string {
  if (!startTime) return '';
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEventMeta(id);

  if (!event?.title) {
    return {
      title: 'iwent',
      description: 'События рядом с тобой',
    };
  }

  const when = formatWhen(event.startTime);
  // В описание превью кладём дату и место — то, что человек хочет увидеть,
  // не открывая ссылку.
  const descriptionParts = [when, event.location, event.description].filter(Boolean);
  const description = descriptionParts.join(' · ').slice(0, 300);
  const url = `${SITE_URL}/event-profile/${id}`;

  /**
   * Картинку для превью отдаём JPEG, а не тем WebP, что лежит в хранилище:
   * телеграм, ВК и вотсап не рисуют WebP в карточке ссылки — заголовок с
   * описанием видны, а фото нет. ?format=jpeg перекодирует на лету и кэширует
   * (см. ImageVariantService на сервере), ширина 1200 — размер, который
   * мессенджеры показывают большой картинкой сверху, а не миниатюрой сбоку.
   *
   * Размеры указываем явно: без них телеграм нередко выбирает маленькую
   * карточку, даже когда картинка подходит под большую.
   */
  const previewImage = event.mediaUrl
    ? `${event.mediaUrl}${event.mediaUrl.includes('?') ? '&' : '?'}w=1200&format=jpeg`
    : null;
  // Высоту считаем из пропорций самой картинки (сервер отдаёт их в
  // mediaAspectRatio = ширина/высота), иначе в карточке остаются поля.
  const ratio =
    typeof event.mediaAspectRatio === 'number' && event.mediaAspectRatio > 0.2 && event.mediaAspectRatio < 5
      ? event.mediaAspectRatio
      : 4 / 3;
  const images = previewImage
    ? [
        {
          url: previewImage,
          width: 1200,
          height: Math.round(1200 / ratio),
          type: 'image/jpeg',
          alt: event.title,
        },
      ]
    : undefined;

  return {
    title: event.title,
    description,
    openGraph: {
      type: 'article',
      title: event.title,
      description,
      url,
      images,
      siteName: 'iwent',
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      images: previewImage ? [previewImage] : undefined,
    },
  };
}

export default function EventProfilePage() {
  return <EventProfileClient />;
}
