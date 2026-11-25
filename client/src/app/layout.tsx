import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { brand } from '@/lib/brand';
import '@/styles/theme.css';
import '@/styles/app.css';

/** Same typeface as the sign-in page, used across the whole portal. */
const figtree = Figtree({ subsets: ['latin'], display: 'swap', variable: '--font-figtree' });

export const metadata: Metadata = {
  title: { default: brand.product, template: `%s · ${brand.product}` },
  description: 'Partner workspace for funding, campaigns, asset approvals and claims.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
