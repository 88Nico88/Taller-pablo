import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../../../lib/config.js";
import { json, requestError } from "../../../lib/api.js";
import { getStore, publicUser, normalizePlate } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

const optionalText = z.string().trim().min(1).optional();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const createCustomerSchema = z.object({
  name: z.string().trim().min(2),
  rut: optionalText,
  phone: z.string().trim().min(6),
  alternatePhone: optionalText,
  email: z.string().email().optional(),
  address: optionalText,
  notes: optionalText
});
const createVehicleSchema = z.object({
  customerId: z.uuid(),
  plate: z.string().trim().min(4).max(10),
  vin: optionalText,
  brand: z.string().trim().min(2),
  model: z.string().trim().min(1),
  version: optionalText,
  year: z.number().int().min(1900).max(2100).optional(),
  color: optionalText,
  mileage: z.number().int().min(0).default(0),
  permanentNotes: optionalText
});
const createWorkOrderSchema = z.object({
  vehicleId: z.uuid(),
  mechanicId: z.uuid().optional(),
  expectedDeliveryAt: z.string().datetime().optional(),
  mileage: z.number().int().min(0),
  fuelLevel: optionalText,
  reason: z.string().trim().min(3),
  symptoms: optionalText,
  initialDiagnosis: optionalText,
  finalDiagnosis: optionalText,
  priority: z.enum(["baja", "normal", "alta", "urgente"]).default("normal")
});
const updateWorkOrderStateSchema = z.object({
  state: z.enum(["recibido", "en_diagnostico", "esperando_aprobacion", "en_reparacion", "esperando_repuesto", "listo", "entregado", "detenido"])
});
const createInspectionSchema = z.object({
  system: z.string().trim().min(2),
  element: z.string().trim().min(2),
  state: z.enum(["bueno", "requiere_atencion", "requiere_reparacion", "no_revisado"]),
  comment: optionalText
});
const createPartSchema = z.object({
  sku: z.string().trim().min(2),
  name: z.string().trim().min(2),
  brand: optionalText,
  description: optionalText,
  cost: z.number().min(0),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  minimumStock: z.number().int().min(0).default(0),
  location: optionalText
});
const createPartsBulkSchema = z.object({
  parts: z.array(createPartSchema).min(1).max(500)
});
const consumePartSchema = z.object({ partId: z.uuid(), quantity: z.number().int().positive() });
const createPartSaleSchema = z.object({
  paymentMethod: z.enum(["Efectivo", "Transferencia", "Transbank"]).default("Efectivo"),
  items: z.array(z.object({ partId: z.uuid(), quantity: z.number().int().positive() })).min(1)
});

function segments(params) {
  return params?.segments || [];
}

async function readBody(request, schema) {
  const body = await request.json().catch(() => ({}));
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Object.assign(new Error("Datos invalidos"), {
      status: 400,
      details: result.error.issues
    });
  }
  return result.data;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "8h" });
}

function sessionCookie(token) {
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  return `taller_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`;
}

function expiredSessionCookie() {
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  return `taller_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function cookieToken(request) {
  return (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("taller_session="))
    ?.slice("taller_session=".length) || "";
}

async function requireAuth(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : cookieToken(request);
  if (!token) throw requestError("Missing token", 401);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = typeof decoded === "object" ? decoded.sub : undefined;
    if (!userId) throw new Error("Invalid token");
    const user = await getStore().findUserById(userId);
    if (!user?.active) throw new Error("Invalid token");
    return user;
  } catch {
    throw requestError("Invalid token", 401);
  }
}

async function dispatch(request, params) {
  const path = segments(params);
  const method = request.method;
  const store = getStore();

  if (method === "POST" && path.join("/") === "auth/login") {
    const input = await readBody(request, loginSchema);
    const user = await store.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw requestError("Credenciales invalidas", 401);
    }
    const token = signToken(user);
    return json(
      { token, user: publicUser(user) },
      { headers: { "Set-Cookie": sessionCookie(token) } }
    );
  }

  if (method === "POST" && path.join("/") === "auth/logout") {
    return json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
  }

  if (path.join("/") === "health") {
    return json({ status: "ok" });
  }

  const user = await requireAuth(request);

  if (method === "GET" && path.join("/") === "auth/me") return json({ user: publicUser(user) });
  if (method === "GET" && path.join("/") === "customers") return json({ data: await store.listCustomers() });
  if (method === "POST" && path.join("/") === "customers") return json({ data: await store.createCustomer(await readBody(request, createCustomerSchema)) }, { status: 201 });

  if (method === "GET" && path.join("/") === "vehicles") return json({ data: await store.listVehicles() });
  if (method === "POST" && path.join("/") === "vehicles") return json({ data: await store.createVehicle(await readBody(request, createVehicleSchema)) }, { status: 201 });
  if (method === "GET" && path[0] === "vehicles" && path[1] === "by-plate" && path[2]) {
    const vehicle = await store.findVehicleByPlate(decodeURIComponent(path[2]));
    if (!vehicle) throw requestError("Vehiculo no encontrado", 404);
    return json({ data: vehicle });
  }
  if (method === "GET" && path[0] === "vehicles" && path[1] && path[2] === "history") {
    return json({ data: await store.vehicleHistory(path[1]) });
  }

  if (method === "GET" && path.join("/") === "work-orders") return json({ data: await store.listWorkOrders() });
  if (method === "POST" && path.join("/") === "work-orders") {
    const input = await readBody(request, createWorkOrderSchema);
    return json({ data: await store.createWorkOrder({ ...input, receivedByUserId: user.id }) }, { status: 201 });
  }
  if (method === "PATCH" && path[0] === "work-orders" && path[1] && path[2] === "state") {
    const input = await readBody(request, updateWorkOrderStateSchema);
    return json({ data: await store.updateWorkOrderState(path[1], input.state) });
  }
  if (method === "POST" && path[0] === "work-orders" && path[1] && path[2] === "inspections") {
    const input = await readBody(request, createInspectionSchema);
    return json({ data: await store.createInspection({ ...input, workOrderId: path[1], createdByUserId: user.id }) }, { status: 201 });
  }
  if (method === "POST" && path[0] === "work-orders" && path[1] && path[2] === "parts") {
    const input = await readBody(request, consumePartSchema);
    return json({ data: await store.consumePart(path[1], input.partId, input.quantity, user.id) }, { status: 201 });
  }

  if (method === "GET" && path.join("/") === "parts") return json({ data: await store.listParts() });
  if (method === "POST" && path.join("/") === "parts/bulk") {
    const input = await readBody(request, createPartsBulkSchema);
    return json({ data: await store.createPartsBulk(input.parts) }, { status: 201 });
  }
  if (method === "POST" && path.join("/") === "parts") return json({ data: await store.createPart(await readBody(request, createPartSchema)) }, { status: 201 });
  if (method === "DELETE" && path[0] === "parts" && path[1]) return json({ data: await store.deletePart(path[1]) });
  if (method === "GET" && path.join("/") === "part-sales") return json({ data: await store.listPartSales() });
  if (method === "POST" && path.join("/") === "part-sales") {
    const input = await readBody(request, createPartSaleSchema);
    return json({ data: await store.createPartSale(input, user.id) }, { status: 201 });
  }
  if (method === "GET" && path.join("/") === "dashboard/summary") return json({ data: await store.dashboardSummary() });

  throw requestError("Ruta no encontrada", 404);
}

async function handle(request, context) {
  try {
    return await dispatch(request, await context.params);
  } catch (error) {
    const status = error.status || 500;
    return json(
      {
        error: {
          code: status < 500 ? "REQUEST_ERROR" : "INTERNAL_ERROR",
          message: error.message || "Unexpected error",
          details: error.details
        }
      },
      { status }
    );
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
