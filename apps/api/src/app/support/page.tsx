import type { Metadata } from 'next';
import Link from 'next/link';

import { ContactLine } from '@/site/contact-line';

export const metadata: Metadata = { title: 'Support · PlantPal' };

export default function SupportPage() {
  return (
    <main>
      <h1>PlantPal support</h1>
      <p>
        Something not working, or an idea? <ContactLine />.
      </p>

      <h2>Common questions</h2>
      <h3>My plants are not on my other phone</h3>
      <p>
        Sign in with the same Apple or Google account on both. Changes sync when you are online; the
        badge at the top of the list shows the status, and pulling the list down syncs now.
      </p>
      <h3>I don&apos;t get reminders</h3>
      <p>
        Turn them on in Settings &gt; Reminders and allow notifications for PlantPal in your
        phone&apos;s settings. Reminders arrive in the morning a plant is due.
      </p>
      <h3>How do I cancel Premium?</h3>
      <p>
        In your App Store or Google Play subscriptions (PlantPal&apos;s Settings has a Manage
        subscription link). Premium stays active until the end of the paid period.
      </p>
      <h3>How do I delete my account?</h3>
      <p>
        Settings &gt; Delete account, or see <Link href="/delete-account">delete your account</Link>
        .
      </p>
      <p>
        <Link href="/privacy">Privacy policy</Link>
      </p>
    </main>
  );
}
