"use client";
import { useState } from "react";

type ReportItem = { key:string; label:string; value:string; unit?:string; flag?:""|"L"|"H"|"A" };
type ReportSection = { name:string; items:ReportItem[] };
type Patient = { patient_id:string; full_name:string; age:string; sex:string; birthday:string; contact:string; address:string };
type Visit = { date_of_test:string; barcode:string; notes:string };

export default function Portal() {
  const [pid, setPid] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function search() {
    setErr(""); setLoading(true);
    const res = await fetch(`/api/report?patient_id=${encodeURIComponent(pid)}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(json?.error || "Error"); return; }
    setData(json);
  }

  const report = data?.reports?.[0] as { patient:Patient; visit:Visit; sections:ReportSection[] } | undefined;

  return (
    <div style={{padding:"16px", maxWidth:960, margin:"0 auto"}}>
      <h1 style={{fontSize:28, fontWeight:700}}>View Lab Results</h1>

      <div style={{display:"flex", gap:8, margin:"12px 0"}}>
        <input value={pid} onChange={e=>setPid(e.target.value)} placeholder="Enter Patient ID"
               style={{padding:"8px 10px", border:"1px solid #ccc", borderRadius:6, width:260}}/>
        <button onClick={search} disabled={loading || !pid}
                style={{padding:"8px 14px", borderRadius:6, border:"1px solid #222", background:"#222", color:"#fff"}}>
          {loading ? "Loading..." : "View"}
        </button>
        {report && (
          <button onClick={()=>window.print()}
                  style={{padding:"8px 14px", borderRadius:6, border:"1px solid #999", background:"#fff"}}>
            Print
          </button>
        )}
      </div>

      {err && <div style={{color:"#b00020"}}>{err}</div>}

      {report && (
        <>
          <div style={{margin:"12px 0"}}>
            <div style={{fontWeight:700}}>{report.patient.full_name}</div>
            <div>{report.patient.patient_id} • {report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}</div>
            <div>Date of Test: <b>{report.visit.date_of_test}</b></div>
            {report.visit.notes && <div>Overall Notes: {report.visit.notes}</div>}
          </div>

          {report.sections.map(section => (
            <div key={section.name} style={{marginTop:18}}>
              <h3 style={{fontSize:18, fontWeight:700, margin:"10px 0"}}>{section.name}</h3>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={{textAlign:"left", borderBottom:"1px solid #ddd", padding:"6px"}}>Parameter</th>
                    <th style={{textAlign:"right", borderBottom:"1px solid #ddd", padding:"6px"}}>Result</th>
                    <th style={{textAlign:"left", borderBottom:"1px solid #ddd", padding:"6px"}}>Unit</th>
                    <th style={{textAlign:"center", borderBottom:"1px solid #ddd", padding:"6px"}}>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map(it => (
                    <tr key={it.key}>
                      <td style={{padding:"6px"}}>{it.label}</td>
                      <td style={{padding:"6px", textAlign:"right"}}>{it.value}</td>
                      <td style={{padding:"6px"}}>{it.unit || ""}</td>
                      <td style={{padding:"6px", textAlign:"center",
                                  color: it.flag==="H" ? "#b00020" : it.flag==="L" ? "#1976d2" : it.flag==="A" ? "#f57c00" : "#666"}}>
                        {it.flag || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
