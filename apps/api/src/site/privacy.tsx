import Link from 'next/link';

import { ContactLine } from './contact-line';
import { POLICY_DATE } from './contact';
import { pagePath, type SiteLang } from './lang';
import { LanguageLinks } from './language-links';

// Keep in sync with what the code stores (apps/api/src/db/schema.ts) and with the store
// "data safety" / "privacy nutrition label" answers in docs/release/. Both languages say the
// same thing; change them together.

const ANTHROPIC_RETENTION =
  'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data';
const ANTHROPIC_TERMS = 'https://www.anthropic.com/legal/commercial-terms';

export function PrivacyPolicy({ lang }: { lang: SiteLang }) {
  const deleteLink = pagePath(lang, '/delete-account');
  return (
    <main>
      <LanguageLinks lang={lang} path="/privacy" />
      {lang === 'en' ? <English deleteLink={deleteLink} /> : <Spanish deleteLink={deleteLink} />}
    </main>
  );
}

function English({ deleteLink }: { deleteLink: string }) {
  return (
    <>
      <h1>PlantPal privacy policy</h1>
      <p>Last updated: {POLICY_DATE.en}</p>
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
          reminders can reach it), whether it is an iPhone or Android phone, and the app&apos;s
          language (so reminders arrive in it).
        </li>
        <li>
          <strong>Subscription:</strong> whether you have Premium and when it ends. Payment details
          are handled by Apple or Google; PlantPal never sees them.
        </li>
        <li>
          <strong>Sign-in sessions:</strong> secure session tokens, stored only in hashed form.
        </li>
        <li>
          <strong>AI identification:</strong> for each time you use &quot;Identify with AI&quot;,
          the time, the result type (for example &quot;not a plant&quot;) and how much it cost, to
          apply the daily limits. Not the photo and not the answer. If you report a suggestion, we
          keep that suggestion, the reason and your note.
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
        copy from the phone. Your language choice stays on the phone.
      </p>

      <h2>Identify with AI</h2>
      <p>
        Only when you tap &quot;Identify with AI&quot;, the photo you chose is sent through our
        server to Anthropic, whose AI (Claude) suggests the plant&apos;s name and how often to water
        it. The app tells you this the first time you use it. PlantPal does not store the photo or
        the answer. Anthropic processes the photo on PlantPal&apos;s behalf. Under its{' '}
        <a href={ANTHROPIC_RETENTION}>data retention policy</a>, it deletes API inputs and outputs
        within 30 days of receiving or generating them, except where longer retention is needed to
        enforce its usage policies or required by law. Under its{' '}
        <a href={ANTHROPIC_TERMS}>commercial terms</a>, Anthropic may not train models on this
        content. Suggestions can be wrong: check them before saving. The feature is optional; you
        can always add plants yourself.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>Vercel (hosting and photo storage) and Neon (database).</li>
        <li>Apple and Google, for sign-in, purchases and delivering push notifications.</li>
        <li>Expo, which forwards reminders to Apple&apos;s and Google&apos;s push services.</li>
        <li>RevenueCat, which checks your subscription status with Apple or Google.</li>
        <li>PostHog, which stores the optional usage analytics and runs the paywall A/B test.</li>
        <li>Anthropic, which identifies plants in photos when you use Identify with AI.</li>
      </ul>
      <p>
        These services act on PlantPal&apos;s behalf and keep basic technical logs (such as IP
        addresses) for security and operations under their own policies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Reminders are off until you turn them on, and you can turn them off at any time.</li>
        <li>Photos and Identify with AI are optional.</li>
        <li>
          <strong>Delete your account</strong> from Settings &gt; Delete account. This permanently
          deletes your account, plants, watering history, photos, AI usage records, reports and push
          tokens from our servers, asks RevenueCat to delete your customer record, and (for Apple
          sign-in) revokes PlantPal&apos;s access to your Apple ID. You can also{' '}
          <Link href={deleteLink}>request deletion without the app</Link>.
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
    </>
  );
}

function Spanish({ deleteLink }: { deleteLink: string }) {
  return (
    <>
      <h1>Política de privacidad de PlantPal</h1>
      <p>Última actualización: {POLICY_DATE.es}</p>
      <p>
        PlantPal es una pequeña app para regar plantas, creada como proyecto de portafolio. Solo
        recopila lo necesario para mantener tus plantas sincronizadas entre tus dispositivos y para
        recordarte regarlas. No hay anuncios ni rastreo entre apps, y tus datos nunca se venden ni
        se comparten con fines de marketing. Los conteos de uso anónimos se pueden desactivar en
        Configuración.
      </p>

      <h2>Qué guarda PlantPal</h2>
      <ul>
        <li>
          <strong>Cuenta:</strong> un identificador de cuenta, el identificador que Apple o Google
          nos da para tu inicio de sesión y tu correo, si decides compartirlo (con Apple puedes
          ocultarlo).
        </li>
        <li>
          <strong>Tus plantas:</strong> los nombres que les pones, cada cuánto necesita agua cada
          una, las veces que las regaste y las fotos que agregas.
        </li>
        <li>
          <strong>Fotos:</strong> se reducen y se vuelven a codificar en tu teléfono antes de
          subirlas. El archivo nuevo contiene solo la imagen, sin metadatos como la ubicación GPS.
          PlantPal nunca pide tu ubicación.
        </li>
        <li>
          <strong>Recordatorios:</strong> si activas los recordatorios, un token de notificaciones
          de tu dispositivo (para que los recordatorios lleguen), si es un iPhone o un Android, y el
          idioma de la app (para que lleguen en ese idioma).
        </li>
        <li>
          <strong>Suscripción:</strong> si tienes Premium y cuándo termina. Los datos de pago los
          maneja Apple o Google; PlantPal nunca los ve.
        </li>
        <li>
          <strong>Sesiones:</strong> tokens de sesión seguros, guardados solo en forma de hash.
        </li>
        <li>
          <strong>Identificación con IA:</strong> por cada vez que usas &quot;Identificar con
          IA&quot;, la hora, el tipo de resultado (por ejemplo, &quot;no es una planta&quot;) y
          cuánto costó, para aplicar los límites diarios. No la foto ni la respuesta. Si reportas
          una sugerencia, guardamos esa sugerencia, el motivo y tu nota.
        </li>
        <li>
          <strong>Estadísticas de uso (opcionales):</strong> una lista corta y fija de eventos como
          &quot;se agregó una planta&quot;, &quot;se mostró la pantalla de Premium&quot; o &quot;se
          completó una compra&quot;, con tu identificador de cuenta aleatorio, la versión de la app
          y el modelo del teléfono. Nunca nombres de plantas, fotos ni tu correo; sin grabación de
          pantalla ni registro de toques. Desactívalas cuando quieras en Configuración &gt;
          Estadísticas de uso.
        </li>
      </ul>
      <p>
        Tus plantas también se guardan en tu teléfono para que la app funcione sin conexión. Al
        cerrar sesión, esa copia se borra del teléfono. Tu elección de idioma se queda en el
        teléfono.
      </p>

      <h2>Identificar con IA</h2>
      <p>
        Solo cuando tocas &quot;Identificar con IA&quot;, la foto que elegiste se envía a través de
        nuestro servidor a Anthropic, cuya IA (Claude) sugiere el nombre de la planta y cada cuánto
        regarla. La app te lo explica la primera vez que la usas. PlantPal no guarda la foto ni la
        respuesta. Anthropic procesa la foto en nombre de PlantPal. Según su{' '}
        <a href={ANTHROPIC_RETENTION}>política de retención de datos</a> (en inglés), elimina las
        entradas y respuestas de su API dentro de los 30 días de recibirlas o generarlas, salvo
        cuando necesita guardarlas más tiempo para hacer cumplir sus políticas de uso o cuando la
        ley lo exige. Según sus <a href={ANTHROPIC_TERMS}>términos comerciales</a> (en inglés),
        Anthropic no puede entrenar modelos con este contenido. Las sugerencias pueden estar
        equivocadas: revísalas antes de guardar. La función es opcional; siempre puedes agregar
        plantas tú.
      </p>

      <h2>Quién los procesa</h2>
      <ul>
        <li>Vercel (alojamiento y almacenamiento de fotos) y Neon (base de datos).</li>
        <li>
          Apple y Google, para el inicio de sesión, las compras y la entrega de notificaciones.
        </li>
        <li>
          Expo, que envía los recordatorios a los servicios de notificaciones de Apple y Google.
        </li>
        <li>RevenueCat, que consulta el estado de tu suscripción con Apple o Google.</li>
        <li>
          PostHog, que guarda las estadísticas de uso opcionales y ejecuta la prueba A/B de la
          pantalla de Premium.
        </li>
        <li>Anthropic, que identifica plantas en fotos cuando usas Identificar con IA.</li>
      </ul>
      <p>
        Estos servicios actúan en nombre de PlantPal y guardan registros técnicos básicos (como
        direcciones IP) por seguridad y operación, según sus propias políticas.
      </p>

      <h2>Tus opciones</h2>
      <ul>
        <li>
          Los recordatorios están desactivados hasta que los activas, y puedes desactivarlos cuando
          quieras.
        </li>
        <li>Las fotos e Identificar con IA son opcionales.</li>
        <li>
          <strong>Elimina tu cuenta</strong> desde Configuración &gt; Eliminar cuenta. Esto elimina
          para siempre de nuestros servidores tu cuenta, tus plantas, el historial de riego, las
          fotos, los registros de uso de la IA, los reportes y los tokens de notificaciones; le pide
          a RevenueCat que elimine tu registro de cliente y (si iniciaste sesión con Apple) revoca
          el acceso de PlantPal a tu Apple ID. También puedes{' '}
          <Link href={deleteLink}>pedir la eliminación sin la app</Link>.
        </li>
      </ul>
      <p>
        Los datos se guardan mientras exista tu cuenta y se eliminan cuando la eliminas. Cuando
        eliminas una planta o una foto, desaparece al instante de la app y de tus otros
        dispositivos; nuestro servidor guarda una copia oculta hasta que elimines tu cuenta. Apple y
        Google guardan sus propios registros de compras, como exige la ley.
      </p>

      <h2>Menores</h2>
      <p>PlantPal no está dirigida a menores de 13 años y no recopila sus datos a sabiendas.</p>

      <h2>Cambios y contacto</h2>
      <p>
        Si esta política cambia, cambia la fecha de arriba y la app enlaza a la versión nueva.
        Preguntas: <ContactLine lang="es" />.
      </p>
      <p>
        <em>
          Esta es una traducción. Si hay alguna diferencia, prevalece la{' '}
          <Link href="/privacy">versión en inglés</Link>.
        </em>
      </p>
    </>
  );
}
