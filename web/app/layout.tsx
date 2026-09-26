import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Areta Retail Analytics",
  description: "Higher ground awaits — retail analytics for Areta Mountain Systems.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003744",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-abyss font-sans">
        {/* The filters live in the URL, and reading search params on the
            client needs a Suspense boundary for Next to prerender. */}
        <Suspense fallback={<div className="min-h-screen bg-abyss" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}