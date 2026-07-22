import { NextResponse } from "next/server";

// Obligatoire : sans cela, Next 14 optimise statiquement ce GET au build
// et servirait une réponse figée — le healthcheck renverrait 200 même
// application morte.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
