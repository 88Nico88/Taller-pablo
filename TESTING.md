# TESTING.md

## Estrategia general

Las pruebas deben crecer por fases. No se debe declarar una funcion terminada sin probar su flujo principal y errores esperables.

## Tipos de prueba

### Unitarias

Para reglas de negocio:

- Validacion de patente.
- Cambio de estados.
- Calculo de presupuesto.
- Descuento de stock.
- Permisos por rol.

### Integracion

Para backend y base de datos:

- CRUD con validaciones.
- Migraciones.
- Transacciones de inventario.
- Busqueda por patente.
- Historial por vehiculo.

### API

Para contratos REST:

- Auth.
- Clientes.
- Vehiculos.
- Ordenes.
- Inventario.
- Presupuestos.
- Errores normalizados.

### Manuales

Prueba del flujo real:

1. Crear cliente.
2. Crear vehiculo con patente.
3. Crear orden de trabajo.
4. Agregar inspeccion.
5. Agregar comentario y foto.
6. Agregar repuesto.
7. Ver descuento de stock.
8. Crear y aprobar presupuesto.
9. Cerrar orden.
10. Buscar patente y revisar historial.

### Offline

En Fase 10:

- Usar app sin Internet.
- Crear cambios pendientes.
- Recuperar conexion.
- Ver sincronizacion correcta.
- Simular conflicto entre dos dispositivos.
- Validar fotos pendientes.

## Criterio minimo por fase

Cada fase debe entregar:

- Pruebas automatizadas relevantes.
- Prueba manual documentada.
- Resultado de pruebas.
- Deuda tecnica conocida.

## No permitido

- Omitir pruebas por apuro.
- Ignorar errores conocidos.
- Modificar datos productivos sin migracion o procedimiento.
- Considerar "funciona en mi maquina" como aceptacion.
