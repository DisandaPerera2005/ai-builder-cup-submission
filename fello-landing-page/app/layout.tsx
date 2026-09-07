import type { Metadata } from "next";
import { Inter, Outfit, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fello | AI Coordination Platform for WhatsApp-First Organizations",
  description:
    "Fello is an AI-powered coordination layer that lives inside WhatsApp groups, automates tasks, routes documents to Google Drive, and updates a centralized dashboard.",
  icons: {
    icon: "/fello-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(inter.variable, outfit.variable, "font-sans", geist.variable)} style={{ scrollBehavior: "smooth" }}>
      <body style={{ margin: 0, fontFamily: "var(--font-inter), sans-serif", backgroundColor: "#fbfbfa", color: "#101012" }}>
        {children}
      </body>
    </html>
  );
}
