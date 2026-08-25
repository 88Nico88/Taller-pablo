# REQUIREMENTS.md

## Requerimientos funcionales

### Clientes

- Crear, leer, actualizar y desactivar clientes.
- Buscar por nombre, telefono, email o RUT.
- Asociar uno o varios vehiculos a un cliente.

### Vehiculos

- Registrar vehiculos por patente.
- Guardar VIN, marca, modelo, version, anio, color, combustible, transmision y kilometraje.
- Asociar vehiculo a cliente.
- Ver historial cronologico por patente.
- Registrar alertas u observaciones permanentes.

### Ordenes de trabajo

- Crear orden desde un vehiculo.
- Registrar motivo, sintomas, kilometraje, prioridad y mecanico responsable.
- Cambiar estado del vehiculo.
- Registrar diagnostico inicial y definitivo.
- Cerrar orden sin borrar informacion historica.

### Inspecciones

- Inspeccionar por sistemas: motor, frenos, suspension, direccion, neumaticos, electrico, transmision, escape, carroceria y otros.
- Marcar estado por elemento: bueno, requiere atencion, requiere reparacion o no revisado.
- Agregar comentario y fotografia.

### Comentarios y fotos

- Agregar notas internas.
- Agregar observaciones visibles para cliente.
- Asociar fotos a orden o inspeccion.
- Registrar usuario, fecha y hora.

### Inventario

- Registrar repuestos e insumos.
- Controlar stock actual, stock minimo y ubicacion.
- Registrar entradas, salidas, ajustes y devoluciones.
- Alertar bajo stock.
- Mantener historial de movimientos.

### Repuestos por orden

- Asociar repuestos utilizados a una orden.
- Descontar stock de forma transaccional.
- Impedir consumo sin stock salvo autorizacion auditada.

### Presupuestos

- Crear presupuesto con repuestos, mano de obra, descuento, impuesto y total.
- Estados: borrador, enviado, aprobado, parcialmente aprobado y rechazado.
- Registrar fecha y forma de aprobacion.

### Dashboard

- Mostrar vehiculos por estado.
- Mostrar ordenes esperando aprobacion.
- Mostrar repuestos bajo minimo.
- Mostrar trabajos atrasados o detenidos.

### Busqueda global

- Buscar por patente, cliente, telefono, VIN, numero de orden o repuesto.

### Offline

- Consultar datos previamente sincronizados.
- Crear comentarios, diagnosticos e inspecciones sin conexion.
- Registrar cambios de estado y repuestos usados sin conexion cuando sea permitido.
- Mantener cola de cambios pendientes.
- Sincronizar al recuperar conexion.

## Requerimientos no funcionales

- Interfaz simple y responsiva.
- Usabilidad prioritaria en celular.
- Validacion clara de datos.
- Manejo centralizado de errores.
- Seguridad por roles en backend.
- Logging estructurado.
- Backups y restauracion probada.
- Migraciones versionadas.
- Pruebas automatizadas por modulo.
- Proteccion de datos personales.

## Criterios de aceptacion del primer hito

El primer hito funcional se acepta cuando se pueda:

1. Registrar un cliente.
2. Asociar un vehiculo.
3. Crear una orden.
4. Realizar una inspeccion.
5. Registrar repuestos utilizados.
6. Cerrar el trabajo.
7. Recuperar toda la historia buscando la patente.

## Restricciones

- No guardar secretos en el repositorio.
- No guardar contrasenas en texto plano.
- No desactivar pruebas para simular exito.
- No eliminar datos operacionales sin respaldo y aprobacion.
- No agregar integraciones externas antes de estabilizar el MVP.
