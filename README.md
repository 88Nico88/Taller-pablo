# Sistema de Gestion e Inventario para Taller Automotriz

Proyecto real para construir una plataforma web y movil de gestion operativa para talleres mecanicos.

El sistema debe centralizar clientes, vehiculos por patente, ordenes de trabajo, inspecciones, comentarios tecnicos, fotografias, presupuestos, inventario, repuestos utilizados e historial completo del vehiculo.

## Estado actual

Fase 0 completada: estructura inicial y documentacion base.

Fase 1 parcial y primer flujo MVP backend implementados:

- API Node.js + TypeScript.
- Login demo con JWT.
- Clientes.
- Vehiculos con patente normalizada y unica.
- Ordenes de trabajo.
- Inspecciones por orden.
- Repuestos.
- Consumo de repuestos por orden con descuento de stock.
- Bloqueo de consumo cuando no hay stock suficiente.
- Historial por vehiculo.
- Dashboard basico.
- Web administrativa minima conectada al API.

Persistencia actual: repositorio en memoria para desarrollo y pruebas. La migracion SQL inicial para PostgreSQL esta creada en `services/api/migrations/001_initial_schema.sql`.

## Stack inicial aprobado

- Mobile: Flutter.
- Web administrativa: web responsiva.
- Backend: Node.js + TypeScript.
- API: REST.
- Base central: PostgreSQL.
- Base local movil: SQLite.
- Archivos: almacenamiento de objetos o servidor de archivos.

## Flujo principal obligatorio

Cliente -> Vehiculo -> Ingreso -> Orden -> Inspeccion -> Presupuesto -> Reparacion -> Repuestos -> Cierre -> Historial.

Este flujo tiene prioridad sobre funciones secundarias.

## Estructura del repositorio

```text
apps/
  mobile/      Aplicacion movil Flutter.
  web/         Web administrativa responsiva.
services/
  api/         Backend Node.js + TypeScript.
packages/
  shared/      Tipos, contratos y utilidades compartidas.
infra/         Configuracion de despliegue, base de datos y servicios.
docs/          Documentacion tecnica adicional.
scripts/       Herramientas operativas del proyecto.
```

## Documentos principales

- [PROJECT.md](PROJECT.md): vision, alcance y fases.
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura tecnica.
- [DATABASE.md](DATABASE.md): modelo de datos inicial y reglas.
- [API.md](API.md): contrato REST inicial.
- [REQUIREMENTS.md](REQUIREMENTS.md): requerimientos funcionales y no funcionales.
- [TESTING.md](TESTING.md): estrategia de pruebas.
- [CHANGELOG.md](CHANGELOG.md): historial de cambios.

## Regla de avance

No avanzar de fase sin estabilidad, pruebas relevantes, documentacion actualizada y aprobacion explicita.

## Ejecutar backend

```bash
cd services/api
npm install
npm run dev
```

Credenciales demo:

- Email: `admin@taller.local`
- Password: `admin12345`

Health check:

```bash
curl http://localhost:3000/health
```

## Ejecutar web

Con el backend levantado en `http://localhost:3000`, abrir:

```text
apps/web/index.html
```

La web permite iniciar sesion demo, crear cliente, vehiculo, orden, repuesto, descontar stock y buscar historial por patente.
