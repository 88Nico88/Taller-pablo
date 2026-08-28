# Analisis del proyecto FlowStock / Taller Pablo

Fecha de revision: 2026-08-26 15:15 UTC

## Resumen corto

El proyecto actual es una app web Next.js para un taller automotriz con un modulo separado de repuestos estilo FlowStock. Hoy sirve como demo funcional: permite entrar con cuenta demo, operar Taller Pablo, gestionar repuestos, vender por codigo/SKU, descontar stock, ver metricas y exportar respaldo JSON.

La base del taller esta mas avanzada que la parte comercial de FlowStock Repuestos. El punto critico: la venta y cierre de repuestos ya funcionan en el demo local/en memoria, pero aun no estan persistidos en la migracion PostgreSQL/Supabase de produccion.

## Proyecto encontrado

Ruta revisada:

```text
/root/.openclaw/workspace/taller-automotriz-pablo
```

Stack actual:

- Next.js 16 con App Router.
- React 19.
- API serverless dentro de `app/api/[[...segments]]/route.js`.
- Store dual:
  - Memoria local cuando no hay `DATABASE_URL`.
  - PostgreSQL/Supabase cuando existe `DATABASE_URL`.
- Validacion con Zod.
- Autenticacion con JWT.
- Password hash con bcrypt.
- Demo accesible con:
  - `admin@taller.local`
  - `admin12345`

## Estructura principal

```text
app/
  page.jsx                         UI principal actual
  globals.css                      estilos responsive
  api/[[...segments]]/route.js     API REST serverless

lib/
  store.js                         logica de datos memoria/Postgres
  config.js                        variables de entorno
  api.js                           respuestas y errores HTTP
  db/pool.js                       conexion PostgreSQL

supabase/migrations/
  20260825000000_initial_schema.sql

services/api/
  src/app.ts                       backend Express historico/local
  src/app.test.ts                  pruebas Vitest del flujo MVP

docs/
  DEPLOYMENT.md
  SPEECH.md
```

## Lo que tiene hoy la app visible

### Acceso

- Pantalla de login privada.
- Boton "Entrar demo".
- Token guardado en `localStorage`.
- Sesion con JWT de 8 horas.
- Boton para salir de sesion.

### Separacion de negocios

La app tiene un selector lateral:

- Taller
- Repuestos

En Taller se muestran modulos propios de operacion del taller.

En Repuestos se muestra el modulo de FlowStock Repuestos con venta, inventario, cierre y respaldo.

### Modulos del Taller

- Panel
- Recepcion
- Vehiculos
- Ordenes
- Historial
- Cuenta

Funcionalidades reales:

- Crear cliente.
- Crear vehiculo asociado a cliente.
- Normalizar patente.
- Crear orden de trabajo.
- Cambiar estado de orden.
- Buscar historial por patente.
- Ver vehiculos recientes.
- Ver ordenes recientes.
- Ver alertas de stock bajo.
- Descontar repuestos usados en una orden.

Estados de orden soportados:

- recibido
- en_diagnostico
- esperando_aprobacion
- en_reparacion
- esperando_repuesto
- listo
- entregado
- detenido

### Modulos de Repuestos / FlowStock

- Venta
- Panel repuestos
- Inventario
- Cierre
- Respaldo
- Cuenta

Funcionalidades reales:

- Buscar repuesto por SKU/codigo.
- Agregar repuesto al carrito.
- Elegir cantidad.
- Evitar venta sin stock.
- Elegir metodo de pago:
  - Efectivo
  - Transferencia
  - Transbank
- Registrar venta de repuestos.
- Descontar stock automaticamente al vender.
- Calcular total de venta.
- Calcular ganancia aproximada usando precio menos costo.
- Ver unidades vendidas.
- Ver ventas recientes.
- Ver desglose por metodo de pago.
- Exportar respaldo/cierre en JSON.
- Preparar mensaje de pedido sugerido por WhatsApp para stock bajo.

## API implementada actualmente

Todas las rutas viven bajo `/api` en la app Next.

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Clientes

- `GET /api/customers`
- `POST /api/customers`

### Vehiculos

- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/by-plate/:patente`
- `GET /api/vehicles/:id/history`

### Ordenes

- `GET /api/work-orders`
- `POST /api/work-orders`
- `PATCH /api/work-orders/:id/state`
- `POST /api/work-orders/:id/inspections`
- `POST /api/work-orders/:id/parts`

### Repuestos

- `GET /api/parts`
- `POST /api/parts`

### Ventas de repuestos

- `GET /api/part-sales`
- `POST /api/part-sales`

Importante: estas rutas de ventas funcionan en modo memoria. En modo PostgreSQL devuelven que falta la migracion de ventas de repuestos.

### Dashboard

- `GET /api/dashboard/summary`

## Base de datos actual

La migracion Supabase/PostgreSQL crea:

- `users`
- `customers`
- `vehicles`
- `work_orders`
- `inspections`
- `parts`
- `stock_movements`
- `work_order_parts`

Indices actuales:

- `vehicles.patente`
- `customers.nombre`
- `work_orders.vehicle_id`
- `work_orders.estado`
- `parts.nombre`

## Brecha importante de base de datos

La app ya tiene venta y cierre de repuestos en el frontend y en memoria, pero la migracion PostgreSQL no tiene tablas para:

- `part_sales`
- `part_sale_items`

Por eso, si se conecta Supabase real hoy, la API de venta de repuestos queda incompleta.

Recomendacion: antes de vender esto como sistema real, crear migracion de ventas de repuestos y adaptar `DatabaseStore.createPartSale()` para guardar la venta en transaccion.

## Backend historico

Tambien existe un backend Express en `services/api`.

Tiene:

- Express.
- Helmet.
- CORS.
- Morgan.
- JWT.
- Zod.
- Store en memoria.
- Pruebas automatizadas con Vitest y Supertest.

El backend Express cubre el flujo MVP del taller, pero la app activa que estas viendo ahora es la version Next.js en la raiz.

## Pruebas existentes

Hay pruebas en:

```text
services/api/src/app.test.ts
```

Cubren:

- Login demo.
- Crear cliente.
- Crear vehiculo.
- Crear orden.
- Crear inspeccion.
- Crear repuesto.
- Consumir stock en orden.
- Buscar historial.
- Bloquear consumo cuando no hay stock suficiente.

No vi pruebas automatizadas para la app Next actual ni para el flujo nuevo de venta/cierre de repuestos.

## Estado actual del demo

El demo esta pensado para funcionar sin base real usando memoria local. Eso permite mostrar rapido:

- Taller
- Repuestos
- Venta por codigo
- Stock
- Cierre
- Respaldo

Limitacion: si el servidor local se apaga, se pierde la data demo porque esta en memoria.

## Lo que esta bien encaminado

- La estructura del proyecto esta ordenada.
- Hay documentos de arquitectura, API, base de datos, pruebas y despliegue.
- El flujo Taller ya tiene lo esencial del MVP.
- La UI ya separa Taller y FlowStock Repuestos.
- La venta de repuestos ya esta pensada como flujo rapido de mostrador.
- El cierre de repuestos ya esta ubicado donde corresponde: dentro de Repuestos, no dentro de Taller.
- Hay validaciones backend con Zod.
- Hay bloqueo de stock insuficiente.
- Hay normalizacion de patente.
- Hay fallback de memoria para demo.

## Problemas o riesgos

1. Las ventas de repuestos no estan persistidas en PostgreSQL.
2. No hay roles granulares reales mas alla del token y usuario admin demo.
3. No hay CRUD completo para editar/eliminar clientes, vehiculos, ordenes o repuestos.
4. No hay presupuestos implementados todavia.
5. No hay fotos ni almacenamiento de archivos.
6. No hay auditoria completa.
7. No hay paginacion ni filtros backend reales en listados.
8. No hay app movil Flutter implementada, solo estructura futura.
9. No hay offline/SQLite implementado.
10. El demo en memoria pierde datos al reiniciar servidor.
11. El boton de WhatsApp arma el mensaje, pero no hay integracion automatica.
12. El cierre exporta JSON, pero no genera PDF ni cierre contable formal.

## Prioridad recomendada para avanzar

### 1. Cerrar la base real de FlowStock Repuestos

- Agregar tablas `part_sales` y `part_sale_items`.
- Registrar venta en transaccion.
- Descontar stock en la misma transaccion.
- Registrar movimiento de stock por cada item vendido.
- Adaptar dashboard/cierre para leer desde base real.

### 2. Pulir flujo de venta

- Agregar descuento manual.
- Agregar numero de boleta/comprobante.
- Agregar cliente opcional.
- Agregar anulacion/devolucion.
- Agregar busqueda por codigo de barra real ademas de SKU.

### 3. Dejar Taller como flujo limpio

- Recepcion.
- Orden.
- Inspeccion.
- Presupuesto.
- Reparacion.
- Entrega.
- Historial.

### 4. Preparar piloto real

- Conectar Supabase.
- Variables de entorno seguras.
- Backups.
- Usuarios y roles.
- Pruebas del flujo completo.
- Deploy estable.

## Veredicto

El proyecto ya tiene una buena base para demo y venta visual. Sirve para mostrar la idea y probar el flujo con Pablo. Todavia no esta listo como sistema productivo porque falta persistencia completa de ventas de repuestos, roles, auditoria, presupuestos, fotos y pruebas de la app actual.

Mi recomendacion es no seguir agregando pantallas nuevas todavia. Primero conviene dejar solido el nucleo:

1. Venta de repuestos persistida.
2. Cierre de caja real.
3. Orden de taller con presupuesto.
4. Historial por patente presentable.
5. Respaldo/exportacion confiable.

Con eso ya se puede mostrar algo mucho mas serio y menos maqueta.
