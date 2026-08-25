# API.md

## Estilo

API REST sobre HTTPS en produccion.

Las rutas exactas se estabilizaran durante Fase 1 y se ampliaran por fase.

## Convenciones

- JSON para request y response.
- Validacion de entrada en backend.
- Errores normalizados.
- Autorizacion por rol en backend.
- Paginacion en listados.
- Filtros explicitos en busquedas.

## Respuesta de error propuesta

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos invalidos",
    "details": [],
    "correlation_id": "req_..."
  }
}
```

## Rutas iniciales por modulo

### Auth

- POST /auth/login
- POST /auth/logout
- GET /auth/me

### Customers

- GET /customers
- POST /customers
- GET /customers/:id
- PATCH /customers/:id
- DELETE /customers/:id

### Vehicles

- GET /vehicles
- POST /vehicles
- GET /vehicles/:id
- PATCH /vehicles/:id
- GET /vehicles/by-plate/:patente
- GET /vehicles/:id/history

### Work orders

- GET /work-orders
- POST /work-orders
- GET /work-orders/:id
- PATCH /work-orders/:id
- POST /work-orders/:id/close
- GET /work-orders/:id/timeline

### Inspections

- GET /work-orders/:id/inspections
- POST /work-orders/:id/inspections
- PATCH /inspections/:id

### Comments

- GET /work-orders/:id/comments
- POST /work-orders/:id/comments

### Photos

- POST /work-orders/:id/photos
- POST /inspections/:id/photos
- GET /photos/:id

### Parts and inventory

- GET /parts
- POST /parts
- GET /parts/:id
- PATCH /parts/:id
- GET /stock-movements
- POST /stock-movements

### Work order parts

- POST /work-orders/:id/parts
- DELETE /work-orders/:id/parts/:workOrderPartId

### Quotes

- GET /work-orders/:id/quote
- POST /work-orders/:id/quote
- PATCH /quotes/:id
- POST /quotes/:id/approve
- POST /quotes/:id/reject

### Dashboard

- GET /dashboard/summary

### Sync

Fase 10:

- POST /sync/push
- GET /sync/pull
- GET /sync/status

## Estados de orden iniciales

- recibido
- en_diagnostico
- esperando_aprobacion
- en_reparacion
- esperando_repuesto
- listo
- entregado
- detenido

## Consideraciones para offline

Desde el inicio se debe evaluar:

- IDs generados de forma segura para sincronizacion.
- Requests idempotentes en operaciones sensibles.
- Timestamps del servidor.
- Resolucion de conflictos documentada.
- Confirmacion explicita antes de marcar cambios como sincronizados.
