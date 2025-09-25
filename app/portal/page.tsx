// app/portal/page.tsx
import ReportViewer from "@/components/ReportViewer";

export default function PortalPage() {
  // Both patient view and staff portal now read from the same Supabase-backed API
  // If you later need a different API for staff-only fields, we’ll add a new route then.
  return <ReportViewer apiPath="/api/patient-results" />;
}
