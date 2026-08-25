CREATE TABLE users (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'reception', 'mechanic')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  rut text,
  telefono text NOT NULL,
  telefono_alternativo text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  patente text NOT NULL UNIQUE,
  vin text,
  marca text NOT NULL,
  modelo text NOT NULL,
  version text,
  anio integer,
  color text,
  kilometraje integer NOT NULL DEFAULT 0,
  notas_permanentes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE work_orders (
  id uuid PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  mechanic_id uuid REFERENCES users(id),
  received_by_user_id uuid NOT NULL REFERENCES users(id),
  fecha_ingreso timestamptz NOT NULL DEFAULT now(),
  fecha_estimada_entrega timestamptz,
  kilometraje integer NOT NULL,
  nivel_combustible text,
  motivo text NOT NULL,
  sintomas text,
  diagnostico_inicial text,
  diagnostico_definitivo text,
  prioridad text NOT NULL DEFAULT 'normal',
  estado text NOT NULL DEFAULT 'recibido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES work_orders(id),
  sistema text NOT NULL,
  elemento text NOT NULL,
  estado text NOT NULL,
  comentario text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE parts (
  id uuid PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  nombre text NOT NULL,
  marca text,
  descripcion text,
  costo numeric(12,2) NOT NULL DEFAULT 0,
  precio numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 0,
  ubicacion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY,
  part_id uuid NOT NULL REFERENCES parts(id),
  tipo text NOT NULL,
  cantidad integer NOT NULL,
  work_order_id uuid REFERENCES work_orders(id),
  user_id uuid NOT NULL REFERENCES users(id),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_order_parts (
  id uuid PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES work_orders(id),
  part_id uuid NOT NULL REFERENCES parts(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(12,2) NOT NULL,
  costo_unitario numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_patente ON vehicles(patente);
CREATE INDEX idx_customers_nombre ON customers(nombre);
CREATE INDEX idx_work_orders_vehicle_id ON work_orders(vehicle_id);
CREATE INDEX idx_work_orders_estado ON work_orders(estado);
CREATE INDEX idx_parts_nombre ON parts(nombre);
