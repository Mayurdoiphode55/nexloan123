import type { Metadata } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ChatbotWidget from "@/components/ChatbotWidget";
import ToastProvider from "@/components/ToastProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexLoan — AI-First Personal Loan Platform",
  description:
    "AI-powered personal loan origination by Theoremlabs. Apply, verify, and manage your loan in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to prevent flash of wrong theme and inject dev auth token
  const themeScript = `
    (function() {
      try {
        var stored = localStorage.getItem('nexloan_theme');
        var theme = stored || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        // DEV: Inject a real 365-day JWT so the backend never returns 401
        var DEV_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNzllOGEzMy02NWE4LTQxZjQtYWZiYS03MzgxZjAyNjU1N2YiLCJlbWFpbCI6Im1heXVyZG9pcGhvZGU1NUBnbWFpbC5jb20iLCJyb2xlIjoiTE9BTl9PRkZJQ0VSIiwiZXhwIjoxODA4NTQ3Mzk2LCJpYXQiOjE3NzcwMTEzOTZ9.lQXEy6USQwQdFUoy98iDd3hNJ-7idqQogFbj4Y8VMUU';
        var DEV_USER = JSON.stringify({id:'379e8a33-65a8-41f4-afba-7381f026557f',email:'mayurdoiphode55@gmail.com',full_name:'MAYUR NANASAHEB DOIPHODE',role:'LOAN_OFFICER',is_verified:true});
        localStorage.setItem('nexloan_token', DEV_TOKEN);
        localStorage.setItem('nexloan_user', DEV_USER);
      } catch(e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
        <ChatbotWidget />
      </body>
    </html>
  );
}
