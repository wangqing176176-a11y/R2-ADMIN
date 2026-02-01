import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qing's R2 Admin",
  description: "Serverless Cloudflare R2 manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
