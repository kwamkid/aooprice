import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aooprice — เทียบราคา Shopee",
  description: "ติดตามและเทียบราคา/ยอดขาย/เรตติ้งสินค้าบน Shopee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-lg text-orange-600">
              aoo<span className="text-gray-800">price</span>
            </a>
            <span className="text-xs text-gray-400">
              เทียบราคา Shopee · อัพเดทผ่าน Extension
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
