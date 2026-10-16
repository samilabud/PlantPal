import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>PlantPal</h1>
      <p>A plant-watering app that works offline. This server hosts its API and these pages:</p>
      <ul>
        <li>
          <Link href="/privacy">Privacy policy</Link>
        </li>
        <li>
          <Link href="/support">Support</Link>
        </li>
        <li>
          <Link href="/delete-account">Delete your account</Link>
        </li>
      </ul>
    </main>
  );
}
