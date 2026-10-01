import type { Metadata } from "next";
import "./globals.css";
import { storageGuardScript } from "./storageGuard";

export const metadata: Metadata = {
  title: "Лист Героя 5e — создание персонажа D&D 2014",
  description: "Пошаговый конструктор персонажа D&D 5e в редакции 2014 года.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: storageGuardScript }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
