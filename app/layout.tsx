import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";
import "./auth.css";

export const metadata: Metadata = {
  title: { default: "Mandstacks", template: "%s · Mandstacks" },
  description: "Your library, thoughtfully organized and always within reach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
