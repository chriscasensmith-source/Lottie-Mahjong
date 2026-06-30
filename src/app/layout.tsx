import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lottie Mahjong — Hand Tracker",
  description: "Track the American Mahjong hands you've played and won.",
};

export const viewport: Viewport = {
  themeColor: "#0a3d26",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-display antialiased">{children}</body>
    </html>
  );
}
