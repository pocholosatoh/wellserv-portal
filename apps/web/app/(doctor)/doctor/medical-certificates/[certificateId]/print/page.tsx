// app/(doctor)/doctor/medical-certificates/[certificateId]/print/page.tsx
import Image from "next/image";
import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { signDoctorSignature } from "@/lib/medicalCertificates";

type SupportingSourceItem = {
  id?: string | number | null;
  label?: string | null;
  summary?: string | null;
  type?: string | null;
  ordinal?: number | null;
  source_type?: string | null;
};

type SupportingDisplayItem = {
  id: string;
  label: string;
  summary: string;
};

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchCertificate(id: string) {
  const db = getSupabase();
  const cert = await db
    .from("medical_certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cert.error) {
    throw new Error(cert.error.message);
  }
  if (!cert.data) {
    throw new Error("Certificate not found");
  }
  const supporting = await db
    .from("medical_certificate_supporting_items")
    .select("id, ordinal, label, summary, source_type")
    .eq("certificate_id", id)
    .order("ordinal", { ascending: true });
  if (supporting.error) {
    throw new Error(supporting.error.message);
  }

  let signedSignature = null;
  const snap = cert.data.doctor_snapshot || null;
  if (snap?.signature_image_url) {
    signedSignature = await signDoctorSignature(db, snap.signature_image_url);
  }

  return {
    certificate: cert.data,
    supporting: supporting.data ?? [],
    signedSignature,
  };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(dt);
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export default async function MedicalCertificatePrintPage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const baseUrl = await getBaseUrl();
  const data = await fetchCertificate(certificateId);
  const cert = data.certificate;
  const fallbackSupporting: SupportingSourceItem[] = Array.isArray(cert.supporting_data)
    ? (cert.supporting_data as SupportingSourceItem[])
    : [];
  const supportingSources: SupportingSourceItem[] =
    data.supporting.length > 0 ? data.supporting : fallbackSupporting;
  const supporting: SupportingDisplayItem[] = supportingSources.map(
    (item: SupportingSourceItem, idx: number): SupportingDisplayItem => ({
      id: String(item.id ?? `supporting-${idx}`),
      label: item.label || item.type || "Supporting data",
      summary: item.summary || "",
    }),
  );
  const physicalExam = cert.physical_exam || {};
  const verificationUrl = `${baseUrl}/verify/medical-certificate/${cert.verification_code}`;
  const qrSrc = `https://quickchart.io/qr?size=140&text=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="print-page-root flex justify-center bg-slate-100 min-h-screen py-8 print:block print:bg-white print:min-h-0 print:py-0">
      <div className="certificate-print-wrapper">
        <div className="page front page-break-after">
          <div className="page-watermark" aria-hidden />
          <header className="hero">
            <div className="hero-logo">
              <Image src="/wellserv-logo.png" alt="Wellserv" width={360} height={100} priority />
            </div>
            <div className="hero-title">
              <div className="hero-date">Issued on {formatDate(cert.issued_at)}</div>
              <h1>MEDICAL CERTIFICATE</h1>
              <span>Valid until {formatDate(cert.valid_until)}</span>
            </div>
          </header>

          <section className="attestation">
            <div className="attestation-heading">PATIENT INFORMATION</div>
            <div className="attestation-grid">
              <div><strong>Name:</strong> {cert.patient_full_name}</div>
              <div><strong>Patient ID:</strong> {cert.patient_id}</div>
              <div><strong>Date of Birth:</strong> {formatDate(cert.patient_birthdate)}</div>
              <div><strong>Age:</strong> {cert.patient_age ?? "—"}</div>
              <div><strong>Sex:</strong> {(cert.patient_sex || "").toString().toUpperCase()}</div>
              <div className="full"><strong>Address:</strong> {cert.patient_address || "—"}</div>
            </div>
            <p className="attestation-text">
              I hereby certify that the information I disclosed, as reflected in this certificate, are true and correct to the best of my knowledge and belief. I understand that any misrepresentation or concealment on my part may lead to consequences which may include termination, legal prosecution, expulsion, or disqualification. I authorize WELLSERV MEDICAL CORPORATION and its designated medical staff to conduct necessary examinations related to my consultation.
            </p>
            <p className="attestation-text">
              I consent to the release of my medical findings to the requesting party as required. By signing below, I hold WELLSERV MEDICAL CORPORATION, its physicians, and staff free from any administrative, ethical, or moral liability arising from this issuance.
            </p>
            <div className="patient-signature">
              <div className="sig-line" />
              <div className="sig-text">{cert.patient_full_name || "Patient"}</div>
              <div className="sig-caption">Name & Signature of Patient</div>
            </div>
          </section>

          <section className="page-break" aria-hidden />

          <section className="diagnosis-section">
            <header>
              <h2>Diagnosis & Recommendations</h2>
              <div className="meta">
                <div><strong>Certificate No.</strong> {cert.certificate_no}</div>
                <div><strong>Issued At</strong> {formatDateTime(cert.issued_at)}</div>
              </div>
            </header>
            <div className="card">
              <h3>Diagnosis</h3>
              <p>{cert.diagnosis_text || "—"}</p>
            </div>
            {cert.findings_summary && (
              <div className="card">
                <h3>Findings Summary</h3>
                <p>{cert.findings_summary}</p>
              </div>
            )}
            <div className="grid two gap">
              <div className="card">
                <h3>Remarks</h3>
                <p>{cert.remarks || "—"}</p>
              </div>
              <div className="card">
                <h3>Advice</h3>
                <p>{cert.advice || "—"}</p>
              </div>
            </div>
          </section>

          <section className="doctor-signature">
            <div className="doctor-block">
              {data.signedSignature ? (
                <img src={data.signedSignature} alt="Doctor Signature" className="signature-img" />
              ) : (
                <div className="signature-placeholder">Not valid without Dr&apos;s signature:</div>
              )}
              <div className="sig-line" />
              <div className="sig-text">
                {(cert.doctor_snapshot?.full_name || cert.doctor_snapshot?.display_name || "Attending Physician")}
              </div>
              {cert.doctor_snapshot?.credentials && <div className="sig-caption">{cert.doctor_snapshot.credentials}</div>}
              {cert.doctor_snapshot?.prc_no && <div className="sig-caption">PRC No.: {cert.doctor_snapshot.prc_no}</div>}
            </div>
            <div className="qr-block">
              <img src={qrSrc} alt="Verification QR" className="qr-img" />
              <div className="qr-text">
                Verify via <span className="url">{verificationUrl}</span>
                <div className="code">Code: {cert.verification_code}</div>
              </div>
            </div>
          </section>
        </div>

        <div className="page back avoid-page-break">
          <div className="page-watermark" aria-hidden />
          <section className="section avoid-page-break">
            <h2>Review of Systems</h2>
            <table className="exam-table avoid-page-break">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(physicalExam).map(([key, entry]: any) => (
                  <tr key={key}>
                    <td className="label">{key}</td>
                    <td className={entry?.status === "abnormal" ? "status abnormal" : "status normal"}>
                      {entry?.status === "abnormal" ? "Abnormal" : "Normal"}
                    </td>
                    <td>{entry?.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="section tight avoid-page-break">
            <h2>Supporting Data</h2>
            {supporting.length === 0 && <p className="text-muted">No supporting entries recorded.</p>}
            {supporting.length > 0 && (
              <ul className="supporting-list">
                {supporting.map((item) => (
                  <li key={item.id}>
                    <span className="supporting-label">{item.label}</span>
                    <span className="supporting-text">{item.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="back-footer">
            <div className="ref">
              <span>Consultation ID: {cert.consultation_id}</span>
              <span>Encounter ID: {cert.encounter_id}</span>
            </div>
            <div className="ref certificate-line">
              <span>Certificate No.: {cert.certificate_no}</span>
            </div>
            <div className="corp">
              WELLSERV MEDICAL CORPORATION · San Isidro, Nueva Ecija · Tel: 0993-985-4927 · San Leonardo, Nueva Ecija · Tel: 0994-276-0253
            </div>
          </footer>
        </div>

        <style>{`
        :root { --accent: #2e6468; }
        body { background: #f1f5f9; }
        .print-page-root { width: 100%; color: #0f172a; font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial; }
        .certificate-print-wrapper { margin: 0 auto; width: 100%; max-width: 900px; background: #fff; box-shadow: 0 15px 30px rgba(15, 23, 42, 0.08); }
        .page { background: #fff; margin: 0 auto 26px; padding: 0.85in 0.9in; min-height: 13in; position: relative; overflow: hidden; width: 100%; }
        .page-watermark {
          position: absolute;
          inset: 1.2in 1in;
          background: url("/logo.png") center/contain no-repeat;
          opacity: 0.04;
          filter: grayscale(1);
          z-index: 0;
        }
        .page > *:not(.page-watermark) { position: relative; z-index: 1; }
        .hero { text-align: center; border-bottom: 2px solid #dbeafe; padding-bottom: 4mm; position: relative; }
        .hero-logo { display: flex; justify-content: center; }
        .hero-logo img { height: 70px; width: auto; }
        .hero-title { margin-top: 3mm; }
        .hero-date { position: absolute; right: 0; top: 16mm; font-size: 11px; color: #475569; }
        .hero-title h1 { margin: 4mm 0 2mm; font-size: 30px; letter-spacing: 0.28em; color: #1e293b; }
        .hero-title span { display: block; font-size: 11px; color: #475569; }
        .attestation { margin-top: 6mm; font-size: 12px; }
        .attestation-heading { font-weight: 700; letter-spacing: 0.2em; color: var(--accent); margin-bottom: 4mm; }
        .attestation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2mm 5mm; }
        .attestation-grid .full { grid-column: 1 / -1; }
        .attestation-text { margin-top: 3mm; line-height: 1.45; text-align: justify; }
        .patient-signature { margin-top: 6mm; text-align: center; }
        .patient-signature .sig-line { width: 60%; margin: 6mm auto 3mm; border-top: 1px solid #0f172a; }
        .patient-signature .sig-text { font-weight: 600; text-transform: uppercase; }
        .patient-signature .sig-caption { font-size: 11px; color: #475569; }
        .page-break { height: 1px; margin: 8mm 0; border-top: 1px dashed #e2e8f0; }
        .diagnosis-section h2 { letter-spacing: 0.18em; font-size: 14px; color: var(--accent); }
        .diagnosis-section .meta { font-size: 11px; color: #475569; display: flex; gap: 6mm; margin: 2mm 0 5mm; flex-wrap: wrap; }
        .card { border: 1px solid #e2e8f0; padding: 5mm; border-radius: 8px; margin-bottom: 5mm; background: #f8fafc; }
        .card h3 { margin: 0 0 2mm; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f172a; }
        .card p { margin: 0; line-height: 1.4; font-size: 11.5px; }
        .grid.two.gap { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm; }
        .doctor-signature { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6mm; gap: 6mm; }
        .doctor-block { text-align: center; }
        .signature-img { height: 56px; width: auto; }
        .signature-placeholder { height: 56px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; border: 1px dashed #cbd5f5; padding: 2mm; }
        .sig-caption { font-size: 11px; color: #475569; }
        .qr-block { display: flex; align-items: center; gap: 3mm; }
        .qr-img { width: 110px; height: 110px; border: 1px solid #e2e8f0; padding: 2mm; }
        .qr-text { font-size: 11px; max-width: 46mm; }
        .qr-text .url { display: block; word-break: break-word; font-weight: 600; }
        .qr-text .code { margin-top: 2mm; font-weight: 600; }
        .back { padding-top: 0.5in; }
        .section { margin-top: 0.45in; }
        .section.tight { margin-top: 0.2in; }
        .page.back .section:first-of-type { margin-top: 0; }
        .section h2 { font-size: 15px; letter-spacing: 0.2em; color: var(--accent); margin-bottom: 6mm; }
        .exam-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .exam-table th { text-align: left; background: #f1f5f9; padding: 6px 8px; border-bottom: 1px solid #dbeafe; font-weight: 600; }
        .exam-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
        .exam-table td.label { text-transform: capitalize; font-weight: 500; }
        .status.normal { color: #15803d; font-weight: 600; }
        .status.abnormal { color: #b91c1c; font-weight: 600; }
        .supporting-list { list-style: none; padding: 0; margin: 0; }
        .supporting-list li { display: flex; gap: 6mm; padding: 4mm 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .supporting-label { font-weight: 600; min-width: 38mm; }
        .back-footer {
          position: absolute;
          bottom: 0.4in;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: calc(100% - 1.6in);
          font-size: 10px;
          color: #475569;
          display: flex;
          flex-direction: column;
          gap: 2mm;
          text-align: center;
          align-items: center;
        }
        .back-footer .ref {
          display: inline-flex;
          gap: 8mm;
          flex-wrap: nowrap;
          justify-content: center;
          font-size: 9px;
          white-space: nowrap;
        }
        .back-footer .ref.certificate-line { margin-top: 1mm; }
        .back-footer .ref span {
          white-space: nowrap;
        }
        .back-footer .corp { font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; width: 100%; }
        @media print {
          body { background: #fff; }
          .certificate-print-wrapper { max-width: none; box-shadow: none; }
          .page { box-shadow: none !important; margin: 0 auto; padding: 0.65in 0.85in; width: 8in; min-height: 13in; }
          .page + .page { margin-top: 0; }
          .attestation { margin-top: 5mm; }
          .attestation-text { margin-top: 2.5mm; }
          .patient-signature { margin-top: 5mm; }
          .page-break { margin: 6mm 0; }
          .diagnosis-section .meta { margin: 2mm 0 4mm; }
          .card { margin-bottom: 4mm; }
          .doctor-signature { margin-top: 5mm; }
          .qr-img { width: 100px; height: 100px; }
          .back-footer { position: relative; bottom: auto; left: auto; right: auto; margin-top: 0.6in; width: 100%; }
        }
      `}</style>
      </div>
    </div>
  );
}
