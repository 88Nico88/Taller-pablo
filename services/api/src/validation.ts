import { z } from 'zod';

const optionalText = z.string().trim().min(1).optional();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2),
  rut: optionalText,
  phone: z.string().trim().min(6),
  alternatePhone: optionalText,
  email: z.string().email().optional(),
  address: optionalText,
  notes: optionalText
});

export const createVehicleSchema = z.object({
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

export const createWorkOrderSchema = z.object({
  vehicleId: z.uuid(),
  mechanicId: z.uuid().optional(),
  expectedDeliveryAt: z.string().datetime().optional(),
  mileage: z.number().int().min(0),
  fuelLevel: optionalText,
  reason: z.string().trim().min(3),
  symptoms: optionalText,
  initialDiagnosis: optionalText,
  finalDiagnosis: optionalText,
  priority: z.enum(['baja', 'normal', 'alta', 'urgente']).default('normal')
});

export const updateWorkOrderStateSchema = z.object({
  state: z.enum([
    'recibido',
    'en_diagnostico',
    'esperando_aprobacion',
    'en_reparacion',
    'esperando_repuesto',
    'listo',
    'entregado',
    'detenido'
  ])
});

export const createInspectionSchema = z.object({
  system: z.string().trim().min(2),
  element: z.string().trim().min(2),
  state: z.enum(['bueno', 'requiere_atencion', 'requiere_reparacion', 'no_revisado']),
  comment: optionalText
});

export const createPartSchema = z.object({
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

export const consumePartSchema = z.object({
  partId: z.uuid(),
  quantity: z.number().int().positive()
});
