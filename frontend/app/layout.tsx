import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ChatbotWidget from "@/components/ChatbotWidget";
import ToastProvider from "@/components/ToastProvider";
import { TenantProvider } from "@/lib/tenant";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexLoan — AI-First Loan Platform",
  description:
    "AI-powered loan origination by Theoremlabs. Apply, verify, and manage your loan in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to prevent flash of wrong theme — default to light
  const themeScript = `
    (function() {
      try {
        var stored = localStorage.getItem('nexloan_theme');
        var theme = stored || 'light';
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <TenantProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TenantProvider>
        <ChatbotWidget />
      </body>
    </html>
  );
}
