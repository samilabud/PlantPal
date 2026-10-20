import type { Metadata } from 'next';

import { SupportPage } from '@/site/support';

export const metadata: Metadata = { title: 'Support · PlantPal' };

export default function Page() {
  return <SupportPage lang="en" />;
}
