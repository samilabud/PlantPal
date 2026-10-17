import type { Metadata } from 'next';
import Link from 'next/link';

import { ContactLine } from '@/site/contact-line';
import { POLICY_DATE } from '@/site/contact';

export const metadata: Metadata = { title: 'Privacy policy · PlantPal' };

// Keep in sync with what the code stores (apps/api/src/db/schema.ts) and with the store
// "data safety" / "privacy nutrition label" answers in docs/release/.
export default function PrivacyPage() {
  return (
    <main>
      <h1>PlantPal privacy policy</h1>
      <p>Last updated: {POLICY_DATE}</p>
      <p>
        PlantPal is a small plant-watering app built as a portfolio project. It collects only what
        it needs to keep your plants in sync between your devices and to remind you to water them.
        There are no ads and no tracking across apps, and your data is never sold or shared for
        marketing. Anonymous usage counts can be switched off in Settings.
      </p>

      <h2>What PlantPal stores</h2>
      <ul>
        <li>
          <strong>Account:</strong> an account id, the id Apple or Google gives us for your sign-in,
          and your email address if you choose to share it (with Apple you can hide it).
        </li>
        <li>
          <strong>Your plants:</strong> the names you give them, how often each needs water, the
          times you watered them, and photos you add.
        </li>
        <li>
          <strong>Photos:</strong> resized and re-encoded on your phone before upload. The new file
          contains only the picture, no metadata such as GPS location. PlantPal never asks for your
          location.
        </li>
        <li>
          <strong>Reminders:</strong> if you turn on reminders, a push token for your device (so
          reminders can reach it) and whether it is an iPhone or Android phone.
        </li>
        <li>
          <strong>Subscription:</strong> whether you have Premium and when it ends. Payment details
          are handled by Apple or Google; PlantPal never sees them.
        </li>
        <li>
          <strong>Sign-in sessions:</strong> secure session tokens, stored only in hashed form.
        </li>
        <li>
          <strong>Usage analytics (optional):</strong> a short, fixed list of events such as &quot;a
          plant was added&quot;, &quot;the paywall was shown&quot; or &quot;a purchase
          completed&quot;, with your random account id, the app version and the phone model. Never
          plant names, photos or your email; no screen recording and no tap tracking. Switch it off
          any time in Settings &gt; Usage analytics.
        </li>
      </ul>
      <p>
        Your plants are also stored on your phone so the app works offline. Signing out removes that
        copy from the phone.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>Vercel (hosting and photo storage) and Neon (database).</li>
        <li>Apple and Google, for sign-in, purchases and delivering push notifications.</li>
        <li>Expo, which forwards reminders to Apple&apos;s and Google&apos;s push services.</li>
        <li>RevenueCat, which checks your subscription status with Apple or Google.</li>
        <li>PostHog, which stores the optional usage analytics and runs the paywall A/B test.</li>
      </ul>
      <p>
        These services act on PlantPal&apos;s behalf and keep basic technical logs (such as IP
        addresses) for security and operations under their own policies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Reminders are off until you turn them on, and you can turn them off at any time.</li>
        <li>Photos are optional.</li>
        <li>
          <strong>Delete your account</strong> from Settings &gt; Delete account. This permanently
          deletes your account, plants, watering history, photos and push tokens from our servers,
          asks RevenueCat to delete your customer record, and (for Apple sign-in) revokes
          PlantPal&apos;s access to your Apple ID. You can also{' '}
          <Link href="/delete-account">request deletion without the app</Link>.
        </li>
      </ul>
      <p>
        Data is kept while your account exists and deleted when you delete the account. When you
        delete a single plant or photo, it disappears from the app and your other devices at once;
        our server keeps a hidden copy until you delete your account. Apple and Google keep their
        own purchase records as required by law.
      </p>

      <h2>Children</h2>
      <p>
        PlantPal is not directed at children under 13 and does not knowingly collect their data.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date above changes and the app links to the new version.
        Questions: <ContactLine />.
      </p>
    </main>
  );
}
