import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Стратегия платформ — экспертный портал",
  description: "Сбор экспертных позиций рабочей группы",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
