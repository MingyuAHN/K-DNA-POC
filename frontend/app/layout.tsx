import "./globals.css";

export const metadata = {
  title: "Admin System",
  description: "관리자 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}