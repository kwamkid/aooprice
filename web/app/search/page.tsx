import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SearchClient } from "@/components/SearchClient";

export const metadata = { title: "ค้นหาราคา · aooprice" };

// ค้นหา real-time ad-hoc — ยิงผ่าน extension (ดู CLAUDE.md) ไม่เก็บเข้า dashboard
export default function SearchPage() {
  return (
    <div>
      <PageHeader
        title={<>ค้นหา<span className="gradient-text">เทียบราคาสด</span></>}
        subtitle="พิมพ์ keyword สินค้า → ดึงราคาสดจาก Shopee ผ่าน Extension แล้วเทียบทันที"
        action={<Badge tone="brand">ผ่าน Extension</Badge>}
      />
      <SearchClient shopFilter />
    </div>
  );
}
