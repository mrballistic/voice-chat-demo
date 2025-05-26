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
      </head>
      <body
        className={
          `${geistSans.variable} ${geistMono.variable} antialiased` +
          ' dark' // Always add dark class for hydration match
        }
        style={{ colorScheme: 'light dark' }}
      >
        {children}
        {/* Remove the script that toggles dark mode at runtime to avoid hydration mismatch */}
      </body>
    </html>
  );
}
