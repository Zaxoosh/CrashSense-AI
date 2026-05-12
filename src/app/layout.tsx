import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrashSense AI",
  description: "Plain-English crash log diagnosis for modpacks, containers, CI, and apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
