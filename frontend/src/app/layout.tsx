import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { PwaRegistry } from '@/components/PwaRegistry';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-editorial',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const viewport: Viewport = {
  themeColor: '#191a1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Reach News',
  description:
    'Plataforma editorial de notícias e síntese multi-fonte por IA utilizando OmniRoute.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Reach News',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="font-sans antialiased selection:bg-[#20b8cd]/30 selection:text-[#5ce1e6]">
        {children}
        <PwaRegistry />
      </body>
    </html>
  );
}
