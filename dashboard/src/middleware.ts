import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * HTTP Basic simples: o dashboard fica exposto na internet pelo nginx e
 * mostra dados de cliente. Sem DASHBOARD_PASSWORD definido, a proteção
 * fica desligada (útil só em desenvolvimento local).
 */
export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  // O health check precisa responder sem credencial para o PM2/monitoramento.
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);
    if (user === (process.env.DASHBOARD_USER || "admin") && pass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Acesso restrito", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Dashboard de Marketing", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
