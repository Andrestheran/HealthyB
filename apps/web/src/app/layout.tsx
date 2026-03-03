import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alert-IO Portal',
  description: 'Portal de alertas para cuidadores y clínicos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
