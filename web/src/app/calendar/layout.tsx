// Отключаем кэширование HTML календаря, чтобы всегда отдавать актуальную версию
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
