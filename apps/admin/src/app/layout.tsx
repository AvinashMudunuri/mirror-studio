import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'MIRROR Studio Admin',
  description: 'Episode runs, review verdicts, and bound scripts'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <h1>
              <Link href="/" style={{ color: 'inherit' }}>🎬 MIRROR Studio</Link>
            </h1>
            <span className="sub">episode runs · review board · bound scripts · publish</span>
            <nav className="site-nav">
              <Link href="/generate">+ Generate episode</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
