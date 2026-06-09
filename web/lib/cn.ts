// รวม className แบบ conditional — ตัดค่า falsy ออก แล้ว join ด้วยช่องว่าง
// (เบา ไม่ต้องพึ่ง dependency เพิ่ม)
export type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
