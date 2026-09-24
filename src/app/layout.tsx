import type { Metadata, Viewport } from "next";
// @ts-ignore: side-effect CSS import type declarations are not present in this project
import "./globals.css";

export const metadata: Metadata = {
  title: "REMP — Resilience Estate Management Portal",
  description: "Internal operations platform for Resilience Estate Ltd",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}