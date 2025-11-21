// app/login/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

function LoginPageContent() {
  const [pid, setPid] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingDots, setLoadingDots] = useState(0);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [isVeryLong, setIsVeryLong] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = useMemo(() => search.get("next") || "/patient", [search]);
  const redirectTarget = useMemo(() => {
    const path = nextPath || "/patient";
    return path.startsWith("/") ? path : "/patient";
  }, [nextPath]);

  // pull config (clinic header + optional custom privacy copy)
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

  // Always require an Access Code (server will validate via PATIENT_PORTAL_ACCESS_CODE)
  const needsCode = true;

  useEffect(() => {
    if (!loading) {
      setLoadingDots(0);
      setIsTakingLong(false);
      setIsVeryLong(false);
      return;
    }
    const dots = window.setInterval(() => {
      setLoadingDots((prev) => ((prev + 1) % 3));
    }, 400);
    const longTimer = window.setTimeout(() => setIsTakingLong(true), 2500);
    const veryLongTimer = window.setTimeout(() => setIsVeryLong(true), 6000);
    return () => {
      window.clearInterval(dots);
      window.clearTimeout(longTimer);
      window.clearTimeout(veryLongTimer);
    };
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const patient_id = pid.trim();
    const access_code = code.trim();

    setErr(null);

    // client-side privacy + minimal checks
    if (!patient_id) {
      setErr("Please enter your Patient ID.");
      return;
    }
    if (needsCode && !access_code) {
      setErr("Please enter the Access Code.");
      return;
    }
    if (!consent) {
      setErr("Please tick the consent checkbox to continue.");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    let timeoutId: number | null = null;
    let hardNavTimer: number | null = null;
    let didSucceed = false;
    try {
      timeoutId = window.setTimeout(() => controller.abort(), 8000);
      // server validates access code + patient existence, sets httpOnly cookie, returns {ok:true}
      const res = await fetch("/api/auth/patient/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patient_id, access_code, remember: true }),
        signal: controller.signal,
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j?.ok) {
        // mirror common errors
        if (res.status === 401) setErr("Invalid access code. Please try again.");
        else if (res.status === 404) setErr("No matching Patient ID. Please check and try again.");
        else setErr(j?.error || "Something went wrong. Please try again.");
        return;
      }

      // success: cookie already set by server → go to new landing page
      didSucceed = true;
      router.replace(redirectTarget);

      // In rare cases SPA navigation stalls, force a hard reload so patients don't get stuck.
      const targetPath = (() => {
        try {
          return new URL(redirectTarget, window.location.origin).pathname;
        } catch {
          return "/patient";
        }
      })();
      hardNavTimer = window.setTimeout(() => {
        if (window.location.pathname !== targetPath) {
          window.location.assign(redirectTarget);
        }
      }, 900);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setErr("Login is taking longer than expected. Please try again.");
      } else {
        setErr("Network error. Please try again.");
      }
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (!didSucceed && hardNavTimer !== null) window.clearTimeout(hardNavTimer);
      if (!didSucceed) setLoading(false);
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
    <>
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
          <img
            src="/wellserv-logo.png"
            alt="WELLSERV"
            style={{ display: "block", margin: "0 auto 20px", height: 120, objectFit: "contain" }}
          />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Patient Portal</h1>
          <p style={{ margin: "6px 0 0 0", color: "#000000ff", fontSize: 13 }}>
            {ready && (<>Enter your Patient ID and Access Code to view your results.</>)}
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

          {/* Access Code */}
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
            className={`login-btn${loading ? " loading" : ""}`}
            disabled={
              loading ||
              pid.trim() === "" ||
              !consent ||
              (needsCode && code.trim() === "")
            }
          >
            {loading ? (
              <span className="login-btn__content">
                <span className="spinner" aria-hidden />
                <span className="btn-text">
                  Checking{".".repeat(loadingDots + 1)}
                </span>
              </span>
            ) : (
              "Continue"
            )}
          </button>

          {loading && (
            <div
              className={`loading-note${isVeryLong ? " loading-note--alert" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 12,
                color: isVeryLong ? "#b45309" : "#0f766e",
                background: isVeryLong ? "rgba(251, 191, 36, 0.12)" : "rgba(15, 118, 110, 0.08)",
                border: isVeryLong ? "1px solid rgba(217, 119, 6, 0.3)" : "1px solid rgba(45, 212, 191, 0.3)",
                padding: "8px 10px",
                borderRadius: 10,
                textAlign: "center",
              }}
            >
              {isVeryLong ? "Still verifying… please wait a moment longer or try again soon." : "Hang tight, we’re verifying your access."}
            </div>
          )}

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
      <style jsx>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes gentlePulse {
        0%, 100% { opacity: 0.9; transform: translateY(0); }
        50% { opacity: 1; transform: translateY(-1px); }
      }
      @keyframes alertPulse {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }
      .login-btn.loading .spinner {
        animation: spin 0.8s linear infinite;
      }
      .login-btn.loading .btn-text {
        letter-spacing: 0.4px;
      }
      .login-btn__content {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.55);
        border-top-color: rgba(255, 255, 255, 0.95);
      }
      .loading-note {
        animation: gentlePulse 1.8s ease-in-out infinite;
      }
      .loading-note--alert {
        animation: alertPulse 1.4s ease-in-out infinite;
      }
      `}</style>
    </>
  );
}

function LoginPageFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 12,
          border: "1px solid rgba(15, 118, 110, 0.15)",
          background: "#ffffff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
          color: "#0f766e",
          fontSize: 13,
        }}
      >
        Preparing the portal…
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
