import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PlantPal',
  description: 'Páginas de ayuda de PlantPal',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 640,
          margin: '40px auto',
          padding: '0 16px',
        }}>
        {children}
      </body>
    </html>
  );
}
