// app/(doctor)/doctor/login/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = false;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
