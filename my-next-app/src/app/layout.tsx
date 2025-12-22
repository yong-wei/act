import "@/styles/globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/shared/auth-provider";

export const metadata: Metadata = {
  title: "AI-OBE船舶智控平台",
  description: "现代化在线学习平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode; }>)
{
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
