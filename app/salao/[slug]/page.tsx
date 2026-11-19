import PublicBookingClient from '@/components/booking/PublicBookingClient';

export default async function PublicSalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBookingClient slug={slug} />;
}
