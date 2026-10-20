import type { Metadata } from 'next';

import { DeleteAccountPage } from '@/site/delete-account';

export const metadata: Metadata = { title: 'Delete your account · PlantPal' };

export default function Page() {
  return <DeleteAccountPage lang="en" />;
}
