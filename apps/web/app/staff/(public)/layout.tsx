import type { ReactNode } from "react";

export default function StaffPublicLayout({ children }: { children: ReactNode }) {
  return <div className="staff-shell min-h-dvh bg-[#f8fafb]">{children}</div>;
}
