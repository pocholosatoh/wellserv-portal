// app/login/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// --- tiny helpers for image and formatting ---
function extractDriveId(url?: string) {
  const u = (url || "").trim();
  if (!u) return "";
  const uc = u.match(/[?&]id=([^&]+)/);
  if (uc?.[1]) return uc[1];
  const file = u.match(/\/file\/d\/([^/]+)/);
  if (file?.[1]) return file[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) return u;
  return "";
}
function driveImageUrls(url?: string) {
  const id = extractDriveId(url);
  if (!id) return { primary: "", fallback: "" };
  return {
    primary: `https://drive.google.com/uc?export=view&id=${id}`,
    fallback: `https://lh3.googleusercontent.com/d/${id}`,
  };
}

export default function LoginPage() {
  const [pid, setPid] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const router = useRouter();

  // pull config (clinic header + optional portal_access_code + optional custom privacy copy)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!ignore && j?.config) setCfg(j.config);
      } catch {}
    })();
    return () => { ignore = true; };
  }, []);

  const { primary: logoPrimary, fallback: logoFallback } = driveImageUrls(cfg.clinic_logo_url);
  const logoSrc = logoPrimary;

  const requiredAccessCode: string = useMemo(() => {
    const fromConfig = (cfg.portal_access_code || "").trim();
    if (fromConfig) return fromConfig;
    if (typeof window !== "undefined") {
      const fromEnv = (process.env.NEXT_PUBLIC_PORTAL_ACCESS_CODE || "").trim();
      if (fromEnv) return fromEnv;
    }
    return "";
  }, [cfg.portal_access_code]);

const needsCode = !!requiredAccessCode?.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patient_id = pid.trim();
    const token = code.trim();

    setErr(null);

    // client-side privacy + access checks (simple & minimal)
    if (!patient_id) {
      setErr("Please enter your Patient ID.");
      return;
    }
    if (!consent) {
      setErr("Please tick the consent checkbox to continue.");
      return;
    }
    if (requiredAccessCode && token.toLowerCase() !== requiredAccessCode.toLowerCase()) {
      setErr("Invalid access code. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // validate patient exists (your existing API)
      const res = await fetch("/api/patient-exists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patient_id }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setErr("No matching Patient ID. Please check and try again.");
        } else {
          const j = await res.json().catch(() => ({}));
          setErr(j?.error || "Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      // save session bits (short-lived)
      document.cookie = `patient_id=${encodeURIComponent(patient_id)}; path=/; max-age=86400`;
      if (requiredAccessCode) {
        document.cookie = `portal_token=1; path=/; max-age=86400`; // flag that the check passed
      }
      router.push("/patient-results");
    } catch {
      setErr("Network error. Please try again.");
      setLoading(false);
    }
  }

  // ---------- styles ----------
  const page: React.CSSProperties = {
    minHeight: "10dvh",
    padding: "0 16px",
    display: "grid",
    placeItems: "start center",
    paddingTop: "clamp(24px, 8vh, 80px)",
  };
  const clinicWrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    textAlign: "center",
    marginBottom: "0.75rem",
  };
  const clinic: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 8, margin: "4px 0 8px",
  };
  const clinicName: React.CSSProperties = { fontWeight: 800, fontSize: 18, lineHeight: 1.15 };
  const clinicSub:  React.CSSProperties = { color: "#444", fontSize: 13 };

  const card: React.CSSProperties = {
    width: "100%", maxWidth: 420, padding: "1.25rem", borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.98))",
    backdropFilter: "blur(4px)",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: "#555",
    marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase",
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid #d8dde3",
    borderRadius: 10, outline: "none", fontSize: 14,
  };
  const btn: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid #44969b", background: "#44969b", color: "#fff",
    fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.9 : 1, transition: "transform .05s ease, opacity .15s ease",
  };

  const footerNote: React.CSSProperties = {
    color: "#b4b4b5ff", fontSize: 12, textAlign: "center", lineHeight: 1.4,
  };

  const linkBtn: React.CSSProperties = {
    border: "none", background: "transparent", color: "#0f766e",
    fontSize: 12, padding: 0, cursor: "pointer", textDecoration: "underline",
  };

  const modalBackdrop: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
    display: showNotice ? "grid" : "none", placeItems: "center", zIndex: 50,
  };
  const modalCard: React.CSSProperties = {
    width: "min(92vw, 640px)", maxHeight: "80vh", overflow: "auto",
    background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    padding: "18px",
  };

  // default privacy notice text (can be overridden via Config)
  const privacyTitle = cfg.privacy_notice_title?.trim() || "Data Privacy Notice";
  const privacyBody = cfg.privacy_notice_body?.trim() || `
By continuing, you agree to the collection and processing of your personal and health information for the purpose of identity verification and releasing laboratory results, in accordance with the
Philippines Data Privacy Act of 2012 (RA 10173) and its IRR. Your data will be handled with
strict confidentiality and retained only as required by law and clinic policy. For questions or
requests (access, correction, deletion), contact our Data Protection Officer via the clinic number or email.
  `.trim();

  return (
    <main style={page}>
      {/* Header */}
      {(cfg.clinic_name || cfg.clinic_logo_url || cfg.clinic_address || cfg.clinic_phone) && (
        <div style={clinicWrap}>
          <div style={clinic}>
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                referrerPolicy="no-referrer"
                style={{ display: "block", margin: "0 auto", maxHeight: 150, objectFit: "contain" }}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const fb = logoFallback;
                  if (fb && img.src !== fb) img.src = fb;
                  else img.style.display = "none";
                }}
              />
            ) : null}
            <div>
              {cfg.clinic_name && <div style={clinicName}>{cfg.clinic_name}</div>}
              {cfg.clinic_address && <div style={clinicSub}>{cfg.clinic_address}</div>}
              {cfg.clinic_phone && <div style={clinicSub}>{cfg.clinic_phone}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Login card */}
      <div style={card}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Patient Portal</h1>
            <p style={{ margin: "6px 0 0 0", color: "#000000ff", fontSize: 13 }}>
              {ready && (
                <>Enter your Patient ID {needsCode ? "and Access Code " : ""} to view your results.</>
              )}
            </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label htmlFor="pid" style={label}>Patient ID</label>
          <input
            id="pid"
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            placeholder="e.g., SATOH010596"
            style={input}
          />

          {/* Access Code (Password) */}
          {true && (
            <>
              <label htmlFor="pcode" style={label}>Access Code</label>
              <input
                id="pcode"
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Access Code (ask staff 😉)"
                style={input}
              />
            </>
          )}

          {/* Consent */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#444", marginTop: 4 }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ transform: "translateY(2px)" }}
            />
            <span>
              I consent to the processing of my personal and health information for identity verification
              and results release as described in the{" "}
              <button type="button" style={linkBtn} onClick={() => setShowNotice(true)}>
                Data Privacy Notice
              </button>.
            </span>
          </label>

          {err && (
            <div style={{
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              color: "#b91c1c",
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13
            }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            style={btn}
            disabled={
              loading ||
              pid.trim() === "" ||
              !consent ||
              (needsCode && code.trim() === "")
            }
          >
            {loading ? "Checking..." : "Continue"}
          </button>

          <div style={footerNote}>
            Tip: Patient ID is not case sensitive.
          </div>
        </form>
      </div>

      {/* Privacy Notice Modal */}
      <div style={modalBackdrop} aria-hidden={!showNotice} onClick={() => setShowNotice(false)}>
        <div style={modalCard} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{privacyTitle}</h2>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 10, color: "#334155", fontSize: 14, whiteSpace: "pre-wrap" }}>
            {privacyBody}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d8dde3", background: "#fff", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
