import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracker",
  description: "Minimal episode tracker for anime, TV and movies. Offline-first with cloud sync.",
  applicationName: "Tracker",
  appleWebApp: { capable: true, title: "Tracker", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="bg-black text-fg antialiased">{children}</body>
    </html>
  );
}
