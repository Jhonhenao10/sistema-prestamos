const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./capitalflow.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, telefono TEXT, direccion TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS prestamos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, monto_prestado REAL, plazo_dias INTEGER, frecuencia TEXT, cuota_diaria REAL, total_a_pagar REAL, fecha_prestamo TEXT, estado TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, prestamo_id INTEGER, fecha TEXT, monto_esperado REAL, monto_pagado REAL, estado_pago TEXT)");
});

// --- CLIENTES ---
app.get('/api/clientes', (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, rows) => res.json(rows || []));
});
app.post('/api/clientes', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefono, direccion], function(err) { res.json({ id: this.lastID }); });
});
app.put('/api/clientes/:id', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("UPDATE clientes SET nombre = ?, telefono = ?, direccion = ? WHERE id = ?", [nombre, telefono, direccion, req.params.id], function(err) { res.json({ updated: this.changes }); });
});
app.delete('/api/clientes/:id', (req, res) => {
    const clienteId = req.params.id;
    db.all("SELECT id FROM prestamos WHERE cliente_id = ?", [clienteId], (err, rows) => {
        if(rows && rows.length > 0) {
            rows.forEach(p => db.run("DELETE FROM pagos WHERE prestamo_id = ?", [p.id]));
        }
        db.run("DELETE FROM prestamos WHERE cliente_id = ?", [clienteId], () => {
            db.run("DELETE FROM clientes WHERE id = ?", [clienteId], function(err) { res.json({ deleted: this.changes }); });
        });
    });
});

// --- PRÉSTAMOS Y CUOTAS ---
app.get('/api/prestamos', (req, res) => {
    const q = "SELECT p.*, c.nombre as cliente_nombre, (SELECT COUNT(*) FROM pagos pg WHERE pg.prestamo_id = p.id AND pg.estado_pago = 'NO PAGADO') as faltas FROM prestamos p JOIN clientes c ON p.cliente_id = c.id";
    db.all(q, [], (err, rows) => res.json(rows || []));
});

app.post('/api/prestamos', (req, res) => {
    const { cliente_id, monto_prestado, plazo_dias, frecuencia } = req.body;
    const montoNum = parseFloat(monto_prestado);
    const dias = parseInt(plazo_dias);
    const total = montoNum * 1.26;
    const cuota = total / dias;
    
    const hoy = new Date();
    const fechaStr = hoy.toISOString().split('T')[0];
    
    db.run("INSERT INTO prestamos (cliente_id, monto_prestado, plazo_dias, frecuencia, cuota_diaria, total_a_pagar, fecha_prestamo, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVO')",
        [cliente_id, montoNum, dias, frecuencia, cuota, total, fechaStr], function(err) {
            if(err) return res.status(500).json({ error: err.message });
            const prestamoId = this.lastID;
            
            let stmt = db.prepare("INSERT INTO pagos (prestamo_id, fecha, monto_esperado, monto_pagado, estado_pago) VALUES (?, ?, ?, 0, 'NO PAGADO')");
            let d = new Date(hoy);
            let cuotasGeneradas = 0;
            
            // Generar cuotas saltando domingos (getDay() === 0 es domingo)
            while(cuotasGeneradas < dias) {
                d.setDate(d.getDate() + 1);
                if (d.getDay() !== 0) { // Si no es domingo, cuenta como día de cobro
                    let dStr = d.toISOString().split('T')[0];
                    stmt.run(prestamoId, dStr, cuota);
                    cuotasGeneradas++;
                }
            }
            stmt.finalize(() => { res.json({ id: prestamoId }); });
        });
});

app.get('/api/prestamo/:id/cuotas', (req, res) => {
    db.all("SELECT * FROM pagos WHERE prestamo_id = ?", [req.params.id], (err, rows) => res.json(rows || []));
});

app.put('/api/cuotas/:id', (req, res) => {
    const { monto_pagado, monto_esperado } = req.body;
    let estado = 'NO PAGADO';
    if(monto_pagado >= monto_esperado) {
        estado = 'PAGADO';
    } else if(monto_pagado > 0) {
        estado = 'PARCIAL';
    }

    db.run("UPDATE pagos SET monto_pagado = ?, estado_pago = ? WHERE id = ?", [monto_pagado, estado, req.params.id], function(err) {
        res.json({ updated: this.changes });
    });
});

// --- DASHBOARD ---
app.get('/api/dashboard/stats', (req, res) => {
    db.get("SELECT SUM(cuota_diaria) as c, SUM(monto_prestado) as m, COUNT(*) as n FROM prestamos WHERE estado = 'ACTIVO'", (err, row) => {
        db.get("SELECT COUNT(*) as cl FROM clientes", (err2, row2) => {
            res.json({ 
                capital_prestado: row && row.m ? row.m : 0, 
                cartera_total: row && row.c ? row.c : 0, 
                prestamos_activos: row && row.n ? row.n : 0, 
                total_clientes: row2 && row2.cl ? row2.cl : 0 
            });
        });
    });
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));