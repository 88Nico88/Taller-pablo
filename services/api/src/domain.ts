export type Role = 'admin' | 'reception' | 'mechanic';

export type WorkOrderState =
  | 'recibido'
  | 'en_diagnostico'
  | 'esperando_aprobacion'
  | 'en_reparacion'
  | 'esperando_repuesto'
  | 'listo'
  | 'entregado'
  | 'detenido';

export type InspectionState = 'bueno' | 'requiere_atencion' | 'requiere_reparacion' | 'no_revisado';

export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'devolucion' | 'consumo_orden';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  rut?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  vin?: string;
  brand: string;
  model: string;
  version?: string;
  year?: number;
  color?: string;
  mileage: number;
  permanentNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  vehicleId: string;
  mechanicId?: string;
  receivedByUserId: string;
  intakeAt: string;
  expectedDeliveryAt?: string;
  mileage: number;
  fuelLevel?: string;
  reason: string;
  symptoms?: string;
  initialDiagnosis?: string;
  finalDiagnosis?: string;
  priority: 'baja' | 'normal' | 'alta' | 'urgente';
  state: WorkOrderState;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface Inspection {
  id: string;
  workOrderId: string;
  system: string;
  element: string;
  state: InspectionState;
  comment?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  description?: string;
  cost: number;
  price: number;
  stock: number;
  minimumStock: number;
  location?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  partId: string;
  type: StockMovementType;
  quantity: number;
  workOrderId?: string;
  userId: string;
  reason?: string;
  createdAt: string;
}

export interface WorkOrderPart {
  id: string;
  workOrderId: string;
  partId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  createdAt: string;
}
