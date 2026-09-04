import { NextResponse } from "next/server";
import { clientOptions } from "@/lib/clients";
import { getSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  return NextResponse.json({ clients: clientOptions() });
}
