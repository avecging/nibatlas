import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

import { AppShell } from "@/src/components/layout/AppShell";
import { AccountSessionProvider } from "@/src/features/account/AccountSessionProvider";
import { SignInProvider } from "@/src/features/auth/SignInProvider";
import { CatalogueProvider } from "@/src/features/catalogue/CatalogueProvider";
import { CollectionProvider } from "@/src/features/collection/collection-store";
import { ReviewerModeProvider } from "@/src/features/reviewer/ReviewerModeProvider";

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
        <ReviewerModeProvider>
          <AccountSessionProvider>
            {/*
              The interruption sits above the application rather than inside a
              screen: authentication is not a destination, so any surface can ask
              for it, and the callback's result has to be announceable on whichever
              page the reader was returned to.
            */}
            <SignInProvider>
              <CatalogueProvider>
                <CollectionProvider>
                  <AppShell>{children}</AppShell>
                </CollectionProvider>
              </CatalogueProvider>
            </SignInProvider>
          </AccountSessionProvider>
        </ReviewerModeProvider>
      </body>
    </html>
  );
}
