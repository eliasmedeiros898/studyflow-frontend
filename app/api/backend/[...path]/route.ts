import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080/api";
const ALLOWED_ROOTS = new Set(["dashboard", "subjects", "tasks", "sessions", "reviews", "notifications", "profile", "preferences", "goals", "performance"]);

async function proxy(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  const { path } = await context.params;
  if (!path.length || !ALLOWED_ROOTS.has(path[0])) {
    return NextResponse.json({ message: "Rota não permitida." }, { status: 404 });
  }
  const token = (await cookies()).get("studyflow_session")?.value;
  if (!token) return NextResponse.json({ message: "Sessão expirada." }, { status: 401 });

  const target = new URL(`${BACKEND_URL}/${path.map(encodeURIComponent).join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (request.headers.get("content-type")) headers.set("Content-Type", request.headers.get("content-type")!);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
    });
    const result = new NextResponse(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
    if (response.status === 401) result.cookies.delete("studyflow_session");
    return result;
  } catch {
    return NextResponse.json({ message: "O servidor está indisponível." }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
