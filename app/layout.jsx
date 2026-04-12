import './globals.css';

export const metadata = {
  title: 'Atrium',
  description: 'A space for thinking together',
  manifest: '/manifest.json',
  themeColor: '#28292e',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atrium',
  },
};

export const viewport = {
  themeColor: '#28292e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
