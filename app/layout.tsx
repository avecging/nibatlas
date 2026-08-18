import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nib Atlas",
  description: "Find fountain pen shops. Visit them. Keep the impression.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
