import type { Metadata } from 'next';

import { DeleteAccountPage } from '@/site/delete-account';

export const metadata: Metadata = { title: 'Eliminar tu cuenta · PlantPal' };

export default function Page() {
  return <DeleteAccountPage lang="es" />;
}
