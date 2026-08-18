import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Website Intelligence Command Center",
  description:
    "Private website crawling and technical SEO intelligence workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
