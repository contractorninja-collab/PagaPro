import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

/**
 * Manrope is the single UI face. It ships as a variable font covering 200–800,
 * so every weight the app uses — 400 through 800 — comes from one file rather
 * than five static ones.
 *
 * latin-ext matters here: the UI is Albanian, and ë/ç appear in almost every
 * label. Dropping it would fall back mid-word.
 *
 * Everything downstream reads --font-sans, which tailwind.config.ts maps to
 * `font-sans`; nothing else in the app names a UI font.
 */
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * The PagaPRO wordmark stays on Inter — the logo is a fixed brand asset and does
 * not follow the UI face. Exposed as --font-brand (`font-brand` in Tailwind) and
 * applied only by the two components that draw the wordmark: `logo.tsx` and the
 * report letterhead. Loaded as a variable, never as a body className, so it
 * cannot leak onto ordinary text.
 *
 * latin only, unlike the UI face: the wordmark renders "PagaPRO" and the "PP"
 * mark, both pure ASCII, so latin-ext would preload a file nothing can use.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PagaPRO",
    template: "%s · PagaPRO",
  },
  description: "Platformë operative për punonjësit, pagat dhe dokumentet — Kosovo.",
  /** Static assets — avoids App Router `app/icon.svg` webpack chunk issues on Windows */
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      // Raster fallbacks for browsers that ignore SVG favicons.
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/app-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/app-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4F7FB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sq"
      className={cn(manrope.variable, inter.variable, manrope.className)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
