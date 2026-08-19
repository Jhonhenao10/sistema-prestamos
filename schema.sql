-- 1. Tabla de Clientes
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Préstamos
CREATE TABLE prestamos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    monto_prestado DECIMAL(10, 2) NOT NULL,
    total_a_pagar DECIMAL(10, 2) NOT NULL,
    cuota_diaria DECIMAL(10, 2) NOT NULL,
    plazo_dias INTEGER NOT NULL,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'activo' -- 'activo', 'finalizado', 'atrasado'
);

-- 3. Tabla de Pagos
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    prestamo_id INTEGER REFERENCES prestamos(id) ON DELETE CASCADE,
    monto_pagado DECIMAL(10, 2) NOT NULL,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);