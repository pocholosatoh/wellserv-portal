// app/portal/page.tsx
import ReportViewer from "@/components/ReportViewer";

export default function StaffPortalPage() {
  return <ReportViewer apiPath="/api/results" autoFetch={false} />;
}
