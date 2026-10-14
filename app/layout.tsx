import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

import { ApplicationFrame } from "@/src/components/layout/ApplicationFrame";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Nib Atlas",
    template: "%s · Nib Atlas",
  },
  description: "Find fountain pen shops. Visit them. Keep the impression.",
  other: { "nibatlas-release": process.env.NIBATLAS_RELEASE ?? "development" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf8f1",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>
        <ApplicationFrame>{children}</ApplicationFrame>
      </body>
    </html>
  );
}
