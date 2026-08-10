import type { Metadata } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import "./globals.css";

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
  title: "Hymn Book",
  description: "Digital Hymn Book",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Prevents accidental zoom while typing on the numpad
  },
  themeColor: "#FDFBF7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${inter.variable}`}>
      <body className="h-screen w-screen relative overflow-hidden bg-paper">
        {/* God Ray Lighting Effect */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-god-ray w-[200%] h-[200%] -top-1/2 -left-1/2" />
        </div>
        
        {/* SCROLL FIX IS HERE: added "overflow-y-auto" */}
        <main className="relative z-10 h-full w-full max-w-md mx-auto flex flex-col overflow-y-auto no-scrollbar">
          {children}
        </main>
      </body>
    </html>
  );
}