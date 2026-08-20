import { json } from "@sveltejs/kit";

// The app itself holds no data now; PocketBase reports on its own health.
export function GET() {
  return json({ status: "ok" });
}
