import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({
      ok: true,
      service: "endpoint-builders",
      mongo: "up",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Health check failed", error);
    return NextResponse.json(
      {
        ok: false,
        service: "endpoint-builders",
        mongo: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
