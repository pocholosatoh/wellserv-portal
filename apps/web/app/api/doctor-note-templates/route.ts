// app/api/doctor-note-templates/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

type TemplateType = "SOAP" | "MARKDOWN";

type NoteTemplate = {
  id: string;
  doctor_id: string | null;
  title: string;
  template_type: TemplateType;
  soap_template?: Record<string, string | null> | null;
  markdown_template?: string | null;
  is_system?: boolean | null;
};

const validTypes = new Set<TemplateType>(["SOAP", "MARKDOWN"]);

const isUuid = (v?: string | null) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function cleanTitle(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (m) => `\\${m}`);
}

function sortTemplates(list: NoteTemplate[]) {
  return [...list].sort((a, b) => {
    const sysA = a.is_system ? 1 : 0;
    const sysB = b.is_system ? 1 : 0;
    if (sysA !== sysB) return sysB - sysA; // system first
    return (a.title || "").localeCompare(b.title || "");
  });
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;
    if (actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const typeRaw = (
      url.searchParams.get("type") ||
      url.searchParams.get("template_type") ||
      ""
    ).toUpperCase();
    const searchRaw = url.searchParams.get("q") || url.searchParams.get("search") || "";
    const type = typeRaw as TemplateType;

    if (!validTypes.has(type)) {
      return NextResponse.json(
        { error: "template_type must be SOAP or MARKDOWN" },
        { status: 400 },
      );
    }

    const db = getSupabase();
    let query = db
      .from("note_templates")
      .select("id, doctor_id, title, template_type, soap_template, markdown_template, is_system")
      .eq("template_type", type)
      .or(`is_system.eq.true,doctor_id.eq.${actor.id}`);

    const trimmed = searchRaw.trim();
    if (trimmed) {
      const escaped = escapeIlike(trimmed);
      query = query.ilike("title", `%${escaped}%`);
    }

    const { data, error } = await query
      .order("is_system", { ascending: false })
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ templates: sortTemplates(data || []) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;
    if (actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const typeRaw = (body?.template_type || body?.type || "").toString().toUpperCase();
    const type = typeRaw as TemplateType;
    const title = cleanTitle(body?.title);

    if (!validTypes.has(type)) {
      return NextResponse.json(
        { error: "template_type must be SOAP or MARKDOWN" },
        { status: 400 },
      );
    }
    if (!title) {
      return NextResponse.json({ error: "Template title is required" }, { status: 400 });
    }
    if (!isUuid(actor.id)) {
      return NextResponse.json(
        { error: "Only regular doctors can save templates." },
        { status: 400 },
      );
    }

    let soap_template: Record<string, string> | null = null;
    let markdown_template: string | null = null;

    if (type === "SOAP") {
      const src = (body?.soap_template || body?.soapTemplate || {}) as Record<string, any>;
      soap_template = {
        S: typeof src.S === "string" ? src.S : typeof src.s === "string" ? src.s : "",
        O: typeof src.O === "string" ? src.O : typeof src.o === "string" ? src.o : "",
        A: typeof src.A === "string" ? src.A : typeof src.a === "string" ? src.a : "",
        P: typeof src.P === "string" ? src.P : typeof src.p === "string" ? src.p : "",
      };
    } else if (type === "MARKDOWN") {
      const md = body?.markdown_template ?? body?.markdownTemplate ?? body?.content ?? "";
      markdown_template = typeof md === "string" ? md : String(md ?? "");
    }

    if (type === "SOAP" && !soap_template) {
      return NextResponse.json({ error: "SOAP template content is required" }, { status: 400 });
    }
    if (type === "MARKDOWN" && (markdown_template ?? "").trim() === "") {
      return NextResponse.json({ error: "Template content is required" }, { status: 400 });
    }

    const db = getSupabase();
    const insertPayload = {
      title,
      template_type: type,
      soap_template,
      markdown_template,
      doctor_id: actor.id,
      is_system: false,
    };

    const { data, error } = await db
      .from("note_templates")
      .insert(insertPayload)
      .select("id, doctor_id, title, template_type, soap_template, markdown_template, is_system")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
