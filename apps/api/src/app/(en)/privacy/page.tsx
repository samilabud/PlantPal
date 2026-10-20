import type { Metadata } from 'next';

import { PrivacyPolicy } from '@/site/privacy';

export const metadata: Metadata = { title: 'Privacy policy · PlantPal' };

export default function Page() {
  return <PrivacyPolicy lang="en" />;
}
