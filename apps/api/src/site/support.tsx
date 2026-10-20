import Link from 'next/link';

import { ContactLine } from './contact-line';
import { pagePath, type SiteLang } from './lang';
import { LanguageLinks } from './language-links';

export function SupportPage({ lang }: { lang: SiteLang }) {
  const del = pagePath(lang, '/delete-account');
  const privacy = pagePath(lang, '/privacy');
  return (
    <main>
      <LanguageLinks lang={lang} path="/support" />
      {lang === 'en' ? (
        <>
          <h1>PlantPal support</h1>
          <p>
            Something not working, or an idea? <ContactLine />.
          </p>

          <h2>Common questions</h2>
          <h3>My plants are not on my other phone</h3>
          <p>
            Sign in with the same Apple or Google account on both. Changes sync when you are online;
            the badge at the top of the list shows the status, and pulling the list down syncs now.
          </p>
          <h3>I don&apos;t get reminders</h3>
          <p>
            Turn them on in Settings &gt; Reminders and allow notifications for PlantPal in your
            phone&apos;s settings. Reminders arrive in the morning a plant is due.
          </p>
          <h3>Identify with AI got my plant wrong</h3>
          <p>
            Suggestions can be wrong, so the app never saves them without you: edit the name and
            interval before saving. Tap &quot;Report this suggestion&quot; under a bad answer so we
            can review it. A closer photo of the leaves usually helps.
          </p>
          <h3>How do I change the language?</h3>
          <p>
            Settings &gt; Language: System default, English or Español. Before signing in, use the
            English | Español switch at the top of the sign-in screen.
          </p>
          <h3>How do I cancel Premium?</h3>
          <p>
            In your App Store or Google Play subscriptions (PlantPal&apos;s Settings has a Manage
            subscription link). Premium stays active until the end of the paid period.
          </p>
          <h3>How do I delete my account?</h3>
          <p>
            Settings &gt; Delete account, or see <Link href={del}>delete your account</Link>.
          </p>
          <p>
            <Link href={privacy}>Privacy policy</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Ayuda de PlantPal</h1>
          <p>
            ¿Algo no funciona o tienes una idea? <ContactLine lang="es" />.
          </p>

          <h2>Preguntas frecuentes</h2>
          <h3>Mis plantas no aparecen en mi otro teléfono</h3>
          <p>
            Inicia sesión con la misma cuenta de Apple o Google en los dos. Los cambios se
            sincronizan cuando tienes conexión; el indicador de arriba de la lista muestra el
            estado, y si deslizas la lista hacia abajo se sincroniza en ese momento.
          </p>
          <h3>No me llegan los recordatorios</h3>
          <p>
            Actívalos en Configuración &gt; Recordatorios y permite las notificaciones de PlantPal
            en la configuración de tu teléfono. Los recordatorios llegan la mañana en que toca regar
            una planta.
          </p>
          <h3>Identificar con IA se equivocó de planta</h3>
          <p>
            Las sugerencias pueden estar equivocadas, por eso la app nunca las guarda sin ti:
            corrige el nombre y la frecuencia antes de guardar. Toca &quot;Reportar esta
            sugerencia&quot; debajo de una respuesta mala para que la revisemos. Una foto más cerca
            de las hojas suele ayudar.
          </p>
          <h3>¿Cómo cambio el idioma?</h3>
          <p>
            Configuración &gt; Idioma: Predeterminado del sistema, English o Español. Antes de
            iniciar sesión, usa el selector English | Español en la parte de arriba de la pantalla
            de inicio.
          </p>
          <h3>¿Cómo cancelo Premium?</h3>
          <p>
            En tus suscripciones de App Store o Google Play (la Configuración de PlantPal tiene un
            enlace para administrar la suscripción). Premium sigue activo hasta el final del periodo
            pagado.
          </p>
          <h3>¿Cómo elimino mi cuenta?</h3>
          <p>
            Configuración &gt; Eliminar cuenta, o mira <Link href={del}>eliminar tu cuenta</Link>.
          </p>
          <p>
            <Link href={privacy}>Política de privacidad</Link>
          </p>
        </>
      )}
    </main>
  );
}
