// app/api/staff/encounters/today/route.ts
import { NextResponse } from "next/server";
import { readTodayEncounters } from "@/lib/todayEncounters";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const branch = (url.searchParams.get("branch") || "SI").toUpperCase();
    const consultOnly = url.searchParams.get("consultOnly") === "1";
    const includeDone = url.searchParams.get("includeDone") === "1"; // 👈 NEW
    const sortRaw = (url.searchParams.get("sort") || "").toLowerCase();
    const sort = sortRaw === "surname" ? "surname" : "latest";
    if (!["SI", "SL"].includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const rows = await readTodayEncounters({
      branch: branch as "SI" | "SL",
      consultOnly,
      includeDone,
      sort,
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}
