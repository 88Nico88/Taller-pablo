# DEPLOYMENT.md

## Separacion obligatoria

Este proyecto no debe desplegarse en infraestructura, dominios, repositorios, bases de datos ni configuraciones de FlowStock.

Nombre recomendado:

- GitHub: `Taller-Automotriz-Pablo`
- Vercel: `taller-automotriz-pablo`
- Supabase: `taller-automotriz-pablo`

## GitHub

Crear un repositorio nuevo y exclusivo para este proyecto.

Luego configurar remote:

```bash
git remote add origin git@github.com:88Nico88/Taller-Automotriz-Pablo.git
git push -u origin main
```

Si se usa deploy key, debe ser una llave nueva y exclusiva para este repo.

## Vercel

El repo ya incluye `vercel.json` para servir el boceto funcional:

- `/` -> `apps/web/boceto-demo.html`
- `/demo` -> `apps/web/boceto-demo.html`
- `/app` -> `apps/web/index.html`

Variables futuras:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
```

## Supabase

Crear proyecto Supabase separado.

Aplicar migracion:

```text
supabase/migrations/20260825000000_initial_schema.sql
```

Usar el pooler de Supabase para backend server-side:

```text
postgresql://postgres.<project-ref>:<password>@aws-...pooler.supabase.com:6543/postgres?sslmode=require
```

No reutilizar la base de FlowStock.

## Estado actual

El frontend demo es desplegable como sitio estatico.

El backend API corre localmente y tiene migracion SQL preparada. Falta conectar repositorio persistente a PostgreSQL/Supabase antes de declarar backend productivo.
