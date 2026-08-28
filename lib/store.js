import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { query, isDatabaseConfigured } from "./db/pool.js";
import { config } from "./config.js";
import { requestError } from "./api.js";

const now = () => new Date().toISOString();
const normalizePlate = (plate) => String(plate || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const toNumber = (value) => (value === null || value === undefined ? value : Number(value));

function publicUser(user) {
  if (!user) return undefined;
  const { passwordHash, password_hash, ...safe } = user;
  return safe;
}

function mapUser(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.nombre,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.rol,
    active: row.activo,
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.nombre,
    rut: row.rut || undefined,
    phone: row.telefono,
    alternatePhone: row.telefono_alternativo || undefined,
    email: row.email || undefined,
    address: row.direccion || undefined,
    notes: row.notas || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function mapVehicle(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    plate: row.patente,
    vin: row.vin || undefined,
    brand: row.marca,
    model: row.modelo,
    version: row.version || undefined,
    year: row.anio || undefined,
    color: row.color || undefined,
    mileage: row.kilometraje,
    permanentNotes: row.notas_permanentes || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function mapWorkOrder(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    mechanicId: row.mechanic_id || undefined,
    receivedByUserId: row.received_by_user_id,
    intakeAt: row.fecha_ingreso?.toISOString?.() || row.fecha_ingreso,
    expectedDeliveryAt: row.fecha_estimada_entrega?.toISOString?.() || row.fecha_estimada_entrega || undefined,
    mileage: row.kilometraje,
    fuelLevel: row.nivel_combustible || undefined,
    reason: row.motivo,
    symptoms: row.sintomas || undefined,
    initialDiagnosis: row.diagnostico_inicial || undefined,
    finalDiagnosis: row.diagnostico_definitivo || undefined,
    priority: row.prioridad,
    state: row.estado,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    closedAt: row.closed_at?.toISOString?.() || row.closed_at || undefined
  };
}

function mapInspection(row) {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    system: row.sistema,
    element: row.elemento,
    state: row.estado,
    comment: row.comentario || undefined,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function mapPart(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.nombre,
    brand: row.marca || undefined,
    description: row.descripcion || undefined,
    cost: toNumber(row.costo),
    price: toNumber(row.precio),
    stock: row.stock,
    minimumStock: row.stock_minimo,
    location: row.ubicacion || undefined,
    active: row.activo,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function mapWorkOrderPart(row) {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    partId: row.part_id,
    quantity: row.cantidad,
    unitPrice: toNumber(row.precio_unitario),
    unitCost: toNumber(row.costo_unitario),
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

class MemoryStore {
  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.vehicles = new Map();
    this.workOrders = new Map();
    this.inspections = new Map();
    this.parts = new Map();
    this.partSales = new Map();
    this.stockMovements = new Map();
    this.workOrderParts = new Map();
  }

  async ensureAdmin() {
    if ([...this.users.values()].some((user) => user.email === config.adminEmail.toLowerCase())) return;
    const passwordHash = await bcrypt.hash(config.adminPassword, 10);
    const admin = {
      id: randomUUID(),
      name: "Administrador",
      email: config.adminEmail.toLowerCase(),
      passwordHash,
      role: "admin",
      active: true,
      createdAt: now()
    };
    this.users.set(admin.id, admin);
  }

  async findUserByEmail(email) {
    await this.ensureAdmin();
    return [...this.users.values()].find((user) => user.email === email.toLowerCase() && user.active);
  }

  async findUserById(id) {
    await this.ensureAdmin();
    return this.users.get(id);
  }

  async listCustomers() {
    return [...this.customers.values()];
  }

  async createCustomer(input) {
    const timestamp = now();
    const customer = { id: randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async listVehicles() {
    return [...this.vehicles.values()];
  }

  async createVehicle(input) {
    if (!this.customers.has(input.customerId)) throw requestError("Customer not found", 404);
    const plate = normalizePlate(input.plate);
    if ([...this.vehicles.values()].some((vehicle) => vehicle.plate === plate)) throw requestError("Plate already exists", 409);
    const timestamp = now();
    const vehicle = { id: randomUUID(), ...input, plate, createdAt: timestamp, updatedAt: timestamp };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  async findVehicleByPlate(plate) {
    const normalized = normalizePlate(plate);
    return [...this.vehicles.values()].find((vehicle) => vehicle.plate === normalized);
  }

  async listWorkOrders() {
    return [...this.workOrders.values()];
  }

  async createWorkOrder(input) {
    if (!this.vehicles.has(input.vehicleId)) throw requestError("Vehicle not found", 404);
    const timestamp = now();
    const workOrder = {
      id: randomUUID(),
      ...input,
      intakeAt: timestamp,
      state: "recibido",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.workOrders.set(workOrder.id, workOrder);
    return workOrder;
  }

  async updateWorkOrderState(id, state) {
    const order = this.workOrders.get(id);
    if (!order) throw requestError("Work order not found", 404);
    const updated = { ...order, state, updatedAt: now(), closedAt: state === "entregado" ? now() : order.closedAt };
    this.workOrders.set(id, updated);
    return updated;
  }

  async createInspection(input) {
    if (!this.workOrders.has(input.workOrderId)) throw requestError("Work order not found", 404);
    const timestamp = now();
    const inspection = { id: randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    this.inspections.set(inspection.id, inspection);
    return inspection;
  }

  async listParts() {
    return [...this.parts.values()];
  }

  async createPart(input) {
    if ([...this.parts.values()].some((part) => part.sku === input.sku)) throw requestError("SKU already exists", 409);
    const timestamp = now();
    const part = { id: randomUUID(), ...input, active: true, createdAt: timestamp, updatedAt: timestamp };
    this.parts.set(part.id, part);
    return part;
  }

  async createPartsBulk(parts) {
    const created = [];
    const skipped = [];
    const seen = new Set([...this.parts.values()].map((part) => part.sku.toLowerCase()));
    for (const input of parts) {
      const key = input.sku.toLowerCase();
      if (seen.has(key)) {
        skipped.push({ sku: input.sku, reason: "SKU duplicado" });
        continue;
      }
      seen.add(key);
      const timestamp = now();
      const part = { id: randomUUID(), ...input, active: true, createdAt: timestamp, updatedAt: timestamp };
      this.parts.set(part.id, part);
      created.push(part);
    }
    return { created, skipped, createdCount: created.length, skippedCount: skipped.length };
  }

  async deletePart(id) {
    const part = this.parts.get(id);
    if (!part) throw requestError("Part not found", 404);
    const updated = { ...part, active: false, updatedAt: now() };
    this.parts.delete(id);
    return updated;
  }

  async listPartSales() {
    return [...this.partSales.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async createPartSale(input, userId) {
    const timestamp = now();
    const items = input.items.map((item) => {
      const part = this.parts.get(item.partId);
      if (!part) throw requestError("Part not found", 404);
      if (part.stock < item.quantity) throw requestError(`Insufficient stock for ${part.name}`, 409);
      return {
        part,
        partId: item.partId,
        quantity: item.quantity,
        unitPrice: part.price,
        unitCost: part.cost,
        subtotal: Number(part.price) * item.quantity,
        profit: (Number(part.price) - Number(part.cost)) * item.quantity
      };
    });
    const sale = {
      id: randomUUID(),
      paymentMethod: input.paymentMethod,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
      profit: items.reduce((sum, item) => sum + item.profit, 0),
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      items: items.map(({ part, ...item }) => ({ ...item, sku: part.sku, name: part.name })),
      createdByUserId: userId,
      createdAt: timestamp
    };
    items.forEach((item) => {
      const updatedPart = { ...item.part, stock: item.part.stock - item.quantity, updatedAt: timestamp };
      const movement = {
        id: randomUUID(),
        partId: item.partId,
        type: "venta_repuesto",
        quantity: -item.quantity,
        userId,
        reason: `Venta repuesto ${sale.id}`,
        createdAt: timestamp
      };
      this.parts.set(item.partId, updatedPart);
      this.stockMovements.set(movement.id, movement);
    });
    this.partSales.set(sale.id, sale);
    return sale;
  }

  async consumePart(workOrderId, partId, quantity, userId) {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw requestError("Work order not found", 404);
    const part = this.parts.get(partId);
    if (!part) throw requestError("Part not found", 404);
    if (part.stock < quantity) throw requestError("Insufficient stock", 409);
    const timestamp = now();
    const updatedPart = { ...part, stock: part.stock - quantity, updatedAt: timestamp };
    const usage = {
      id: randomUUID(),
      workOrderId,
      partId,
      quantity,
      unitPrice: part.price,
      unitCost: part.cost,
      createdAt: timestamp
    };
    const movement = {
      id: randomUUID(),
      partId,
      type: "consumo_orden",
      quantity: -quantity,
      workOrderId,
      userId,
      reason: `Consumo en orden ${workOrder.id}`,
      createdAt: timestamp
    };
    this.parts.set(partId, updatedPart);
    this.workOrderParts.set(usage.id, usage);
    this.stockMovements.set(movement.id, movement);
    return { part: updatedPart, usage, movement };
  }

  async vehicleHistory(vehicleId) {
    if (!this.vehicles.has(vehicleId)) throw requestError("Vehicle not found", 404);
    const orders = [...this.workOrders.values()].filter((order) => order.vehicleId === vehicleId);
    return orders.map((order) => ({
      order,
      inspections: [...this.inspections.values()].filter((inspection) => inspection.workOrderId === order.id),
      parts: [...this.workOrderParts.values()].filter((part) => part.workOrderId === order.id)
    }));
  }

  async dashboardSummary() {
    const orders = await this.listWorkOrders();
    const parts = await this.listParts();
    const workOrdersByState = orders.reduce((acc, order) => {
      acc[order.state] = (acc[order.state] || 0) + 1;
      return acc;
    }, {});
    return {
      workOrdersByState,
      lowStockCount: parts.filter((part) => part.stock <= part.minimumStock).length,
      openWorkOrders: orders.filter((order) => order.state !== "entregado").length
    };
  }
}

class DatabaseStore {
  async ensureAdmin() {
    const existing = await query("select id from users where email = $1 limit 1", [config.adminEmail.toLowerCase()]);
    if (existing.rowCount) return;
    await query(
      "insert into users (id, nombre, email, password_hash, rol, activo) values ($1, $2, $3, $4, $5, true)",
      [randomUUID(), "Administrador", config.adminEmail.toLowerCase(), await bcrypt.hash(config.adminPassword, 10), "admin"]
    );
  }

  async findUserByEmail(email) {
    await this.ensureAdmin();
    const result = await query("select * from users where email = $1 and activo = true limit 1", [email.toLowerCase()]);
    return mapUser(result.rows[0]);
  }

  async findUserById(id) {
    await this.ensureAdmin();
    const result = await query("select * from users where id = $1 and activo = true limit 1", [id]);
    return mapUser(result.rows[0]);
  }

  async listCustomers() {
    const result = await query("select * from customers where deleted_at is null order by created_at desc");
    return result.rows.map(mapCustomer);
  }

  async createCustomer(input) {
    const result = await query(
      `
        insert into customers (id, nombre, rut, telefono, telefono_alternativo, email, direccion, notas)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [randomUUID(), input.name, input.rut || null, input.phone, input.alternatePhone || null, input.email || null, input.address || null, input.notes || null]
    );
    return mapCustomer(result.rows[0]);
  }

  async listVehicles() {
    const result = await query("select * from vehicles where deleted_at is null order by created_at desc");
    return result.rows.map(mapVehicle);
  }

  async createVehicle(input) {
    const customer = await query("select id from customers where id = $1 and deleted_at is null", [input.customerId]);
    if (!customer.rowCount) throw requestError("Customer not found", 404);
    const result = await query(
      `
        insert into vehicles (id, customer_id, patente, vin, marca, modelo, version, anio, color, kilometraje, notas_permanentes)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning *
      `,
      [
        randomUUID(),
        input.customerId,
        normalizePlate(input.plate),
        input.vin || null,
        input.brand,
        input.model,
        input.version || null,
        input.year || null,
        input.color || null,
        input.mileage,
        input.permanentNotes || null
      ]
    ).catch((error) => {
      if (error.code === "23505") throw requestError("Plate already exists", 409);
      throw error;
    });
    return mapVehicle(result.rows[0]);
  }

  async findVehicleByPlate(plate) {
    const result = await query("select * from vehicles where patente = $1 and deleted_at is null limit 1", [normalizePlate(plate)]);
    return result.rows[0] ? mapVehicle(result.rows[0]) : undefined;
  }

  async listWorkOrders() {
    const result = await query("select * from work_orders order by created_at desc");
    return result.rows.map(mapWorkOrder);
  }

  async createWorkOrder(input) {
    const vehicle = await query("select id from vehicles where id = $1 and deleted_at is null", [input.vehicleId]);
    if (!vehicle.rowCount) throw requestError("Vehicle not found", 404);
    const result = await query(
      `
        insert into work_orders (
          id, vehicle_id, mechanic_id, received_by_user_id, fecha_estimada_entrega, kilometraje,
          nivel_combustible, motivo, sintomas, diagnostico_inicial, diagnostico_definitivo, prioridad
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning *
      `,
      [
        randomUUID(),
        input.vehicleId,
        input.mechanicId || null,
        input.receivedByUserId,
        input.expectedDeliveryAt || null,
        input.mileage,
        input.fuelLevel || null,
        input.reason,
        input.symptoms || null,
        input.initialDiagnosis || null,
        input.finalDiagnosis || null,
        input.priority || "normal"
      ]
    );
    return mapWorkOrder(result.rows[0]);
  }

  async updateWorkOrderState(id, state) {
    const result = await query(
      `
        update work_orders
        set estado = $2,
            updated_at = now(),
            closed_at = case when $2 = 'entregado' then now() else closed_at end
        where id = $1
        returning *
      `,
      [id, state]
    );
    if (!result.rowCount) throw requestError("Work order not found", 404);
    return mapWorkOrder(result.rows[0]);
  }

  async createInspection(input) {
    const result = await query(
      `
        insert into inspections (id, work_order_id, sistema, elemento, estado, comentario, created_by_user_id)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [randomUUID(), input.workOrderId, input.system, input.element, input.state, input.comment || null, input.createdByUserId]
    ).catch((error) => {
      if (error.code === "23503") throw requestError("Work order not found", 404);
      throw error;
    });
    return mapInspection(result.rows[0]);
  }

  async listParts() {
    const result = await query("select * from parts where activo = true order by created_at desc");
    return result.rows.map(mapPart);
  }

  async listPartSales() {
    return [];
  }

  async createPartSale() {
    throw requestError("Part sales require the part_sales database migration", 501);
  }

  async createPart(input) {
    const result = await query(
      `
        insert into parts (id, sku, nombre, marca, descripcion, costo, precio, stock, stock_minimo, ubicacion)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning *
      `,
      [
        randomUUID(),
        input.sku,
        input.name,
        input.brand || null,
        input.description || null,
        input.cost,
        input.price,
        input.stock,
        input.minimumStock || 0,
        input.location || null
      ]
    ).catch((error) => {
      if (error.code === "23505") throw requestError("SKU already exists", 409);
      throw error;
    });
    return mapPart(result.rows[0]);
  }

  async createPartsBulk(parts) {
    const created = [];
    const skipped = [];
    const normalizedParts = [];
    const seen = new Set();

    for (const part of parts) {
      const key = part.sku.toLowerCase();
      if (seen.has(key)) {
        skipped.push({ sku: part.sku, reason: "SKU repetido en la carga" });
        continue;
      }
      seen.add(key);
      normalizedParts.push(part);
    }

    if (!normalizedParts.length) {
      return { created, skipped, createdCount: 0, skippedCount: skipped.length };
    }

    const existing = await query("select sku from parts where lower(sku) = any($1::text[]) and activo = true", [[...seen]]);
    const existingSkus = new Set(existing.rows.map((row) => String(row.sku).toLowerCase()));

    for (const input of normalizedParts) {
      if (existingSkus.has(input.sku.toLowerCase())) {
        skipped.push({ sku: input.sku, reason: "SKU duplicado" });
        continue;
      }
      const result = await query(
        `
          insert into parts (id, sku, nombre, marca, descripcion, costo, precio, stock, stock_minimo, ubicacion)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          returning *
        `,
        [
          randomUUID(),
          input.sku,
          input.name,
          input.brand || null,
          input.description || null,
          input.cost,
          input.price,
          input.stock,
          input.minimumStock || 0,
          input.location || null
        ]
      ).catch((error) => {
        if (error.code === "23505") {
          skipped.push({ sku: input.sku, reason: "SKU duplicado" });
          return undefined;
        }
        throw error;
      });
      if (result?.rows[0]) created.push(mapPart(result.rows[0]));
    }

    return { created, skipped, createdCount: created.length, skippedCount: skipped.length };
  }

  async deletePart(id) {
    const result = await query("update parts set activo = false, updated_at = now() where id = $1 and activo = true returning *", [id]);
    if (!result.rowCount) throw requestError("Part not found", 404);
    return mapPart(result.rows[0]);
  }

  async consumePart(workOrderId, partId, quantity, userId) {
    const pool = (await import("./db/pool.js")).getPool();
    const connection = await pool.connect();
    try {
      await connection.query("begin");
      const order = await connection.query("select id from work_orders where id = $1", [workOrderId]);
      if (!order.rowCount) throw requestError("Work order not found", 404);
      const partResult = await connection.query("select * from parts where id = $1 for update", [partId]);
      if (!partResult.rowCount) throw requestError("Part not found", 404);
      const part = mapPart(partResult.rows[0]);
      if (part.stock < quantity) throw requestError("Insufficient stock", 409);

      const updatedPartResult = await connection.query(
        "update parts set stock = stock - $2, updated_at = now() where id = $1 returning *",
        [partId, quantity]
      );
      const usageResult = await connection.query(
        `
          insert into work_order_parts (id, work_order_id, part_id, cantidad, precio_unitario, costo_unitario)
          values ($1, $2, $3, $4, $5, $6)
          returning *
        `,
        [randomUUID(), workOrderId, partId, quantity, part.price, part.cost]
      );
      const movementResult = await connection.query(
        `
          insert into stock_movements (id, part_id, tipo, cantidad, work_order_id, user_id, motivo)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning *
        `,
        [randomUUID(), partId, "consumo_orden", -quantity, workOrderId, userId, `Consumo en orden ${workOrderId}`]
      );
      await connection.query("commit");
      return {
        part: mapPart(updatedPartResult.rows[0]),
        usage: mapWorkOrderPart(usageResult.rows[0]),
        movement: movementResult.rows[0]
      };
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
  }

  async vehicleHistory(vehicleId) {
    const vehicle = await query("select id from vehicles where id = $1 and deleted_at is null", [vehicleId]);
    if (!vehicle.rowCount) throw requestError("Vehicle not found", 404);
    const orders = (await query("select * from work_orders where vehicle_id = $1 order by created_at desc", [vehicleId])).rows.map(mapWorkOrder);
    const orderIds = orders.map((order) => order.id);
    if (!orderIds.length) return [];
    const inspections = (await query("select * from inspections where work_order_id = any($1::uuid[]) order by created_at desc", [orderIds])).rows.map(mapInspection);
    const parts = (await query("select * from work_order_parts where work_order_id = any($1::uuid[]) order by created_at desc", [orderIds])).rows.map(mapWorkOrderPart);
    return orders.map((order) => ({
      order,
      inspections: inspections.filter((inspection) => inspection.workOrderId === order.id),
      parts: parts.filter((part) => part.workOrderId === order.id)
    }));
  }

  async dashboardSummary() {
    const orders = await query("select estado, count(*)::int as total from work_orders group by estado");
    const open = await query("select count(*)::int as total from work_orders where estado <> 'entregado'");
    const lowStock = await query("select count(*)::int as total from parts where activo = true and stock <= stock_minimo");
    return {
      workOrdersByState: Object.fromEntries(orders.rows.map((row) => [row.estado, row.total])),
      lowStockCount: lowStock.rows[0].total,
      openWorkOrders: open.rows[0].total
    };
  }
}

let memoryStore;

export function getStore() {
  if (isDatabaseConfigured()) return new DatabaseStore();
  if (!memoryStore) memoryStore = new MemoryStore();
  return memoryStore;
}

export { publicUser, normalizePlate };
