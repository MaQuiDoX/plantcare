// Servidor de contrato exclusivo de pruebas. No sustituye Supabase ni verifica RLS.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const users = new Map();
const secret = "plantcare-e2e-only-not-a-production-key";
const initial = { id: "a7157311-ace0-4a59-9200-000000000010", email: "ana@example.test", password: "mi jardín tiene hojas", confirmed: true, name: "Ana" };
users.set(initial.email, initial);
function authUser(user) {
  return { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, email_confirmed_at: user.confirmed ? "2026-01-01T00:00:00Z" : null, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { display_name: user.name }, identities: [], created_at: "2026-01-01T00:00:00Z" };
}
function token(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, iat: now, exp: now + 3600 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return { access_token: `${header}.${payload}.${signature}`, refresh_token: user.id, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: authUser(user) };
}
function bearerUser(request) {
  try {
    const jwt = request.headers.authorization?.replace("Bearer ", "");
    const [header, payload, signature] = jwt.split(".");
    if (signature !== createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    if (claims.exp <= Date.now() / 1000) return null;
    return [...users.values()].find((user) => user.id === claims.sub);
  } catch { return null; }
}

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:54329");
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const send = (status, value, headers = {}) => {
    response.writeHead(status, { "content-type": "application/json", ...headers });
    response.end(JSON.stringify(value));
  };
  const failure = (code, status = 400) => send(status, { code, error_code: code, msg: code, message: code });
  if (url.pathname === "/health") return send(200, { ok: true });
  if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(200, { keys: [] });
  if (url.pathname === "/auth/v1/signup") {
    let user = users.get(body.email);
    if (!user) {
      user = { id: randomUUID(), email: body.email, password: body.password, confirmed: false, name: body.data?.display_name ?? "" };
      users.set(body.email, user);
    }
    return send(200, authUser(user));
  }
  if (url.pathname === "/auth/v1/token") {
    const user = url.searchParams.get("grant_type") === "refresh_token"
      ? [...users.values()].find((item) => item.id === body.refresh_token) : users.get(body.email);
    if (!user || (body.password !== undefined && body.password !== user.password)) return failure("invalid_credentials");
    if (!user.confirmed) return failure("email_not_confirmed");
    return send(200, token(user));
  }
  if (url.pathname === "/auth/v1/verify") {
    const user = users.get(body.token_hash);
    if (!user) return failure("otp_expired");
    user.confirmed = true;
    return send(200, token(user));
  }
  if (["/auth/v1/recover", "/auth/v1/resend"].includes(url.pathname)) return send(200, {});
  if (url.pathname === "/auth/v1/logout") return send(204, null);
  const user = bearerUser(request);
  if (!user) return failure("bad_jwt", 401);
  if (url.pathname === "/auth/v1/user") {
    if (request.method === "PUT" && body.password) user.password = body.password;
    return send(200, authUser(user));
  }
  if (url.pathname === "/rest/v1/users") return send(200, { display_name: user.name });
  if (url.pathname === "/rest/v1/user_plants") {
    let plants = user.id === initial.id ? [
      { id: "b7157311-ace0-4a59-9200-000000000010", nickname: "Monstera del living", location_label: "Junto al sillón", placement: "indoor", created_at: "2026-09-01T12:00:00Z", plants: { scientific_name: "Monstera deliciosa" } },
      { id: "b7157311-ace0-4a59-9200-000000000011", nickname: "Lavanda del balcón", location_label: "Balcón", placement: "outdoor", created_at: "2026-08-01T12:00:00Z", plants: { scientific_name: "Lavandula angustifolia" } },
    ] : [];
    if (url.searchParams.get("placement") === "eq.indoor") plants = plants.filter((plant) => plant.placement === "indoor");
    const term = url.searchParams.get("nickname")?.replace(/^ilike\.%|%$/g, "");
    if (term) plants = plants.filter((plant) => plant.nickname.toLowerCase().includes(term.toLowerCase()));
    return send(200, plants, { "content-range": `0-${Math.max(0, plants.length - 1)}/${plants.length}` });
  }
  failure("not_found", 404);
}).listen(54329, "127.0.0.1", () => console.log("Contrato Supabase de pruebas en 54329"));
