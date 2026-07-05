import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { WalletProvider } from "@/lib/WalletContext";
import Header from "@/components/Header";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RiseIn Escrow - Decentralized Freelance Payments",
  description: "Secure, milestone-based escrow payments powered by Soroban on Stellar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-zinc-100 flex flex-col`}
      >
        <WalletProvider>
          <Header />
          <main className="flex-1">
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
