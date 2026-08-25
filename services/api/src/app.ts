import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, requireAuth, signToken, validate } from './http.js';
import type { AppStore } from './store.js';
import {
  consumePartSchema,
  createCustomerSchema,
  createInspectionSchema,
  createPartSchema,
  createVehicleSchema,
  createWorkOrderSchema,
  loginSchema,
  updateWorkOrderStateSchema
} from './validation.js';

function stringParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') throw Object.assign(new Error('Invalid path parameter'), { status: 400 });
  return value;
}

export function createApp(store: AppStore) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('combined'));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/auth/login', validate(loginSchema), async (req, res) => {
    const user = store.findUserByEmail(req.body.email);
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas' } });
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    res.json({ token: signToken(user), user: safeUser });
  });

  const auth = requireAuth(store);

  app.get('/auth/me', auth, (req, res) => res.json({ user: req.user }));

  app.get('/customers', auth, (_req, res) => res.json({ data: [...store.customers.values()] }));
  app.post('/customers', auth, validate(createCustomerSchema), (req, res) => {
    res.status(201).json({ data: store.createCustomer(req.body) });
  });

  app.get('/vehicles', auth, (_req, res) => res.json({ data: [...store.vehicles.values()] }));
  app.post('/vehicles', auth, validate(createVehicleSchema), (req, res) => {
    res.status(201).json({ data: store.createVehicle(req.body) });
  });
  app.get('/vehicles/by-plate/:plate', auth, (req, res) => {
    const plate = stringParam(req.params.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const vehicle = [...store.vehicles.values()].find((item) => item.plate === plate);
    if (!vehicle) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Vehiculo no encontrado' } });
    res.json({ data: vehicle });
  });
  app.get('/vehicles/:id/history', auth, (req, res) => res.json({ data: store.vehicleHistory(stringParam(req.params.id)) }));

  app.get('/work-orders', auth, (_req, res) => res.json({ data: [...store.workOrders.values()] }));
  app.post('/work-orders', auth, validate(createWorkOrderSchema), (req, res) => {
    res.status(201).json({ data: store.createWorkOrder({ ...req.body, receivedByUserId: req.user!.id }) });
  });
  app.patch('/work-orders/:id/state', auth, validate(updateWorkOrderStateSchema), (req, res) => {
    res.json({ data: store.updateWorkOrderState(stringParam(req.params.id), req.body.state) });
  });

  app.post('/work-orders/:id/inspections', auth, validate(createInspectionSchema), (req, res) => {
    res.status(201).json({
      data: store.createInspection({ ...req.body, workOrderId: stringParam(req.params.id), createdByUserId: req.user!.id })
    });
  });

  app.get('/parts', auth, (_req, res) => res.json({ data: [...store.parts.values()] }));
  app.post('/parts', auth, validate(createPartSchema), (req, res) => {
    res.status(201).json({ data: store.createPart(req.body) });
  });
  app.post('/work-orders/:id/parts', auth, validate(consumePartSchema), (req, res) => {
    res.status(201).json({ data: store.consumePart(stringParam(req.params.id), req.body.partId, req.body.quantity, req.user!.id) });
  });

  app.get('/dashboard/summary', auth, (_req, res) => {
    const orders = [...store.workOrders.values()];
    const byState = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.state] = (acc[order.state] ?? 0) + 1;
      return acc;
    }, {});
    const lowStock = [...store.parts.values()].filter((part) => part.stock <= part.minimumStock);
    res.json({ data: { workOrdersByState: byState, lowStockCount: lowStock.length, openWorkOrders: orders.length } });
  });

  app.use(errorHandler);

  return app;
}
