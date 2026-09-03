import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard de Marketing",
  description: "Google Ads, Meta Ads e CRM em um só painel — KPIs, funil e performance por campanha.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, para não piscar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('dashboard-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
