import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenAI PT Intake Chat",
  description: "A simple chat interface for OpenAI"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>OpenAI Chat</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></link>
      </head>
      <body
        className={
          `${geistSans.variable} ${geistMono.variable} antialiased bg-[#002078] text-white min-h-screen flex flex-col` +
          ' dark'
        }
        style={{ colorScheme: 'light dark' }}
      >
        <main className="flex-1 flex flex-col items-center w-[80vw] max-w-screen-xl mx-auto px-4 py-6 min-h-0">
          {children}
        </main>
      
        {/* Remove the script that toggles dark mode at runtime to avoid hydration mismatch */}
      </body>
    </html>
  );
}
