import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MIRROR Player',
  description: 'Play published MIRROR Studio episodes'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-body" suppressHydrationWarning>
        <header className="site-header site-header--browse">
          <div className="container-wide site-header-inner">
            <a href="/" className="site-logo">
              <span className="site-logo-mark">MIRROR</span>
            </a>
            <nav className="site-nav">
              <a href="/" className="site-nav-link site-nav-link--active">Browse</a>
            </nav>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
