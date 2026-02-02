import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qing's R2 Admin",
  description: "Serverless Cloudflare R2 manager",
  icons: {
    // 用 query 参数避免浏览器强缓存导致“图标不更新”
    icon: [{ url: "/brand.png?v=1", type: "image/png" }],
    shortcut: [{ url: "/brand.png?v=1", type: "image/png" }],
    apple: [{ url: "/brand.png?v=1", type: "image/png" }],
  },
};

const themeInitScript = `
(() => {
  try {
    const key = "r2_admin_theme_v1";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = mode === "dark" || (mode === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="icon" href="/brand.png?v=1" type="image/png" />
        <link rel="apple-touch-icon" href="/brand.png?v=1" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
