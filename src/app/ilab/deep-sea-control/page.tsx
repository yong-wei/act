import { DeepSeaControlExperiment } from './experiment-client';

export const dynamic = 'force-dynamic';

export default async function DeepSeaControlPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const params = await searchParams;
  const ticketValue = params?.ticket;
  const ticket = Array.isArray(ticketValue) ? ticketValue[0] ?? '' : ticketValue ?? '';
  return <DeepSeaControlExperiment initialTicket={ticket} />;
}
