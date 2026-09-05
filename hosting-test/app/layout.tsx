import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Лист Героя 5e — тест GitHub Pages",
  description: "Статическая тестовая версия конструктора персонажа D&D 5e 2014 без серверной авторизации.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

const staticTestBootstrap = `
(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    let path = raw;
    try { path = new URL(raw, window.location.href).pathname; } catch {}
    if (path === "/api/account" || path.endsWith("/api/account")) {
      return Promise.resolve(new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }
    if (path.includes("/api/auth/") || path.endsWith("/api/vault")) {
      return Promise.resolve(new Response(JSON.stringify({ error: "Auth disabled in GitHub Pages test", vault: null }), {
        status: path.endsWith("/api/vault") ? 200 : 404,
        headers: { "content-type": "application/json" },
      }));
    }
    return nativeFetch(input, init);
  };
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const parchment = `${basePath}/parchment-background.jpg`;
  return (
    <html lang="ru">
      <head>
        <style>{`
          .account-state, .account-warning, .mobile-top-menu a[href="/account"] { display: none !important; }
          .app-shell.modern-design { background: linear-gradient(rgba(246,235,203,.84), rgba(238,218,173,.88)), url('${parchment}') center top / cover fixed !important; }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: staticTestBootstrap }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
