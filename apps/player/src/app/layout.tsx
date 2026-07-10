import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MIRROR Player',
  description: 'Play published MIRROR Studio episodes'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container site-header-inner">
            <div>
              <h1>MIRROR Player</h1>
              <p className="sub">Phase 5 preview — published episodes only</p>
            </div>
            <nav className="site-nav">
              <a href="/">Episodes</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
