# DATABASE.md

## Base central

Motor propuesto: PostgreSQL.

Toda modificacion estructural debe realizarse mediante migraciones versionadas. No se debe modificar produccion manualmente sin procedimiento, respaldo y plan de rollback.

## Entidades iniciales

### users

- id
- nombre
- email
- password_hash
- rol
- activo
- created_at
- updated_at

### customers

- id
- nombre
- rut opcional
- telefono
- telefono_alternativo
- email
- direccion
- comuna
- notas
- created_at
- updated_at
- deleted_at

### vehicles

- id
- customer_id
- patente
- vin
- marca
- modelo
- version
- anio
- color
- combustible
- transmision
- kilometraje
- notas_permanentes
- created_at
- updated_at
- deleted_at

### work_orders

- id
- vehicle_id
- mechanic_id
- received_by_user_id
- fecha_ingreso
- fecha_estimada_entrega
- kilometraje
- nivel_combustible
- motivo
- sintomas
- diagnostico_inicial
- diagnostico_definitivo
- prioridad
- estado
- created_at
- updated_at
- closed_at

### inspections

- id
- work_order_id
- sistema
- elemento
- estado
- comentario
- created_by_user_id
- created_at
- updated_at

### comments

- id
- work_order_id
- inspection_id opcional
- user_id
- tipo
- texto
- visible_cliente
- created_at

### parts

- id
- sku
- codigo_fabricante
- codigo_barras
- nombre
- descripcion
- categoria
- marca
- proveedor
- costo
- precio
- stock
- stock_minimo
- ubicacion
- activo
- created_at
- updated_at

### stock_movements

- id
- part_id
- tipo
- cantidad
- work_order_id opcional
- user_id
- motivo
- created_at

### work_order_parts

- id
- work_order_id
- part_id
- cantidad
- precio_unitario
- costo_unitario
- created_at

### photos

- id
- vehicle_id opcional
- work_order_id
- inspection_id opcional
- referencia_archivo
- descripcion
- created_by_user_id
- created_at
- sync_status

### quotes

- id
- work_order_id
- estado
- subtotal
- descuento
- impuesto
- total
- approved_at
- approval_method
- created_at
- updated_at

### sync_queue

Tabla local movil, no necesariamente central:

- id local
- entidad
- operacion
- payload
- estado
- intentos
- ultimo_error
- created_at
- updated_at

## Reglas criticas

- La patente debe ser unica dentro del contexto definido por el negocio.
- No consumir stock inexistente sin autorizacion explicita y auditada.
- Todo movimiento de inventario debe dejar registro inmutable.
- Cerrar una orden no borra diagnosticos, inspecciones, comentarios ni movimientos.
- Las fotografias deben asociarse a orden y, cuando corresponda, a inspeccion.
- Acciones sensibles registran usuario, fecha y hora.
- Eliminaciones operacionales deben ser logicas cuando corresponda.
- Operaciones criticas deben ser transaccionales.

## Indices iniciales sugeridos

- vehicles.patente
- customers.nombre
- customers.telefono
- work_orders.vehicle_id
- work_orders.estado
- work_orders.fecha_ingreso
- parts.sku
- parts.nombre
- stock_movements.part_id

## Auditoria

La auditoria se definira en Fase 1. Como minimo, acciones sensibles deben registrar:

- usuario
- fecha y hora
- entidad
- operacion
- valor anterior cuando corresponda
- valor nuevo cuando corresponda
- origen de la accion
