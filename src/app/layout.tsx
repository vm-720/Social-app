import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Sentiment",
  description: "What people are saying about your business on social media.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
