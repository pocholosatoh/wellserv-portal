import "./globals.css";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],      // regular / semibold / bold
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "WELLSERV Portal",
  description: "Patient results",
  // robots here or in route metadata; your portal already sets noindex
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafb]">{children}</body>
    </html>
  );
}
