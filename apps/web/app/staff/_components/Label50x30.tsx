"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  patient_id: string;
  full_name: string; // "SURNAME, FIRSTNAME"
  sex?: string | null;
  age?: number | null;
  date_label: string; // e.g., "2025-10-18" or "Oct 18, 2025"
  branch: "SI" | "SL";
};

export default function Label50x30({ patient_id, full_name, sex, age, date_label, branch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [printedDate, setPrintedDate] = useState<string>(date_label);
  const formatToday = useCallback(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, patient_id, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 34, // fits 30mm height with margins
        width: 1.6, // adjust stroke weight to your printer
      });
    } catch {}
  }, [patient_id]);

  useEffect(() => {
    setPrintedDate(date_label);
  }, [date_label]);

  useEffect(() => {
    const updateDate = () => setPrintedDate(formatToday());
    window.addEventListener("beforeprint", updateDate);
    window.addEventListener("prepare-print", updateDate);
    return () => {
      window.removeEventListener("beforeprint", updateDate);
      window.removeEventListener("prepare-print", updateDate);
    };
  }, [formatToday]);

  return (
    <div className="label-50x30">
      <div className="row top">
        <div className="branch">{branch}</div>
      </div>
      <div className="name">{full_name}</div>
      <div className="row meta">
        <div className="meta-item">Sex: {sex || "-"}</div>
        <div className="meta-item">Age: {Number.isFinite(age as any) ? age : "-"}</div>
        <div className="meta-item">Date: {printedDate || "-"}</div>
      </div>
      <svg ref={svgRef} />
      <div className="pid">{patient_id}</div>
      <style jsx global>{`
        /* Print surface: 50mm x 30mm, no margin */
        @media print {
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
          body {
            margin: 0;
          }
        }
      `}</style>
      <style jsx>{`
        .label-50x30 {
          width: 50mm;
          height: 30mm;
          padding: 1.8mm 2mm;
          display: flex;
          flex-direction: column;
          gap: 0.4mm;
          box-sizing: border-box;
          font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            Segoe UI,
            Roboto,
            "Helvetica Neue",
            Arial;
        }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .top {
          justify-content: flex-end;
        }
        .top .branch {
          font-size: 10.5px;
          background: #e5f3f4;
          color: #345c5f;
          padding: 0 4px;
          border-radius: 4px;
        }
        .name {
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row.meta {
          gap: 4px;
          font-size: 9.5px;
          color: #333;
        }
        svg {
          width: 100%;
          height: 10.5mm;
          margin-top: 0.2mm;
        }
        .pid {
          margin-top: 0.2mm;
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.4px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media screen {
          .label-50x30 {
            border: 1px dashed #cbd5e1;
            background: white;
          }
        }
      `}</style>
    </div>
  );
}
