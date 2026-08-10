import { redirect } from 'next/navigation';
import { use } from 'react';

export default function RedirectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  redirect(`/agents/${resolved.id}`);
}
