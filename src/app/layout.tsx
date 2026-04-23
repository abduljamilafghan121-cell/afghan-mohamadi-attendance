import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AppResumeHandler } from "../components/AppResumeHandler";
import { TopProgressBar } from "../components/TopProgressBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attendix",
  description: "Smart attendance management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var ua=navigator.userAgent||'';var isAndroidWebView=/Android/i.test(ua)&&/\bwv\b/i.test(ua);if(!isAndroidWebView)return;var tryLoad=function(){try{if(window.Capacitor&&typeof window.Capacitor.getPlatform==='function')return;var s=document.createElement('script');s.src='capacitor://localhost/capacitor.js';s.onerror=function(){};document.head.appendChild(s);}catch(e){}};tryLoad();setTimeout(tryLoad,300);setTimeout(tryLoad,1200);}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AppResumeHandler />
        {children}
      </body>
    </html>
  );
}
