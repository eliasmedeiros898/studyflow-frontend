import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080/api";
const SESSION_COOKIE = "studyflow_session";

export async function POST(request: Request, context: RouteContext<"/api/auth/[action]">) {
  const { action } = await context.params;
  const cookieStore = await cookies();

  if (action === "logout") {
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ authenticated: false });
  }
  if (!["login", "register", "forgot-password", "reset-password"].includes(action)) {
    return NextResponse.json({ message: "Ação inválida." }, { status: 404 });
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });
    const payload = await backendResponse.json();
    if (!backendResponse.ok) {
      return NextResponse.json({ message: payload.message ?? "Não foi possível autenticar." }, { status: backendResponse.status });
    }

    if (action === "login" || action === "register") {
      cookieStore.set(SESSION_COOKIE, payload.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: payload.expiresIn,
        priority: "high",
      });
      return NextResponse.json({ authenticated: true, user: payload.user });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ message: "O servidor está indisponível. Tente novamente em instantes." }, { status: 503 });
  }
}
