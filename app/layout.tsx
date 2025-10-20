// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import Script from "next/script";

const SITE = "https://www.wellserv.co"; // primary domain (www)

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" }, // builds https://www.wellserv.co/
  title: "WELLSERV Medical Laboratory — ₱999 Complete Lab Promo (Nueva Ecija)",
  description:
    "CBC, Urinalysis, FBS, Cholesterol panel, Uric Acid, ALT, Creatinine. Trusted, affordable, and convenient care in Nueva Ecija.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: "WELLSERV",
    title: "WELLSERV Medical Laboratory — ₱999 Complete Lab Promo",
    description:
      "CBC, Urinalysis, FBS, Cholesterol, LDL, HDL, Triglycerides, Uric Acid, ALT, Creatinine. Consult fee ₱350 if package is availed.",
    url: "/", // becomes https://www.wellserv.co/
    images: [
      {
        url: "/og/wellserv-999.png", // served from /public/og/wellserv-999.png
        width: 1200,
        height: 630,
        alt: "₱999 Complete Laboratory Promo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WELLSERV Medical Laboratory — ₱999 Complete Lab Promo",
    description:
      "CBC, Urinalysis, FBS, Cholesterol, LDL, HDL, Triglycerides, Uric Acid, ALT, Creatinine. Consult fee ₱350 if package is availed.",
    images: ["/og/wellserv-999.png"],
  },
  // If you want to block indexing while iterating, uncomment:
  // robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body className="min-h-screen bg-[#f8fafb] antialiased">
        {children}

        {/* Messenger containers (must be in the DOM) */}
        <div id="fb-root" />
        <div
          id="fb-customer-chat"
          className="fb-customerchat"
          data-page_id={process.env.NEXT_PUBLIC_FB_PAGE_ID}
          data-attribution="biz_inbox"
          data-theme_color="#44969b"
          data-greeting_dialog_display="hide"  /* keep minimized on load */
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.fbAsyncInit = function() {
                FB.init({ xfbml: true, version: 'v19.0' });
              };
              (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) return;
                js = d.createElement(s); js.id = id; js.async = true; js.defer = true;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
              }(document, 'script', 'facebook-jssdk'));
            `,
          }}
        />
      </body>
    </html>
  );
}
