import { NextResponse } from "next/server";
import { clientOptions } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ clients: clientOptions() });
}
