import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { APP_NAME } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — find someone on campus who can do it`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Book barbers, braiders, tutors, photographers and more from students and pros around your campus.",

  // iOS does not read the web manifest for any of this. Added to the home
  // screen it launches fullscreen with no Safari chrome, using the icon named
  // here rather than a screenshot of the page.
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // The canvas colour behind the status bar; "default" would leave it white
    // and visibly detached from the page.
    statusBarStyle: "default",
  },
  other: {
    // Next emits the standard `mobile-web-app-capable`, which iOS honours from
    // 16.4. Older iPhones only read the prefixed one, and without it the app
    // opens in Safari with the address bar instead of fullscreen.
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ece7df",
  // Installed to a home screen the app owns the whole screen, including the
  // area behind the notch, so panes must respect the safe insets.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // Students pinch-zoom provider photos; do not trap them at 1x.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
