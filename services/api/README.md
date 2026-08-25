# API

Backend inicial del sistema de gestion para taller automotriz.

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm test
```

## Credenciales demo

- Email: `admin@taller.local`
- Password: `admin12345`

Se pueden cambiar con variables de entorno:

```bash
ADMIN_EMAIL=admin@demo.local ADMIN_PASSWORD=otra-clave npm run dev
```

## Endpoints implementados

- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `GET /customers`
- `POST /customers`
- `GET /vehicles`
- `POST /vehicles`
- `GET /vehicles/by-plate/:plate`
- `GET /vehicles/:id/history`
- `GET /work-orders`
- `POST /work-orders`
- `PATCH /work-orders/:id/state`
- `POST /work-orders/:id/inspections`
- `GET /parts`
- `POST /parts`
- `POST /work-orders/:id/parts`
- `GET /dashboard/summary`

## Persistencia

El backend usa almacenamiento en memoria para desarrollo y pruebas. La migracion PostgreSQL inicial esta en:

```text
migrations/001_initial_schema.sql
```

La siguiente tarea tecnica debe conectar estos contratos a PostgreSQL real mediante un repositorio persistente y migraciones ejecutables.
