import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

// ONE TMS design: one clean UI sans (Figtree) across the app, matching the
// mockup. latin-ext covers Romanian diacritics (ă â î ș ț).
const figtree = Figtree({
  variable: "--font-figtree",
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
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
