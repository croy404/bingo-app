import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "BINGO — Indian Market Dashboard", description: "Your personal Indian stock market dashboard" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
