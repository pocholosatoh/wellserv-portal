// app/patient-results/page.tsx
"use client";
import { useEffect, useState } from "react";
import ReportViewer from "@/components/ReportViewer";

export default function PatientResultsPage() {
  const [pid, setPid] = useState<string | null>(null);

  useEffect(() => {
    const cookiePid = document.cookie
      .split("; ")
      .find((row) => row.startsWith("patient_id="))
      ?.split("=")[1];
    setPid(cookiePid || null);
  }, []);

  if (!pid) return <p>No patient logged in. Please <a href="/login">login</a>.</p>;

  return (
    <ReportViewer
      initialPatientId={pid}
      apiPath="/api/patient-results"
      autoFetch={true}
    />
  );
}
