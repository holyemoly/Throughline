import './globals.css';

export const metadata = {
  title: 'Throughline',
  description: 'A space for honest conversation',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
