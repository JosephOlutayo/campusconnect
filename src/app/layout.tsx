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
};

export const viewport: Viewport = {
  themeColor: "#ece7df",
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
