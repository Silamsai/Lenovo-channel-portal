import type { Metadata } from 'next';
import { brand } from '@/lib/brand';
import '@/styles/theme.css';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: { default: brand.product, template: `%s · ${brand.product}` },
  description: 'Partner workspace for funding, campaigns, asset approvals and claims.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
