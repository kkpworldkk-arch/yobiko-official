import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeSession } from "@/lib/session";

const ROLE_HOME: Record<string, string> = {
  teacher: "/dashboard",
  family: "/student",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get("session")?.value);

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isStudentRoute = pathname.startsWith("/student");
  const isLoginRoute = pathname === "/login";

  if ((isDashboardRoute || isStudentRoute) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isDashboardRoute && session.role !== "teacher") {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  if (session && isStudentRoute && session.role !== "family") {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  if (session && isLoginRoute) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*", "/login"],
};
