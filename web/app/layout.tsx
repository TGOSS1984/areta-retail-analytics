import type { Metadata } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Areta Retail Analytics",
  description: "Higher ground awaits — retail analytics for Areta Mountain Systems.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}