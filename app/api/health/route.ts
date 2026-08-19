import { NextResponse } from "next/server";

// The app itself holds no data now; PocketBase reports on its own health.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
