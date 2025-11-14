//app/(doctor)/doctor/patient/[patientId]/ConsentModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";

function useDrawPad(active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!active) return; // only wire up when modal is open

    const c = canvasRef.current;
    if (!c) return;

    // Important for touch devices (disables scroll/pinch on the canvas area)
    c.style.touchAction = "none";

    // Use the intrinsic width/height attributes as the backing store.
    // (Avoid DPR transforms which can end up zero-sized on first layout.)
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";

    let drawing = false;

    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e: PointerEvent) => {
      drawing = true;
      c.setPointerCapture?.(e.pointerId);
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01); // tiny dot so a tap leaves a mark
      ctx.stroke();
      setHasInk(true);
      e.preventDefault();
    };

    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasInk(true);
      e.preventDefault();
    };

    const up = (e: PointerEvent) => {
      drawing = false;
      c.releasePointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    // Non-passive so preventDefault() works on mobile
    c.addEventListener("pointerdown", down, { passive: false });
    c.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up, { passive: false });

    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [active]);

  const toDataURL = () => canvasRef.current?.toDataURL("image/png") ?? "";
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  return { canvasRef, toDataURL, clear, hasInk };
}


export default function ConsentModal({
  isOpen,
  onClose,
  onSaved,
  consultationId,
  encounterId,
  patientId,
  templateSlug = "yakap-consent",
  templateVersion = 1,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  consultationId: string;
  encounterId: string;
  patientId: string;
  templateSlug?: string;
  templateVersion?: number;
}) {
    // was: const doc = useDrawPad(isOpen); const pat = useDrawPad(isOpen);
    const [patientMethod, setPatientMethod] = useState<"drawn" | "typed">("drawn");
    const [useStoredDocSig, setUseStoredDocSig] = useState(true);

    const doc = useDrawPad(isOpen && !useStoredDocSig);           // 👈 only when doc canvas is shown
    const pat = useDrawPad(isOpen && patientMethod === "drawn");  // 👈 only when patient canvas is shown


  const [doctorAttest, setDoctorAttest] = useState(false);
    const [patientTyped, setPatientTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signer, setSigner] =
    useState<'patient' | 'guardian' | 'representative'>('patient');
    const [signerName, setSignerName] = useState('');
    const [signerRelation, setSignerRelation] = useState('');


  useEffect(() => {
    if (!isOpen) return;
    setDoctorAttest(false);
    setUseStoredDocSig(true);
    setPatientMethod("drawn");
    setPatientTyped("");
    setSigner('patient');        // add
    setSignerName('');           // add
    setSignerRelation('');       // add

    setErr(null);
    doc.clear();   // 👈 add
  pat.clear();  
  }, [isOpen]);

  if (!isOpen) return null;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);

    try {
      const payload: any = {
        consultation_id: consultationId,
        encounter_id: encounterId,
        patient_id: patientId,
        template_slug: templateSlug,
        template_version: templateVersion,
        doctor_attest: doctorAttest,
        use_stored_doctor_signature: useStoredDocSig,
        patient_method: patientMethod,
        signer_kind: signer,
        signer_name: signer === 'patient' ? null : signerName.trim(),
        signer_relation: signer === 'patient' ? null : signerRelation.trim(),
        };

        if (!useStoredDocSig) {
        payload.doctor_signature_data_url = doc.toDataURL();
        }
        if (patientMethod === 'drawn') {
        payload.patient_signature_data_url = pat.toDataURL();
        } else {
        payload.patient_typed_name = patientTyped || null;
        }

      const res = await fetch("/api/consents/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`);
      onSaved?.();
      onClose();
      // optional: alert success
      // alert("Consent saved.");
      // you can also dispatch a reload event if desired
      // location.reload();
    } catch (e: any) {
      setErr(e?.message || "Failed to save consent.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    doctorAttest &&
    (useStoredDocSig || doc.hasInk) &&
    (patientMethod === "drawn" ? pat.hasInk : !!patientTyped) &&
    (signer === 'patient' ? true : (signerName.trim().length > 0 && signerRelation.trim().length > 0));


  return (
    <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Consent & Attestation</h3>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <p className="text-gray-700">
            I certify that the services recorded for this consultation were rendered, and I have informed the
            patient about the nature and purpose of the procedures, including limitations of electronic submissions.
          </p>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={doctorAttest} onChange={(e) => setDoctorAttest(e.target.checked)} />
            <span>Doctor attestation</span>
          </label>

          {/* Doctor signature */}
          <div className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Doctor’s signature</div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={useStoredDocSig}
                  onChange={(e) => setUseStoredDocSig(e.target.checked)}
                />
                <span>Use stored signature (if available)</span>
              </label>
            </div>
            {!useStoredDocSig && (
              <div className="space-y-2">
                <canvas key={`doc-${String(useStoredDocSig)}`} ref={doc.canvasRef} width={600} height={160} className="w-full border rounded" style={{ touchAction: "none" }}/>
                <div className="flex gap-2">
                  <button onClick={doc.clear} className="border rounded px-3 py-1">Clear</button>
                </div>
              </div>
            )}
          </div>

          {/* Patient signature */}
          <div className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-4">
              <div className="font-medium">Patient consent</div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="pmethod"
                  checked={patientMethod === "drawn"}
                  onChange={() => setPatientMethod("drawn")}
                />
                <span>Draw signature</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="pmethod"
                  checked={patientMethod === "typed"}
                  onChange={() => setPatientMethod("typed")}
                />
                <span>Type name (fallback)</span>
              </label>
            </div>

            {patientMethod === "drawn" ? (
              <div className="space-y-2">
                <canvas key={`pat-${patientMethod}`} ref={pat.canvasRef} width={600} height={160} className="w-full border rounded" style={{ touchAction: "none" }} />
                <div className="flex gap-2">
                  <button onClick={pat.clear} className="border rounded px-3 py-1">Clear</button>
                </div>
              </div>
            ) : (
              <input
                className="border rounded px-2 py-2 w-full"
                placeholder="Type patient's full name"
                value={patientTyped}
                onChange={(e) => setPatientTyped(e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <label className="font-medium mr-2">Signed by</label>
            <label className="flex items-center gap-1">
                <input type="radio" name="signer" defaultChecked onChange={() => setSigner('patient')} />
                Patient
            </label>
            <label className="flex items-center gap-1">
                <input type="radio" name="signer" onChange={() => setSigner('guardian')} />
                Guardian
            </label>
            <label className="flex items-center gap-1">
                <input type="radio" name="signer" onChange={() => setSigner('representative')} />
                Representative
            </label>
        </div>

        {signer !== 'patient' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <input
                className="border rounded px-2 py-2"
                placeholder="Signer full name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                />
                <input
                className="border rounded px-2 py-2"
                placeholder="Relationship (e.g., Mother)"
                value={signerRelation}
                onChange={(e) => setSignerRelation(e.target.value)}
                />
        </div>
        )}


          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button className="border rounded px-3 py-2" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="rounded px-4 py-2 text-white disabled:opacity-50"
            style={{ background: "#44969b" }}
            onClick={submit}
            disabled={!canSubmit || busy}
          >
            {busy ? "Saving…" : "Save consent"}
          </button>
        </div>
      </div>
    </div>
  );
}
