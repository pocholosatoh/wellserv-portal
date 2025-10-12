"use client";

// Thin client wrapper so we can use ReportViewer inside a Server Component page.
import ReportViewer from "@/components/ReportViewer";

export default function ClientReportViewer({ patientId }: { patientId: string }) {
  return (
    <ReportViewer
      initialPatientId={patientId}
      apiPath="/api/patient-results"  // <- use your existing API route
      autoFetch={true}                // <- immediately load for this patient
    />
  );
}
