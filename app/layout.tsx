import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AmiMaint — Mantenimiento",
  description: "Gestión de mantenimiento AMISSA",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AmiMaint" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#02257D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var stored=localStorage.getItem('theme');var dark=stored==='dark';document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
