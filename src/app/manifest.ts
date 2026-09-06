import type { MetadataRoute } from "next";

import { APP_NAME } from "@/lib/constants";

/**
 * Makes the site installable to a phone home screen.
 *
 * iOS mostly ignores this file — it takes the icon from apple-touch-icon and
 * the fullscreen behaviour from the apple-mobile-web-app meta tags in the root
 * layout. It is Android that reads this. Both are needed to cover both.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — campus services`,
    short_name: APP_NAME,
    description:
      "Book barbers, braiders, tutors, photographers and more from students and pros around your campus.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // The canvas colour, so the splash and status bar match the app rather
    // than flashing white on launch.
    background_color: "#ece7df",
    theme_color: "#ece7df",
    categories: ["lifestyle", "shopping", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Kept inside the safe zone so a circular launcher crop does not clip it.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore services", url: "/explore" },
      { name: "My appointments", url: "/appointments" },
      { name: "Messages", url: "/messages" },
    ],
  };
}
