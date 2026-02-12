import './globals.css';
export const metadata = { title: 'MAAT Money Console', description: 'Tech 4 Humanity — Finance Command Centre' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-maat-bg text-slate-200 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
