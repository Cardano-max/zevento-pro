import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Zevento — India\'s Premier Wedding Marketplace',
  description: 'Find and book the best wedding vendors across India. AI-powered planning, 10,000+ vendors, seamless booking for your dream wedding.',
  keywords: 'wedding vendors India, wedding planner, photographer, decorator, caterer',
  openGraph: {
    title: 'Zevento — India\'s Premier Wedding Marketplace',
    description: 'Plan your dream wedding with AI. Find photographers, decorators, caterers and more.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
