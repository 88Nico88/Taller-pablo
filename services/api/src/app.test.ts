import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { AppStore } from './store.js';

let store: AppStore;
let token: string;

beforeEach(async () => {
  store = await AppStore.seeded();
  const app = createApp(store);
  const login = await request(app).post('/auth/login').send({
    email: 'admin@taller.local',
    password: 'admin12345'
  });
  token = login.body.token;
});

describe('workshop MVP flow', () => {
  it('creates customer, vehicle, order, inspection and consumes stock', async () => {
    const app = createApp(store);

    const customer = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Demo', phone: '+56911111111' })
      .expect(201);

    const vehicle = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.body.data.id,
        plate: 'ab-cd-12',
        brand: 'Toyota',
        model: 'Yaris',
        mileage: 120000
      })
      .expect(201);

    expect(vehicle.body.data.plate).toBe('ABCD12');

    const order = await request(app)
      .post('/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId: vehicle.body.data.id,
        mileage: 120100,
        reason: 'Ruido al frenar',
        priority: 'normal'
      })
      .expect(201);

    await request(app)
      .post(`/work-orders/${order.body.data.id}/inspections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        system: 'Frenos',
        element: 'Pastillas delanteras',
        state: 'requiere_reparacion',
        comment: 'Desgaste avanzado'
      })
      .expect(201);

    const part = await request(app)
      .post('/parts')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'PAST-001', name: 'Pastillas delanteras', cost: 12000, price: 25000, stock: 2, minimumStock: 1 })
      .expect(201);

    const consumption = await request(app)
      .post(`/work-orders/${order.body.data.id}/parts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ partId: part.body.data.id, quantity: 1 })
      .expect(201);

    expect(consumption.body.data.part.stock).toBe(1);

    const history = await request(app)
      .get(`/vehicles/${vehicle.body.data.id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].inspections).toHaveLength(1);
    expect(history.body.data[0].parts).toHaveLength(1);
  });

  it('blocks stock consumption when inventory is insufficient', async () => {
    const app = createApp(store);
    const customer = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Stock', phone: '1234567' })
      .expect(201);
    const vehicle = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.body.data.id, plate: 'ZZ9999', brand: 'Kia', model: 'Rio', mileage: 1 });
    const order = await request(app)
      .post('/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ vehicleId: vehicle.body.data.id, mileage: 1, reason: 'Mantencion' });
    const part = await request(app)
      .post('/parts')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'FILTRO-1', name: 'Filtro', cost: 1000, price: 2000, stock: 0, minimumStock: 1 });

    await request(app)
      .post(`/work-orders/${order.body.data.id}/parts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ partId: part.body.data.id, quantity: 1 })
      .expect(409);
  });
});
