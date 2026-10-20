import Link from 'next/link';

import { contact } from './contact';
import { ContactLine } from './contact-line';
import { pagePath, type SiteLang } from './lang';
import { LanguageLinks } from './language-links';

/** Google Play requires a web page where users can request account deletion without the app. */
export function DeleteAccountPage({ lang }: { lang: SiteLang }) {
  const privacy = pagePath(lang, '/privacy');
  return (
    <main>
      <LanguageLinks lang={lang} path="/delete-account" />
      {lang === 'en' ? (
        <>
          <h1>Delete your PlantPal account</h1>

          <h2>In the app (immediate)</h2>
          <ol>
            <li>Open PlantPal and tap Settings.</li>
            <li>Tap Delete account, then confirm.</li>
          </ol>

          <h2>Without the app</h2>
          {contact.email ? (
            <p>
              <ContactLine /> with the subject &quot;Delete my account&quot; and the email address
              or the sign-in method (Apple or Google) you used. We delete the account within 30 days
              and confirm when it is done. We may ask you to confirm the request from the same email
              address so nobody can delete someone else&apos;s account.
            </p>
          ) : (
            // GitHub issues are public: never ask people to post their email there.
            <p>
              <ContactLine /> titled &quot;Delete my account&quot;. Don&apos;t post your email or
              other personal details in the issue: we reply there with a private way to confirm it
              is your account, then delete it within 30 days.
            </p>
          )}

          <h2>What is deleted</h2>
          <p>
            Everything: your account, plants, watering history, photos, AI usage records and
            reports, push tokens and sign-in sessions, plus your customer record at RevenueCat.
            Nothing is kept afterwards, except that Apple and Google keep their own records of
            purchases. Deleting the account does not cancel a subscription: cancel it in your App
            Store or Google Play subscriptions first.
          </p>
          <p>
            <Link href={privacy}>Privacy policy</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Eliminar tu cuenta de PlantPal</h1>

          <h2>En la app (al instante)</h2>
          <ol>
            <li>Abre PlantPal y toca Configuración.</li>
            <li>Toca Eliminar cuenta y confirma.</li>
          </ol>

          <h2>Sin la app</h2>
          {contact.email ? (
            <p>
              <ContactLine lang="es" /> con el asunto &quot;Eliminar mi cuenta&quot; y el correo o
              el método de inicio de sesión (Apple o Google) que usaste. Eliminamos la cuenta dentro
              de 30 días y te confirmamos cuando esté hecho. Puede que te pidamos confirmar la
              solicitud desde el mismo correo, para que nadie pueda eliminar la cuenta de otra
              persona.
            </p>
          ) : (
            // Los issues de GitHub son públicos: nunca pedir que publiquen su correo ahí.
            <p>
              <ContactLine lang="es" /> con el título &quot;Eliminar mi cuenta&quot;. No publiques
              tu correo ni otros datos personales en el issue: te respondemos ahí con una forma
              privada de confirmar que la cuenta es tuya y la eliminamos dentro de 30 días.
            </p>
          )}

          <h2>Qué se elimina</h2>
          <p>
            Todo: tu cuenta, tus plantas, el historial de riego, las fotos, los registros de uso de
            la IA y los reportes, los tokens de notificaciones y las sesiones, además de tu registro
            de cliente en RevenueCat. No se guarda nada después, salvo que Apple y Google conservan
            sus propios registros de compras. Eliminar la cuenta no cancela una suscripción:
            cancélala primero en tus suscripciones de App Store o Google Play.
          </p>
          <p>
            <Link href={privacy}>Política de privacidad</Link>
          </p>
        </>
      )}
    </main>
  );
}
