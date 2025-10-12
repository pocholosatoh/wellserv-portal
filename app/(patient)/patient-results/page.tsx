// app/patient-results/page.tsx
"use client";
import { useEffect, useState } from "react";
import ReportViewer from "@/components/ReportViewer";
import OtherLabsViewer from "@/components/OtherLabsViewer";

export default function PatientResultsPage() {
  const [pid, setPid] = useState<string | null>(null);

  useEffect(() => {
    const cookiePid = document.cookie
      .split("; ")
      .find((row) => row.startsWith("patient_id="))
      ?.split("=")[1];
    setPid(cookiePid || null);
  }, []);

  if (!pid) {
    return (
      <p className="p-6">
        No patient logged in. Please <a className="underline" href="/login">login</a>.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4">
          <ReportViewer
            initialPatientId={pid}
            apiPath="/api/patient-results"
            autoFetch={true}
          />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <OtherLabsViewer patientId={pid /* or patientId */} showIfEmpty={false} />
        </div>
      </div>
    </div>
  );
}
