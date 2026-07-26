import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
    <html lang="sq" className={cn(inter.variable, inter.className)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
