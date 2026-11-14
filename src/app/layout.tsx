import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { OfflineBanner } from "@/components/ui/offline-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const APP_NAME = "MAYaMenu";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Cardápio digital e pedidos na mesa, sem instalação. MAYaRAnas Sistemas.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="w-full bg-amber-400 text-neutral-950 text-xs sm:text-sm font-semibold px-3 py-1.5 text-center border-b border-amber-500/40">
          Este aplicativo está em teste de lançamento. Se quiser,{" "}
          <a
            href="mailto:contato@mayamenu.com.br?subject=Contato%20-%20Teste%20de%20Lan%C3%A7amento%20MAYaMenu"
            className="underline font-bold hover:text-neutral-800"
          >
            deixe um contato para nos falarmos depois
          </a>
          .
        </div>
        <OfflineBanner />
        <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
      </body>
    </html>
  );
}
