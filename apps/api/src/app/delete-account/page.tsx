import type { Metadata } from 'next';
import Link from 'next/link';

import { contact } from '@/site/contact';
import { ContactLine } from '@/site/contact-line';

export const metadata: Metadata = { title: 'Delete your account · PlantPal' };

/** Google Play requires a web page where users can request account deletion without the app. */
export default function DeleteAccountPage() {
  return (
    <main>
      <h1>Delete your PlantPal account</h1>

      <h2>In the app (immediate)</h2>
      <ol>
        <li>Open PlantPal and tap Settings.</li>
        <li>Tap Delete account, then confirm.</li>
      </ol>

      <h2>Without the app</h2>
      {contact.email ? (
        <p>
          <ContactLine /> with the subject &quot;Delete my account&quot; and the email address or
          the sign-in method (Apple or Google) you used. We delete the account within 30 days and
          confirm when it is done. We may ask you to confirm the request from the same email address
          so nobody can delete someone else&apos;s account.
        </p>
      ) : (
        // GitHub issues are public: never ask people to post their email there.
        <p>
          <ContactLine /> titled &quot;Delete my account&quot;. Don&apos;t post your email or other
          personal details in the issue: we reply there with a private way to confirm it is your
          account, then delete it within 30 days.
        </p>
      )}

      <h2>What is deleted</h2>
      <p>
        Everything: your account, plants, watering history, photos, push tokens and sign-in
        sessions, plus your customer record at RevenueCat. Nothing is kept afterwards, except that
        Apple and Google keep their own records of purchases. Deleting the account does not cancel a
        subscription: cancel it in your App Store or Google Play subscriptions first.
      </p>
      <p>
        <Link href="/privacy">Privacy policy</Link>
      </p>
    </main>
  );
}
