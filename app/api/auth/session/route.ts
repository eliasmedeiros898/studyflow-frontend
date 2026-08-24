import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080/api";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("studyflow_session")?.value;
  if (!token) return Response.json({ authenticated: false });
  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      cookieStore.delete("studyflow_session");
      return Response.json({ authenticated: false });
    }
    return Response.json({ authenticated: true, user: await response.json() });
  } catch {
    return Response.json({ authenticated: false, backendUnavailable: true });
  }
}
