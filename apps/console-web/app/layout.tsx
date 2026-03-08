import type { ReactNode } from "react";

export const metadata = {
  title: "Command Neural System Console",
  description: "Starter console for process control"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
