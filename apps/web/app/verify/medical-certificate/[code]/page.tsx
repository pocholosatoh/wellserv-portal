// app/verify/medical-certificate/[code]/page.tsx
import { getSupabase } from "@/lib/supabase";

type CertificateVerifyRow = {
  certificate_no: string | null;
  patient_full_name: string | null;
  patient_birthdate: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  issued_at: string | null;
  valid_until: string | null;
  status: string | null;
  verification_code: string | null;
  doctor_snapshot?: { full_name?: string | null; display_name?: string | null } | null;
  diagnosis_text: string | null;
  remarks: string | null;
};

async function fetchByCode(code: string) {
  const db = getSupabase();
  const cert = await db
    .from("medical_certificates")
    .select(
      [
        "certificate_no",
        "patient_full_name",
        "patient_birthdate",
        "patient_age",
        "patient_sex",
        "issued_at",
        "valid_until",
        "status",
        "verification_code",
        "doctor_snapshot",
        "diagnosis_text",
        "remarks",
      ].join(", "),
    )
    .eq("verification_code", code)
    .maybeSingle();
  if (cert.error) {
    throw new Error(cert.error.message);
  }
  return cert.data as CertificateVerifyRow | null;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export default async function MedicalCertificateVerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let cert: Awaited<ReturnType<typeof fetchByCode>> | null = null;
  try {
    cert = await fetchByCode(code);
  } catch (err) {
    console.error("[med-cert verify] failed", err);
  }

  const now = new Date();
  let statusLabel = "Unknown";
  let statusColor = "#64748b";

  if (cert) {
    if (cert.status === "void") {
      statusLabel = "Void";
      statusColor = "#b91c1c";
    } else if (cert.valid_until && new Date(cert.valid_until) < now) {
      statusLabel = "Expired";
      statusColor = "#f97316";
    } else {
      statusLabel = "Valid";
      statusColor = "#059669";
    }
  }

  return (
    <div className="verify-page">
      <div className="card">
        <h1>Medical Certificate Verification</h1>
        {!cert && (
          <p className="text-muted">
            We could not find a certificate with code <b>{code}</b>. Please confirm the code or
            contact the issuing clinic.
          </p>
        )}
        {cert && (
          <div className="details">
            <div
              className="status-pill"
              style={{ backgroundColor: statusColor + "20", color: statusColor }}
            >
              {statusLabel}
            </div>
            <dl>
              <div>
                <dt>Certificate No.</dt>
                <dd>{cert.certificate_no}</dd>
              </div>
              <div>
                <dt>Patient</dt>
                <dd>{cert.patient_full_name}</dd>
              </div>
              <div>
                <dt>Issued on</dt>
                <dd>{formatDate(cert.issued_at)}</dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(cert.valid_until)}</dd>
              </div>
              <div>
                <dt>Physician</dt>
                <dd>
                  {cert.doctor_snapshot?.full_name ||
                    cert.doctor_snapshot?.display_name ||
                    "Attending Physician"}
                </dd>
              </div>
              <div>
                <dt>Remarks</dt>
                <dd>{cert.remarks || "—"}</dd>
              </div>
              <div>
                <dt>Diagnosis</dt>
                <dd>{cert.diagnosis_text || "—"}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <style>{`
        .verify-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0fdfa, #e0f2fe);
          padding: 40px 16px;
          font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
        }
        .card {
          width: 100%;
          max-width: 600px;
          background: #fff;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 25px 45px rgba(15, 23, 42, 0.1);
        }
        h1 {
          margin: 0 0 16px;
          font-size: 24px;
          color: #0f172a;
        }
        .text-muted { color: #475569; font-size: 15px; }
        .details { margin-top: 16px; }
        .status-pill {
          display: inline-flex;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        dl {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 18px;
        }
        dt {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
        }
        dd {
          margin: 2px 0 0;
          font-size: 15px;
          color: #0f172a;
          font-weight: 600;
        }
        @media (max-width: 640px) {
          dl { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
