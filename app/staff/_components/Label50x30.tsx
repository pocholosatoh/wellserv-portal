"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  patient_id: string;
  full_name: string;    // "SURNAME, FIRSTNAME"
  sex?: string | null;
  age?: number | null;
  date_label: string;   // e.g., "2025-10-18" or "Oct 18, 2025"
  branch: "SI" | "SL";
};

export default function Label50x30({ patient_id, full_name, sex, age, date_label, branch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, patient_id, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 34,  // fits 30mm height with margins
        width: 1.6,  // adjust stroke weight to your printer
      });
    } catch {}
  }, [patient_id]);

  return (
    <div className="label-50x30">
      <div className="row top">
        <div className="pid">{patient_id}</div>
        <div className="branch">{branch}</div>
      </div>
      <div className="name">{full_name}</div>
      <div className="row meta">
        <div className="meta-item">Sex: {sex || "-"}</div>
        <div className="meta-item">Age: {Number.isFinite(age as any) ? age : "-"}</div>
        <div className="meta-item">Date: {date_label}</div>
      </div>
      <svg ref={svgRef} />
      <style jsx global>{`
        /* Print surface: 50mm x 30mm, no margin */
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          body { margin: 0; }
        }
      `}</style>
      <style jsx>{`
        .label-50x30 {
          width: 50mm;
          height: 30mm;
          padding: 2mm 2mm 1mm;
          box-sizing: border-box;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        }
        .row { display: flex; align-items: center; justify-content: space-between; }
        .top .pid { font-weight: 700; font-size: 12px; letter-spacing: 0.4px; }
        .top .branch {
          font-size: 11px;
          background: #e5f3f4;
          color: #345c5f;
          padding: 0 4px; border-radius: 4px;
        }
        .name { margin-top: 1mm; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row.meta { gap: 4px; margin-top: 0.5mm; font-size: 10px; color: #333; }
        svg { width: 100%; height: 12mm; margin-top: 0.5mm; }
        @media screen {
          .label-50x30 { border: 1px dashed #cbd5e1; background: white; }
        }
      `}</style>
    </div>
  );
}
