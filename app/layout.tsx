import type { Metadata, Viewport } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-crimson-pro",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hymnal",
  description:
    "A Collection of Hymns and Sacred Songs — Old German Baptist Brethren Church, 32nd Edition.",
  manifest: "/manifest.json",
  applicationName: "Hymnal",
  appleWebApp: {
    capable: true,
    title: "Hymnal",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

/**
 * Applies the stored theme and text size before first paint. Without this the
 * page renders light and then flips, which is exactly the moment a dark-mode
 * user is looking at it.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem("hymnal") || "{}").state || {};
    var theme = saved.theme || "system";
    var dark = theme === "dark" || (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    var scale = { s: 0.9, m: 1, l: 1.15, xl: 1.32 }[saved.textSize || "m"];
    document.documentElement.style.setProperty("--type-scale", String(scale));
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
