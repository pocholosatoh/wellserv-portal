import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDataProvider } from "@/lib/data/provider-factory";

// same helpers as patient route
function asStr(x: any) { if (x == null) return ""; const s = String(x); return s === "null" ? "" : s; }
function toNum(x: any): number | null { if (x == null) return null; const s = String(x).replace(/,/g,"").trim(); if (!s || s==="-" || s.toLowerCase()==="n/a") return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
function coerceFlag(f: any): ""|"L"|"H"|"A" { if (!f) return ""; const u = String(f).toUpperCase(); return (u==="L"||u==="H"||u==="A") ? (u as any) : ""; }
function ts(d?: string|null) { if(!d) return 0; const s=String(d).trim(); const t=Date.parse(s); if(!Number.isNaN(t)) return t; const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); if(m){ const a=parseInt(m[1],10), b=parseInt(m[2],10), y=m[3].length===2?2000+parseInt(m[3],10):parseInt(m[3],10); const isDMY=a>12; const month=(isDMY?b:a)-1; const day=isDMY?a:b; return new Date(y,month,day).getTime(); } return 0; }

function adaptPatientForUI(p:any){ return {
  patient_id: asStr(p?.patient_id), full_name: asStr(p?.full_name), age: asStr(p?.age),
  sex: asStr(p?.sex), birthday: asStr(p?.birthday), contact: asStr(p?.contact),
  address: asStr(p?.address), email: asStr(p?.email), height_ft: asStr(p?.height_ft),
  height_inch: asStr(p?.height_inch), weight_kg: asStr(p?.weight_kg),
  systolic_bp: asStr(p?.systolic_bp), diastolic_bp: asStr(p?.diastolic_bp),
  last_updated: asStr(p?.last_updated), present_illness_history: asStr(p?.present_illness_history),
  past_medical_history: asStr(p?.past_medical_history), past_surgical_history: asStr(p?.past_surgical_history),
  chief_complaint: asStr(p?.chief_complaint), allergies_text: asStr(p?.allergies_text),
  medications_current: asStr(p?.medications_current), medications: asStr(p?.medications ?? p?.medications_current),
  family_hx: asStr(p?.family_hx ?? p?.family_history), family_history: asStr(p?.family_history ?? p?.family_hx),
  smoking_hx: asStr(p?.smoking_hx), alcohol_hx: asStr(p?.alcohol_hx),
};}
function adaptReportForUI(report:any){ return {
  patient: adaptPatientForUI(report?.patient),
  visit: { date_of_test: asStr(report?.visit?.date_of_test), barcode: asStr(report?.visit?.barcode), notes: asStr(report?.visit?.notes), branch: asStr(report?.visit?.branch) },
  sections: (report?.sections||[]).map((sec:any)=>{ const name=asStr(sec?.name); const hideRF = name==="Urinalysis"||name==="Fecalysis";
    return { name, items: (sec?.items||[]).map((it:any)=>{ const low=toNum(it?.ref_low); const high=toNum(it?.ref_high);
      return { key:asStr(it?.key), label:asStr(it?.label), value:asStr(it?.value), unit:asStr(it?.unit), flag: hideRF?"":coerceFlag(it?.flag),
        ref: hideRF ? undefined : { low: low===null?undefined:low, high: high===null?undefined:high } };
    }).filter((it:any)=>it.value && it.value.trim()!=="") }; }).filter((s:any)=>s.items.length>0)
};}
async function buildAllReports(patient_id:string, limit?:number, specificDate?:string){
  const provider = await getDataProvider();
  const visits = await provider.getVisits(patient_id);
  const dates = specificDate ? visits.filter(v=>v.date_of_test===specificDate).map(v=>v.date_of_test) : visits.map(v=>v.date_of_test);
  const sorted = [...dates].sort((a,b)=>ts(b)-ts(a));
  const trimmed = typeof limit==="number" ? sorted.slice(0,limit) : sorted;
  const reports:any[] = [];
  for(const d of trimmed){ const rep = await provider.getReport({ patient_id, visitDate:d }); if(rep) reports.push(adaptReportForUI(rep)); }
  const config = (await provider.getConfig?.()) ?? {};
  return { reports, config };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "staff") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patient_id = String(searchParams.get("patient_id") || "").trim().toUpperCase();
  const visitDate = (searchParams.get("date") ?? undefined) || undefined;
  const limit = searchParams.get("limit"); 
  if (!patient_id) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

  const json = await buildAllReports(patient_id, limit!=null?Number(limit):undefined, visitDate);
  return NextResponse.json(json, { status: 200 });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "staff") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(()=>({}));
  const patient_id = String(body?.patient_id || "").trim().toUpperCase();
  const visitDate = body?.visitDate ? String(body.visitDate) : undefined;
  const limit = body?.limit != null ? Number(body.limit) : undefined;
  if (!patient_id) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

  const json = await buildAllReports(patient_id, limit, visitDate);
  return NextResponse.json(json, { status: 200 });
}
