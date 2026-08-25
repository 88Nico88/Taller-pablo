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

El repo incluye una aplicacion Next.js en la raiz, siguiendo la base tecnica del proyecto Comercial JRD:

- `/` -> app operativa Next.js
- `/api/health` -> health general
- `/api/health/db` -> health PostgreSQL/Supabase
- `/api/*` -> endpoints operativos

Configuracion Vercel:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

Variables:

```text
DATABASE_URL
DATABASE_SSL=true
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
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

La aplicacion raiz es desplegable en Vercel como Next.js fullstack.

Si `DATABASE_URL` esta configurado, la API usa PostgreSQL/Supabase. Si no esta configurado, usa memoria local solo para desarrollo/demo.

Antes de declarar productivo:

- aplicar la migracion Supabase;
- configurar variables en Vercel;
- verificar `/api/health/db`;
- crear `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` reales;
- revisar RLS/politicas si se expone acceso directo desde Supabase.
