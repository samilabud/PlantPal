import type { Metadata } from 'next';

import { SupportPage } from '@/site/support';

export const metadata: Metadata = { title: 'Ayuda · PlantPal' };

export default function Page() {
  return <SupportPage lang="es" />;
}
