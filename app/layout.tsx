import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// ONE TMS design: Inter as the UI sans across the app (Helvetica is the
// fallback). latin-ext covers Romanian diacritics (ă â î ș ț).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ONE x TMS",
  description: "Software de management pentru firme de transport",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ro"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
