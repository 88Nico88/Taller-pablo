import jwt from "jsonwebtoken";
import { config } from "../../../lib/config.js";
import { getStore } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

const FLOWSTOCK_ORIGIN = process.env.FLOWSTOCK_REPUESTOS_ORIGIN || "http://127.0.0.1:8090";
const EMBEDDED_ACCOUNT = {
  email: config.adminEmail,
  password: config.adminPassword
};

function cookieToken(request) {
  return (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("taller_session="))
    ?.slice("taller_session=".length) || "";
}

async function requirePortalSession(request) {
  const token = cookieToken(request);
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = typeof decoded === "object" ? decoded.sub : undefined;
    if (!userId) return false;
    const user = await getStore().findUserById(userId);
    return Boolean(user?.active);
  } catch {
    return false;
  }
}

function rewriteText(path, contentType, text) {
  if (contentType.includes("text/html")) {
    return text.replace("<head>", '<head><base href="/flowstock-repuestos/">');
  }
  if (path.endsWith("app.js") || contentType.includes("javascript")) {
    return text
      .replaceAll('"/api/', '"/flowstock-repuestos/api/')
      .replaceAll("'/api/", "'/flowstock-repuestos/api/")
      .replaceAll("`/api/", "`/flowstock-repuestos/api/");
  }
  return text;
}

async function proxy(request, context) {
  if (!(await requirePortalSession(request))) {
    return new Response("Acceso privado", { status: 401 });
  }

  const params = await context.params;
  const path = (params?.path || []).join("/");
  const url = new URL(request.url);
  const target = new URL(`/${path}`, FLOWSTOCK_ORIGIN);
  target.search = url.search;
  const shouldOpenEmbeddedSession =
    request.method === "GET" &&
    path === "" &&
    url.searchParams.get("embedded") === "1" &&
    !request.headers.get("cookie")?.includes("flowstock_session=");

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (["host", "connection", "content-length", "accept-encoding"].includes(key.toLowerCase())) continue;
    headers.set(key, value);
  }

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: "manual"
  });

  const responseHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    if (["content-length", "content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) continue;
    responseHeaders.set(key, value);
  }

  if (shouldOpenEmbeddedSession) {
    const loginResponse = await fetch(new URL("/api/auth/login", FLOWSTOCK_ORIGIN), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(EMBEDDED_ACCOUNT),
      redirect: "manual"
    });
    const sessionCookie = loginResponse.headers.get("set-cookie");
    if (sessionCookie) responseHeaders.set("set-cookie", sessionCookie);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html") || contentType.includes("javascript")) {
    const text = rewriteText(path, contentType, await response.text());
    responseHeaders.set("content-length", String(new TextEncoder().encode(text).length));
    return new Response(text, { status: response.status, headers: responseHeaders });
  }

  return new Response(await response.arrayBuffer(), { status: response.status, headers: responseHeaders });
}

export { proxy as GET, proxy as POST };
