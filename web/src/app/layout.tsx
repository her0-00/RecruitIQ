import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecruitIQ ATS Intelligence v4.0",
  description: "Generate pixel perfect resumes perfectly tuned for ATS.",
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
