# CHANGELOG.md

## 2026-08-25 - Fase 0

### Agregado

- Estructura inicial del proyecto real.
- README con vision, stack, flujo principal y documentos.
- PROJECT.md con alcance, roles, MVP y fases.
- ARCHITECTURE.md con arquitectura propuesta y riesgos iniciales.
- DATABASE.md con modelo de datos base y reglas criticas.
- API.md con contrato REST inicial.
- REQUIREMENTS.md con requerimientos funcionales y no funcionales.
- TESTING.md con estrategia de pruebas.

### No implementado todavia

- Backend.
- Base de datos.
- Migraciones.
- Autenticacion.
- App movil.
- Web administrativa.
- Modulos de negocio.

### Siguiente fase

Fase 1: base tecnica.

## 2026-08-25 - Avance posterior aprobado

### Agregado

- Backend API con Node.js + TypeScript y Express.
- Configuracion, scripts de build, dev, typecheck y test.
- Login demo con JWT y password hash.
- Middleware de autenticacion Bearer token.
- Validacion de entradas con Zod.
- Manejo normalizado de errores.
- Health check.
- Endpoints iniciales para clientes, vehiculos, ordenes, inspecciones, repuestos, consumo de repuestos, historial y dashboard.
- Repositorio en memoria para poder ejecutar pruebas sin depender de Postgres local.
- Migracion SQL inicial preparada para PostgreSQL.
- Pruebas automatizadas del flujo MVP y bloqueo de stock insuficiente.
- Web administrativa minima en HTML/CSS/JS conectada al API.

### Verificado

- `npm run typecheck` exitoso.
- `npm run build` exitoso.
- `npm test` exitoso: 1 archivo, 2 pruebas.
- Health check local respondio `{"status":"ok"}`.

### Pendiente

- Persistencia real en PostgreSQL.
- Autorizacion granular por rol.
- Fotos y almacenamiento de archivos.
- Presupuestos.
- App Flutter.
- Sincronizacion offline.

## 2026-08-25 - Boceto funcional

### Agregado

- `apps/web/boceto-demo.html`: prototipo navegable autocontenido, sin backend.
- Dashboard visual con estados del taller.
- Ingreso rapido de orden demo.
- Inspeccion por partes.
- Consumo de repuestos con bloqueo por stock insuficiente.
- Historial por patente.
- Speech de presentacion dentro del boceto.
- `docs/SPEECH.md` con discurso corto y version resumida.

## 2026-08-25 - Preparacion GitHub/Vercel/Supabase

### Agregado

- `.gitignore` raiz.
- `.env.example` raiz.
- `vercel.json` para desplegar el boceto como sitio estatico independiente.
- `docs/DEPLOYMENT.md` con reglas de separacion y pasos para GitHub, Vercel y Supabase.
- `supabase/migrations/20260825000000_initial_schema.sql` como migracion inicial separada.

### Nota

No se configuro remote ni deploy real porque no hay credenciales activas de GitHub, Vercel ni Supabase en este entorno.
