import type { Metadata } from 'next';

import { PrivacyPolicy } from '@/site/privacy';

export const metadata: Metadata = { title: 'Política de privacidad · PlantPal' };

export default function Page() {
  return <PrivacyPolicy lang="es" />;
}
