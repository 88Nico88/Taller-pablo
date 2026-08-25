# PROJECT.md

## Nombre

Sistema de Gestion e Inventario para Taller Automotriz.

## Objetivo

Construir una aplicacion movil y web estable para que un taller automotriz gestione clientes, vehiculos, patentes, ordenes de trabajo, inspecciones, comentarios, fotografias, presupuestos, inventario, repuestos utilizados e historial tecnico completo.

## Principios del proyecto

1. Integridad de datos y estabilidad primero.
2. Flujo operativo simple desde celular.
3. Trazabilidad completa por cliente, vehiculo y patente.
4. Inventario consistente y auditable.
5. Diseno preparado para offline y sincronizacion confiable.

## Alcance del MVP

El MVP debe permitir:

- Iniciar sesion con roles basicos.
- Registrar clientes y contactos.
- Registrar vehiculos por patente.
- Crear ingresos y ordenes de trabajo.
- Completar inspecciones por sistemas del vehiculo.
- Agregar comentarios tecnicos y fotografias.
- Cambiar estados del vehiculo.
- Registrar repuestos e insumos.
- Descontar repuestos usados en una orden.
- Crear presupuesto basico.
- Consultar historial por patente.
- Buscar por patente, cliente, VIN, telefono u orden.
- Revisar un dashboard operativo basico.

## Fuera del MVP inicial

Estas funciones quedan para etapas posteriores:

- WhatsApp automatico.
- Facturacion electronica.
- Portal del cliente.
- Analitica avanzada.
- Compras automaticas.
- IA para asistencia tecnica.
- Integraciones con equipos externos.
- Servidor local del taller.

## Roles

### Administrador o dueno

Acceso completo a usuarios, reportes, configuracion, inventario, precios, ordenes, vehiculos y auditoria.

### Recepcion

Gestiona clientes, vehiculos, ingresos, presupuestos, agenda, entregas y datos de contacto.

### Mecanico

Consulta ordenes asignadas, registra diagnosticos, completa inspecciones, agrega comentarios, fotografias, tareas realizadas y repuestos utilizados.

## Flujo principal obligatorio

Cliente -> Vehiculo -> Ingreso -> Orden -> Inspeccion -> Presupuesto -> Reparacion -> Repuestos -> Cierre -> Historial.

Este recorrido debe estar estable antes de agregar funciones secundarias.

## Fases

### Fase 0: Inicializacion

Crear estructura del repositorio y documentacion base.

### Fase 1: Base tecnica

Backend, base central, migraciones, configuracion, autenticacion y manejo global de errores.

### Fase 2: Clientes

CRUD, validaciones, busqueda y pruebas.

### Fase 3: Vehiculos

CRUD, patente, asociacion con cliente, busqueda e historial base.

### Fase 4: Ordenes

Ingreso, estados, mecanico, diagnostico y auditoria.

### Fase 5: Inspecciones

Sistemas, elementos, estados, comentarios y fotos.

### Fase 6: Inventario

Repuestos, stock, movimientos, minimos y auditoria.

### Fase 7: Consumo por orden

Vincular repuestos con ordenes y descontar stock transaccionalmente.

### Fase 8: Presupuestos

Detalle, mano de obra, estados y aprobacion.

### Fase 9: Dashboard e historial

Panel operativo, busqueda global y linea de tiempo por patente.

### Fase 10: Offline

SQLite, cache, cola, sincronizacion, conflictos y reintentos.

### Fase 11: QA y piloto

Pruebas integrales, rendimiento, respaldo/restauracion y piloto real.

## Regla de finalizacion de cada fase

Cada fase debe cerrar con:

- Codigo implementado, cuando corresponda.
- Migraciones actualizadas, cuando corresponda.
- Validaciones y manejo de errores.
- Pruebas automatizadas relevantes.
- Prueba manual del flujo principal.
- Documentacion actualizada.
- CHANGELOG actualizado.
- Resumen de archivos modificados.
- Problemas o deuda tecnica declarados.

No comenzar la siguiente fase hasta que la fase actual este estable y aprobada.
