# ARCHITECTURE.md

## Decision inicial

Se mantiene el stack propuesto:

- Flutter para aplicacion movil.
- Web responsiva para administracion.
- Node.js + TypeScript para backend.
- PostgreSQL como base central.
- SQLite en el movil para offline.
- API REST.

No se cambiara el stack sin una razon tecnica documentada y aprobacion.

## Vista general

```text
Mobile Flutter ----\
                    -> API REST Node.js/TypeScript -> PostgreSQL
Web Admin ---------/
                    -> Object storage / servidor de archivos

Mobile Flutter -> SQLite local -> sync_queue -> API REST
```

## Componentes

### Aplicacion movil

Responsable de operacion diaria desde celular o tablet:

- Consultar ordenes asignadas.
- Buscar patente o cliente.
- Registrar inspecciones.
- Agregar comentarios y fotos.
- Registrar repuestos usados.
- Cambiar estados de orden.
- Operar con datos locales cuando no exista conexion.

### Web administrativa

Responsable de operacion desde computador:

- Dashboard.
- Clientes.
- Vehiculos.
- Ordenes.
- Inventario.
- Presupuestos.
- Reportes.
- Configuracion y usuarios.

### Backend

Responsable de reglas de negocio:

- Autenticacion y autorizacion.
- Validacion de entradas.
- CRUD transaccional.
- Auditoria.
- Descuento de stock.
- Sincronizacion.
- Manejo centralizado de errores.
- Health checks.

### PostgreSQL

Fuente central consolidada del negocio.

Debe tener migraciones versionadas y respaldos.

### SQLite movil

Base local para:

- Datos necesarios offline.
- Cola durable de cambios pendientes.
- Estado de sincronizacion.
- Reintentos y errores visibles.

### Archivos

Las fotografias y documentos se almacenaran fuera de la base relacional. La base debe guardar referencias, metadatos y relaciones con ordenes o inspecciones.

## Seguridad base

- HTTPS en produccion.
- Password hash robusto.
- Roles validados en backend.
- Secrets mediante variables de entorno.
- Consultas parametrizadas u ORM seguro.
- Rate limiting en autenticacion.
- Auditoria de acciones sensibles.

## Observabilidad

- Logging estructurado sin secretos.
- Correlation ID por request.
- Manejo centralizado de excepciones.
- Health check de servicio y base de datos.
- Registro explicito de errores de sincronizacion.

## Offline-first

La implementacion offline completa sera Fase 10, pero desde Fase 1 se deben disenar:

- Identificadores compatibles con sincronizacion.
- Timestamps consistentes.
- Contratos de API idempotentes donde aplique.
- Politica de conflictos.
- Estado visible de sync.

## Riesgos iniciales

- Sincronizacion offline puede duplicar o perder cambios si se disena tarde.
- Descuento de stock debe ser transaccional para evitar inventario inconsistente.
- Fotos offline requieren estrategia de cola separada.
- Roles solo en frontend no son seguridad suficiente.
