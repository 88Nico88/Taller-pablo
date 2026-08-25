import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { config } from './config.js';
import type {
  Customer,
  Inspection,
  Part,
  StockMovement,
  User,
  Vehicle,
  WorkOrder,
  WorkOrderPart
} from './domain.js';

const now = () => new Date().toISOString();

export class AppStore {
  users = new Map<string, User>();
  customers = new Map<string, Customer>();
  vehicles = new Map<string, Vehicle>();
  workOrders = new Map<string, WorkOrder>();
  inspections = new Map<string, Inspection>();
  parts = new Map<string, Part>();
  stockMovements = new Map<string, StockMovement>();
  workOrderParts = new Map<string, WorkOrderPart>();

  static async seeded() {
    const store = new AppStore();
    const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 10);
    const createdAt = now();
    const admin: User = {
      id: randomUUID(),
      name: 'Administrador',
      email: config.ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: 'admin',
      active: true,
      createdAt
    };
    store.users.set(admin.id, admin);
    return store;
  }

  findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase() && user.active);
  }

  createCustomer(input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) {
    const timestamp = now();
    const customer: Customer = { id: randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    this.customers.set(customer.id, customer);
    return customer;
  }

  createVehicle(input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!this.customers.has(input.customerId)) throw Object.assign(new Error('Customer not found'), { status: 404 });
    const normalizedPlate = normalizePlate(input.plate);
    if ([...this.vehicles.values()].some((vehicle) => vehicle.plate === normalizedPlate)) {
      throw Object.assign(new Error('Plate already exists'), { status: 409 });
    }
    const timestamp = now();
    const vehicle: Vehicle = {
      id: randomUUID(),
      ...input,
      plate: normalizedPlate,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  createWorkOrder(input: Omit<WorkOrder, 'id' | 'intakeAt' | 'state' | 'createdAt' | 'updatedAt'>) {
    if (!this.vehicles.has(input.vehicleId)) throw Object.assign(new Error('Vehicle not found'), { status: 404 });
    const timestamp = now();
    const workOrder: WorkOrder = {
      id: randomUUID(),
      ...input,
      intakeAt: timestamp,
      state: 'recibido',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.workOrders.set(workOrder.id, workOrder);
    return workOrder;
  }

  updateWorkOrderState(id: string, state: WorkOrder['state']) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) throw Object.assign(new Error('Work order not found'), { status: 404 });
    const updated: WorkOrder = {
      ...workOrder,
      state,
      updatedAt: now(),
      closedAt: state === 'entregado' ? now() : workOrder.closedAt
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  createInspection(input: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!this.workOrders.has(input.workOrderId)) throw Object.assign(new Error('Work order not found'), { status: 404 });
    const timestamp = now();
    const inspection: Inspection = { id: randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    this.inspections.set(inspection.id, inspection);
    return inspection;
  }

  createPart(input: Omit<Part, 'id' | 'active' | 'createdAt' | 'updatedAt'>) {
    if ([...this.parts.values()].some((part) => part.sku === input.sku)) {
      throw Object.assign(new Error('SKU already exists'), { status: 409 });
    }
    const timestamp = now();
    const part: Part = { id: randomUUID(), ...input, active: true, createdAt: timestamp, updatedAt: timestamp };
    this.parts.set(part.id, part);
    return part;
  }

  consumePart(workOrderId: string, partId: string, quantity: number, userId: string) {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw Object.assign(new Error('Work order not found'), { status: 404 });
    const part = this.parts.get(partId);
    if (!part) throw Object.assign(new Error('Part not found'), { status: 404 });
    if (part.stock < quantity) throw Object.assign(new Error('Insufficient stock'), { status: 409 });

    const timestamp = now();
    const updatedPart = { ...part, stock: part.stock - quantity, updatedAt: timestamp };
    const usage: WorkOrderPart = {
      id: randomUUID(),
      workOrderId,
      partId,
      quantity,
      unitPrice: part.price,
      unitCost: part.cost,
      createdAt: timestamp
    };
    const movement: StockMovement = {
      id: randomUUID(),
      partId,
      type: 'consumo_orden',
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

  vehicleHistory(vehicleId: string) {
    if (!this.vehicles.has(vehicleId)) throw Object.assign(new Error('Vehicle not found'), { status: 404 });
    const orders = [...this.workOrders.values()].filter((order) => order.vehicleId === vehicleId);
    return orders.map((order) => ({
      order,
      inspections: [...this.inspections.values()].filter((inspection) => inspection.workOrderId === order.id),
      parts: [...this.workOrderParts.values()].filter((part) => part.workOrderId === order.id)
    }));
  }
}

export function normalizePlate(plate: string) {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
