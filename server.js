const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const session = require('express-session');

// =======================================================================
//                           CONFIGURACIÓN DEL SERVIDOR
// =======================================================================

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  // Asegurar que los datos JSON se manejen correctamente
//app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'ssg0897',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }  // 1 hora de duración
}));

// Variables de entorno para las credenciales
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const VIEW_USERNAME = process.env.VIEW_USERNAME;
const VIEW_PASSWORD = process.env.VIEW_PASSWORD;

// Variables para almacenamiento temporal
let lastDeletedAlbaran = null;
let lastDeletedStock = null;
let lastDeletedGasto = null;
let lastDeletedCobro = null;
let lastDeletedSulfatos = null;
let lastDeletedriegos = null;
// Variable para la campaña seleccionada
let currentCampaign = '2024-2025';
let db = null;

// =======================================================================
//                           FUNCIONES AUXILIARES
// =======================================================================

/**
 * Función para inicializar la conexión a la base de datos en función de la campaña seleccionada.
 */
function initializeDatabase(campaign) {
    const dbPath = path.join(__dirname, `albaranes_${campaign}.db`);
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err.message);
        } else {
            console.log(`Conectado a la base de datos SQLite para la campaña ${campaign}.`);
        }
    });

    // Crear las tablas si no existen para la campaña seleccionada
    db.run(`CREATE TABLE IF NOT EXISTS albaranes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        albaran TEXT NOT NULL,
        fecha TEXT NOT NULL,
        kilos REAL NOT NULL,
        importe REAL NOT NULL,
        invernadero TEXT
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla de albaranes:', err.message);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS cobros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        importe REAL NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla de cobros:', err.message);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concepto TEXT NOT NULL,
        fecha TEXT NOT NULL,
        importe REAL NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla de gastos:', err.message);
        }
    });
}

// **Conectar a la base de datos común para `stock`, `sulfatos`, y `proveedores`:**
const commonDbPath = path.join(__dirname, 'albaranes_2024-2025.db');
const commonDb = new sqlite3.Database(commonDbPath, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos común:', err.message);
    } else {
        console.log('Conectado a la base de datos común SQLite.');
    }
});

// Crear las tablas en la base de datos común si no existen
commonDb.run(`CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto TEXT NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT NOT NULL,
    funcion TEXT
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla de stock en la base de datos común:', err.message);
    }
});

commonDb.run(`ALTER TABLE stock ADD COLUMN incompatibilidad TEXT`, (err) => {
    if (err) {
        // Comprobamos si el error no es porque la columna ya existe (en SQLite, sería el error "duplicate column name")
        if (err.message.includes("duplicate column name")) {
            console.log('La columna "incompatibilidad" ya existe en la tabla de stock.');
        } else {
            console.error('Error al añadir la columna incompatibilidad a la tabla de stock:', err.message);
        }
    } else {
        console.log('Columna "incompatibilidad" añadida correctamente a la tabla de stock.');
    }
});
commonDb.run(`ALTER TABLE stock ADD COLUMN dosis TEXT`, (err) => {
    if (err) {
        if (err.message.includes("duplicate column name")) {
            console.log('La columna "dosis" ya existe en la tabla de stock.');
        } else {
            console.error('Error al añadir la columna dosis a la tabla de stock:', err.message);
        }
    } else {
        console.log('Columna "dosis" añadida correctamente a la tabla de stock.');
    }
});


commonDb.run(`CREATE TABLE IF NOT EXISTS sulfatos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    producto TEXT NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT NOT NULL,
    invernadero TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla de sulfatos en la base de datos común:', err.message);
    }
});

// Modificación de la tabla sulfatos para añadir la columna pH, si no existe
commonDb.run(`ALTER TABLE sulfatos ADD COLUMN ph REAL`, (err) => {
    if (err) {
        // Comprobamos si el error no es porque la columna ya existe (en SQLite, sería el error "duplicate column name")
        if (err.message.includes("duplicate column name")) {
            console.log('La columna "ph" ya existe en la tabla de sulfatos.');
        } else {
            console.error('Error al añadir la columna ph a la tabla de sulfatos:', err.message);
        }
    } else {
        console.log('Columna "ph" añadida correctamente a la tabla de sulfatos.');
    }
});

commonDb.run(`CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla de proveedores en la base de datos común:', err.message);
    }
});
// Crear la tabla de campañas si no existe
commonDb.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla de campañas:', err.message);
    } else {
        // Insertar la campaña inicial si la tabla está vacía
        commonDb.run(`INSERT OR IGNORE INTO campaigns (name) VALUES ('2024-2025')`);
    }
});

// Crear tabla de riegos
commonDb.run(`CREATE TABLE IF NOT EXISTS riegos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    producto TEXT NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT NOT NULL,
    invernadero TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla de riegos:', err.message);
    }
});
// Modificación de la tabla sulfatos para añadir la columna pH, si no existe
commonDb.run(`ALTER TABLE riegos ADD COLUMN ph REAL`, (err) => {
    if (err) {
        // Comprobamos si el error no es porque la columna ya existe (en SQLite, sería el error "duplicate column name")
        if (err.message.includes("duplicate column name")) {
            console.log('La columna "ph" ya existe en la tabla de riegos.');
        } else {
            console.error('Error al añadir la columna ph a la tabla de riegos:', err.message);
        }
    } else {
        console.log('Columna "ph" añadida correctamente a la tabla de riegos.');
    }
});


// Inicializar la base de datos con la campaña por defecto
initializeDatabase(currentCampaign);

// =======================================================================
//                           AUTENTICACIÓN
// =======================================================================

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === USERNAME && password === PASSWORD) {
        req.session.user = username;
        req.session.role = 'admin'; // Asignar rol de administrador
        res.redirect('/');
    } else if (username === VIEW_USERNAME && password === VIEW_PASSWORD) {
        req.session.user = username;
        req.session.role = 'viewer'; // Asignar rol de solo lectura
        res.redirect('/');
    } else {
        res.redirect('/login.html?error=1'); // Redirige al login con un parámetro de error
    }
});

function authMiddleware(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login.html');
    }
}

// Middleware para restringir acceso a acciones de escritura solo para administradores
function adminMiddleware(req, res, next) {
    if (req.session.role === 'admin') {
        return next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: solo los administradores pueden realizar esta acción.' });
    }
}

// Rutas accesibles sin autenticación
app.use('/login.html', express.static(path.join(__dirname, 'public/login.html')));
app.use('/login.css', express.static(path.join(__dirname, 'public/login.css')));  // Asegúrate de que login.css esté en /public

// Rutas protegidas por autenticación
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));  // Archivos estáticos

// Ruta raíz protegida
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));  // Cambia según tu página principal
});

// Ruta para verificar la sesión
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, role: req.session.role });
    } else {
        res.json({ authenticated: false });
    }
});

// =======================================================================
//                           CAMPAÑAS
// =======================================================================
// Ruta para obtener la campaña actual
app.get('/api/current-campaign', authMiddleware, (req, res) => {
    res.json({ campaign: currentCampaign });
});

/**
 * Ruta para cambiar de campaña o crear una nueva campaña (solo admin).
 */
app.post('/api/campaign', authMiddleware, (req, res) => {
    const { campaign } = req.body;

    if (!campaign) {
        return res.status(400).json({ error: 'El nombre de la campaña es requerido' });
    }

    currentCampaign = campaign;
    initializeDatabase(currentCampaign); // Inicializar la nueva base de datos

    const sql = 'INSERT OR IGNORE INTO campaigns (name) VALUES (?)';
    commonDb.run(sql, [campaign], (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ message: `Campaña cambiada a ${currentCampaign}`, campaign: currentCampaign });
    });
});

app.get('/api/campaigns', authMiddleware, (req, res) => {
    const sql = 'SELECT name FROM campaigns ORDER BY id';
    commonDb.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        const campaigns = rows.map(row => row.name);
        res.json({ campaigns });
    });
});

// =======================================================================
//                           ALBARANES
// =======================================================================

// Obtener todos los albaranes (disponible para todos)
app.get('/api/albaranes', authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM albaranes ORDER BY id';
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Crear un nuevo albarán (solo admin)
app.post('/api/albaranes', authMiddleware, adminMiddleware, (req, res) => {
    const { albaran, fecha, kilos, importe, invernadero } = req.body;
    const sql = 'INSERT INTO albaranes (albaran, fecha, kilos, importe, invernadero) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [albaran, fecha, kilos, importe, invernadero], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: { id: this.lastID, albaran, fecha, kilos, importe, invernadero } });
    });
});

// Eliminar un albarán (solo admin)
app.delete('/api/albaranes/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;
    const sqlSelect = 'SELECT * FROM albaranes WHERE id = ?';
    db.get(sqlSelect, [id], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (!row) {
            res.status(404).json({ error: 'Albarán no encontrado' });
            return;
        }

        lastDeletedAlbaran = row;

        const sqlDelete = 'DELETE FROM albaranes WHERE id = ?';
        db.run(sqlDelete, [id], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ data: lastDeletedAlbaran, message: 'Albarán eliminado', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de un albarán (solo admin)
app.post('/api/albaranes/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedAlbaran) {
        return res.status(400).json({ error: 'No hay albarán para deshacer la eliminación' });
    }

    const { albaran, fecha, kilos, importe, invernadero } = lastDeletedAlbaran;
    const sql = 'INSERT INTO albaranes (albaran, fecha, kilos, importe, invernadero) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [albaran, fecha, kilos, importe, invernadero], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: 'Eliminación deshecha', data: { id: this.lastID, albaran, fecha, kilos, importe, invernadero } });
        lastDeletedAlbaran = null;
    });
});

// =======================================================================
//                           COBROS
// =======================================================================

// Obtener todos los cobros (disponible para todos)
app.get('/api/cobros', authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM cobros ORDER BY id';
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Crear un nuevo cobro (solo admin)
app.post('/api/cobros', authMiddleware, adminMiddleware, (req, res) => {
    const { fecha, importe } = req.body;
    const sql = 'INSERT INTO cobros (fecha, importe) VALUES (?, ?)';
    db.run(sql, [fecha, importe], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: { id: this.lastID, fecha, importe } });
    });
});

// Eliminar un cobro (solo admin)
app.delete('/api/cobros/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;
    const sqlSelect = 'SELECT * FROM cobros WHERE id = ?';
    db.get(sqlSelect, [id], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (!row) {
            return res.status(404).json({ error: 'Cobro no encontrado' });
        }

        lastDeletedCobro = row;

        const sqlDelete = 'DELETE FROM cobros WHERE id = ?';
        db.run(sqlDelete, [id], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ data: lastDeletedCobro, message: 'Cobro eliminado', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de un cobro (solo admin)
app.post('/api/cobros/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedCobro) {
        return res.status(400).json({ error: 'No hay cobro para deshacer la eliminación' });
    }

    const { fecha, importe } = lastDeletedCobro;
    const sql = 'INSERT INTO cobros (fecha, importe) VALUES (?, ?)';
    db.run(sql, [fecha, importe], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: 'Eliminación deshecha', data: { id: this.lastID, fecha, importe } });
        lastDeletedCobro = null; // Limpiar la variable después de deshacer
    });
});

// =======================================================================
//                           GASTOS
// =======================================================================

// Obtener todos los gastos
app.get('/api/gastos',authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM gastos ORDER BY id';
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Crear un nuevo gasto
app.post('/api/gastos',authMiddleware, (req, res) => {
    const { concepto, fecha, importe } = req.body;
    const sql = 'INSERT INTO gastos (concepto, fecha, importe) VALUES (?, ?, ?)';
    db.run(sql, [concepto, fecha, importe], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: { id: this.lastID, concepto, fecha, importe } });
    });
});

// Crear múltiples gastos
app.post('/api/gastos/multiple',authMiddleware, (req, res) => {
    const gastos = req.body;
    const sql = 'INSERT INTO gastos (concepto, fecha, importe) VALUES (?, ?, ?)';
    const stmt = db.prepare(sql);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        for (const gasto of gastos) {
            stmt.run(gasto.concepto, gasto.fecha, gasto.importe, (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    res.status(400).json({ error: err.message });
                    return;
                }
            });
        }
        db.run("COMMIT", (err) => {
            if (err) {
                res.status(400).json({ error: err.message });
            } else {
                res.json({ message: 'Gastos añadidos correctamente' });
            }
        });
    });

    stmt.finalize();
});

// Eliminar un gasto
app.delete('/api/gastos/:id',authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;

    const sqlSelect = 'SELECT * FROM gastos WHERE id = ?';
    db.get(sqlSelect, [id], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (!row) {
            res.status(404).json({ error: 'Gasto no encontrado' });
            return;
        }

        lastDeletedGasto = row;

        const sqlDelete = 'DELETE FROM gastos WHERE id = ?';
        db.run(sqlDelete, [id], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ data: lastDeletedGasto, message: 'Gasto eliminado', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de un gasto
app.post('/api/gastos/undo',authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedGasto) {
        return res.status(400).json({ error: 'No hay gasto para deshacer la eliminación' });
    }

    const { concepto, fecha, importe } = lastDeletedGasto;
    const sql = 'INSERT INTO gastos (concepto, fecha, importe) VALUES (?, ?, ?)';
    db.run(sql, [concepto, fecha, importe], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: 'Eliminación deshecha', data: { id: this.lastID, concepto, fecha, importe } });
        lastDeletedGasto = null;
    });
});

// =======================================================================
//                           PROVEEDORES
// =======================================================================

// Obtener lista de proveedores (disponible para todos)
app.get('/api/proveedores', authMiddleware, (req, res) => {
    const sql = 'SELECT DISTINCT concepto FROM gastos ORDER BY concepto';
    commonDb.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        const proveedores = rows.map(row => row.concepto);
        res.json(proveedores);
    });
});

// =======================================================================
//                           STOCK
// =======================================================================

// Obtener todos los productos del stock (disponible para todos)
app.get('/api/stock', authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM stock ORDER BY id';
    commonDb.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Añadir o actualizar un producto en el stock (solo admin)
app.post('/api/stock', authMiddleware, adminMiddleware, (req, res) => {
    const { producto, funcion, cantidad, unidad, dosis, incompatibilidad } = req.body;
    const sqlSelect = 'SELECT * FROM stock WHERE producto = ? AND unidad = ?';
    commonDb.get(sqlSelect, [producto, unidad], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (row) {
            // Si el producto ya existe, actualizar la cantidad, función, dosis e incompatibilidad
            const nuevaCantidad = row.cantidad + cantidad;
            const sqlUpdate = 'UPDATE stock SET cantidad = ?, funcion = ?, dosis = ?, incompatibilidad = ? WHERE id = ?';
            commonDb.run(sqlUpdate, [nuevaCantidad, funcion, dosis, incompatibilidad, row.id], function(err) {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                res.json({ data: { id: row.id, producto, funcion, cantidad: nuevaCantidad, unidad, dosis, incompatibilidad } });
            });
        } else {
            // Si el producto no existe, añadirlo
            const sqlInsert = 'INSERT INTO stock (producto, funcion, cantidad, unidad, dosis, incompatibilidad) VALUES (?, ?, ?, ?, ?, ?)';
            commonDb.run(sqlInsert, [producto, funcion, cantidad, unidad, dosis, incompatibilidad], function(err) {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                res.json({ data: { id: this.lastID, producto, funcion, cantidad, unidad, dosis, incompatibilidad } });
            });
        }
    });
});


// Eliminar un producto del stock (solo admin)
app.delete('/api/stock/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;

    const sqlSelect = 'SELECT * FROM stock WHERE id = ?';
    commonDb.get(sqlSelect, [id], (err, row) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Almacenar el producto eliminado, incluyendo la dosis
        lastDeletedStock = row;

        const sqlDelete = 'DELETE FROM stock WHERE id = ?';
        commonDb.run(sqlDelete, [id], function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            res.json({ message: 'Producto eliminado', undoAvailable: true });
        });
    });
});


// Deshacer la eliminación de un producto en stock (solo admin)
// Deshacer la eliminación de un producto en stock (solo admin)
app.post('/api/stock/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedStock) {
        return res.status(400).json({ error: 'No hay producto para deshacer la eliminación' });
    }

    const { producto, funcion, cantidad, unidad, dosis, incompatibilidad } = lastDeletedStock;
    const sql = 'INSERT INTO stock (producto, funcion, cantidad, unidad, dosis, incompatibilidad) VALUES (?, ?, ?, ?, ?, ?)';
    commonDb.run(sql, [producto, funcion, cantidad, unidad, dosis, incompatibilidad], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ message: 'Eliminación deshecha', data: { id: this.lastID, producto, funcion, cantidad, unidad, dosis, incompatibilidad } });
        lastDeletedStock = null;  // Limpiar la variable después de deshacer
    });
});


// Obtener un producto específico del stock por ID (disponible para todos)
app.get('/api/stock/:id', authMiddleware, (req, res) => {
    const id = req.params.id;

    const sql = 'SELECT * FROM stock WHERE id = ?';
    commonDb.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ data: row });
    });
});


// Actualizar un producto específico del stock por ID (solo admin)
app.put('/api/stock/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;
    const { producto, funcion, cantidad, unidad, dosis, incompatibilidad } = req.body;

    const sqlUpdate = 'UPDATE stock SET producto = ?, funcion = ?, cantidad = ?, unidad = ?, dosis = ?, incompatibilidad = ? WHERE id = ?';
    commonDb.run(sqlUpdate, [producto, funcion, cantidad, unidad, dosis, incompatibilidad, id], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Producto no encontrado o sin cambios' });
        }

        res.json({ message: 'Producto actualizado correctamente', data: { id, producto, funcion, cantidad, unidad, dosis, incompatibilidad } });
    });
});


// =======================================================================
//                           SULFATOS
// =======================================================================

// Obtener todos los sulfatos (disponible para todos)
app.get('/api/sulfatos', authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM sulfatos ORDER BY fecha';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error al obtener los sulfatos:', err.message);
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Modificación en la ruta POST para agregar el pH (solo admin)
app.post('/api/sulfatos', authMiddleware, adminMiddleware, (req, res) => {
    const { fecha, producto, cantidad, unidad, invernadero, ph } = req.body;

    if (!fecha || !producto || !cantidad || !unidad || !invernadero) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const sqlSelect = 'SELECT * FROM sulfatos WHERE fecha = ? AND producto = ? AND unidad = ? AND invernadero = ?';
    db.get(sqlSelect, [fecha, producto, unidad, invernadero], (err, row) => {
        if (err) {
            console.error('Error al buscar sulfato existente:', err.message);
            res.status(400).json({ error: err.message });
            return;
        }

        if (row) {
            // Si el sulfato ya existe, sumamos la cantidad
            const nuevaCantidad = row.cantidad + cantidad;
            const sqlUpdate = 'UPDATE sulfatos SET cantidad = ?, ph = ? WHERE id = ?';
            db.run(sqlUpdate, [nuevaCantidad, ph, row.id], function(err) {
                if (err) {
                    console.error('Error al actualizar el sulfato:', err.message);
                    res.status(400).json({ error: err.message });
                    return;
                }
                updateStock(producto, -cantidad, unidad);
                res.json({ data: { id: row.id, fecha, producto, cantidad: nuevaCantidad, unidad, invernadero, ph } });
            });
        } else {
            // Si no existe, lo insertamos como un nuevo registro
            const sqlInsert = 'INSERT INTO sulfatos (fecha, producto, cantidad, unidad, invernadero, ph) VALUES (?, ?, ?, ?, ?, ?)';
            db.run(sqlInsert, [fecha, producto, cantidad, unidad, invernadero, ph], function(err) {
                if (err) {
                    console.error('Error al registrar el sulfato:', err.message);
                    res.status(400).json({ error: err.message });
                    return;
                }
                updateStock(producto, -cantidad, unidad);
                res.json({ data: { id: this.lastID, fecha, producto, cantidad, unidad, invernadero, ph } });
            });
        }
    });
});

// Eliminar un sulfato con confirmación y opción de deshacer (solo admin)
app.delete('/api/sulfatos', authMiddleware, adminMiddleware, (req, res) => {
    const { fecha, invernadero } = req.query;

    if (!fecha || !invernadero) {
        return res.status(400).json({ error: 'Fecha e invernadero son requeridos' });
    }

    const sqlSelect = 'SELECT * FROM sulfatos WHERE fecha = ? AND invernadero = ?';
    db.all(sqlSelect, [fecha, invernadero], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron registros de sulfatos para eliminar' });
        }

        // Guardar los registros eliminados para poder deshacer la eliminación
        lastDeletedSulfatos = rows;

        // Revertir las cantidades eliminadas al stock
        rows.forEach(row => {
            const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad + ? WHERE producto = ? AND unidad = ?';
            db.run(sqlUpdateStock, [row.cantidad, row.producto, row.unidad], function(err) {
                if (err) {
                    console.error('Error al actualizar el stock:', err.message);
                }
            });
        });

        // Eliminar todos los registros coincidentes
        const sqlDelete = 'DELETE FROM sulfatos WHERE fecha = ? AND invernadero = ?';
        db.run(sqlDelete, [fecha, invernadero], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ message: 'Registro de sulfatos eliminado correctamente', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de sulfatos (solo admin)
app.post('/api/sulfatos/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedSulfatos) {
        return res.status(400).json({ error: 'No hay registro de sulfatos para deshacer la eliminación' });
    }

    // Reinsertar los registros eliminados
    const sqlInsert = 'INSERT INTO sulfatos (fecha, producto, cantidad, unidad, invernadero) VALUES (?, ?, ?, ?, ?)';
    db.serialize(() => {
        lastDeletedSulfatos.forEach((row) => {
            db.run(sqlInsert, [row.fecha, row.producto, row.cantidad, row.unidad, row.invernadero], function(err) {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                // Restar las cantidades reinsertadas del stock
                const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad - ? WHERE producto = ? AND unidad = ?';
                db.run(sqlUpdateStock, [row.cantidad, row.producto, row.unidad], function(err) {
                    if (err) {
                        console.error('Error al actualizar el stock:', err.message);
                    }
                });
            });
        });
    });

    lastDeletedSulfatos = null;  // Limpiar la variable después de deshacer
    res.json({ message: 'Eliminación deshecha correctamente' });
});

// Función para actualizar el stock al añadir o eliminar sulfatos
function updateStock(producto, cantidad, unidad) {
    const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad + ? WHERE producto = ? AND unidad = ?';
    db.run(sqlUpdateStock, [cantidad, producto, unidad], function(err) {
        if (err) {
            console.error('Error al actualizar el stock:', err.message);
        }
    });
}

// Almacenar los últimos productos eliminados para deshacer
let lastDeletedProduct = null;

// Eliminar un producto individual de sulfato con confirmación y opción de deshacer (solo admin)
app.delete('/api/sulfatos/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'ID del producto es requerido' });
    }

    const sqlSelect = 'SELECT * FROM sulfatos WHERE id = ?';
    db.get(sqlSelect, [id], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (!row) {
            return res.status(404).json({ error: 'No se encontró el producto de sulfato para eliminar' });
        }

        // Guardar el registro eliminado para poder deshacer la eliminación
        lastDeletedProduct = row;

        // Revertir la cantidad eliminada al stock
        const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad + ? WHERE producto = ? AND unidad = ?';
        db.run(sqlUpdateStock, [row.cantidad, row.producto, row.unidad], function(err) {
            if (err) {
                console.error('Error al actualizar el stock:', err.message);
            }
        });

        // Eliminar el producto individual del sulfato
        const sqlDelete = 'DELETE FROM sulfatos WHERE id = ?';
        db.run(sqlDelete, [id], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ message: 'Producto de sulfato eliminado correctamente', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de un producto individual (solo admin)
app.post('/api/sulfatos/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedProduct) {
        return res.status(400).json({ error: 'No hay producto de sulfato para deshacer la eliminación' });
    }

    // Reinsertar el producto eliminado
    const sqlInsert = 'INSERT INTO sulfatos (fecha, producto, cantidad, unidad, invernadero, ph) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sqlInsert, [lastDeletedProduct.fecha, lastDeletedProduct.producto, lastDeletedProduct.cantidad, lastDeletedProduct.unidad, lastDeletedProduct.invernadero, lastDeletedProduct.ph], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        // Restar la cantidad reinsertada del stock
        const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad - ? WHERE producto = ? AND unidad = ?';
        db.run(sqlUpdateStock, [lastDeletedProduct.cantidad, lastDeletedProduct.producto, lastDeletedProduct.unidad], function(err) {
            if (err) {
                console.error('Error al actualizar el stock:', err.message);
            }
        });

        lastDeletedProduct = null;  // Limpiar la variable después de deshacer
        res.json({ message: 'Eliminación de producto deshecha correctamente' });
    });
});


// =======================================================================
//                           RIEGOS
// =======================================================================

// Obtener todos los riegos (disponible para todos)
app.get('/api/riegos', authMiddleware, (req, res) => {
    const sql = 'SELECT * FROM riegos ORDER BY fecha';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error al obtener los riegos:', err.message);
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Modificación en la ruta POST para agregar el pH (solo admin)
app.post('/api/riegos', authMiddleware, adminMiddleware, (req, res) => {
    const { fecha, producto, cantidad, unidad, invernadero, ph } = req.body;

    if (!fecha || !producto || !cantidad || !unidad || !invernadero) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const sqlSelect = 'SELECT * FROM riegos WHERE fecha = ? AND producto = ? AND unidad = ? AND invernadero = ?';
    db.get(sqlSelect, [fecha, producto, unidad, invernadero], (err, row) => {
        if (err) {
            console.error('Error al buscar riego existente:', err.message);
            res.status(400).json({ error: err.message });
            return;
        }

        if (row) {
            // Si el riego ya existe, sumamos la cantidad
            const nuevaCantidad = row.cantidad + cantidad;
            const sqlUpdate = 'UPDATE riegos SET cantidad = ?, ph = ? WHERE id = ?';
            db.run(sqlUpdate, [nuevaCantidad, ph, row.id], function(err) {
                if (err) {
                    console.error('Error al actualizar el riego:', err.message);
                    res.status(400).json({ error: err.message });
                    return;
                }
                updateStock(producto, -cantidad, unidad);
                res.json({ data: { id: row.id, fecha, producto, cantidad: nuevaCantidad, unidad, invernadero, ph } });
            });
        } else {
            // Si no existe, lo insertamos como un nuevo registro
            const sqlInsert = 'INSERT INTO riegos (fecha, producto, cantidad, unidad, invernadero, ph) VALUES (?, ?, ?, ?, ?, ?)';
            db.run(sqlInsert, [fecha, producto, cantidad, unidad, invernadero, ph], function(err) {
                if (err) {
                    console.error('Error al registrar el riego:', err.message);
                    res.status(400).json({ error: err.message });
                    return;
                }
                updateStock(producto, -cantidad, unidad);
                res.json({ data: { id: this.lastID, fecha, producto, cantidad, unidad, invernadero, ph } });
            });
        }
    });
});

// Eliminar un riego con confirmación y opción de deshacer (solo admin)
app.delete('/api/riegos', authMiddleware, adminMiddleware, (req, res) => {
    const { fecha, invernadero } = req.query;

    if (!fecha || !invernadero) {
        return res.status(400).json({ error: 'Fecha e invernadero son requeridos' });
    }

    const sqlSelect = 'SELECT * FROM riegos WHERE fecha = ? AND invernadero = ?';
    db.all(sqlSelect, [fecha, invernadero], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron registros de riegos para eliminar' });
        }

        // Guardar los registros eliminados para poder deshacer la eliminación
        lastDeletedriegos = rows;

        // Revertir las cantidades eliminadas al stock
        rows.forEach(row => {
            const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad + ? WHERE producto = ? AND unidad = ?';
            db.run(sqlUpdateStock, [row.cantidad, row.producto, row.unidad], function(err) {
                if (err) {
                    console.error('Error al actualizar el stock:', err.message);
                }
            });
        });

        // Eliminar todos los registros coincidentes
        const sqlDelete = 'DELETE FROM riegos WHERE fecha = ? AND invernadero = ?';
        db.run(sqlDelete, [fecha, invernadero], function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ message: 'Registro de riegos eliminado correctamente', undoAvailable: true });
        });
    });
});

// Deshacer la eliminación de riegos (solo admin)
app.post('/api/riegos/undo', authMiddleware, adminMiddleware, (req, res) => {
    if (!lastDeletedriegos) {
        return res.status(400).json({ error: 'No hay registro de riegos para deshacer la eliminación' });
    }

    // Reinsertar los registros eliminados
    const sqlInsert = 'INSERT INTO riegos (fecha, producto, cantidad, unidad, invernadero) VALUES (?, ?, ?, ?, ?)';
    db.serialize(() => {
        lastDeletedriegos.forEach((row) => {
            db.run(sqlInsert, [row.fecha, row.producto, row.cantidad, row.unidad, row.invernadero], function(err) {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                // Restar las cantidades reinsertadas del stock
                const sqlUpdateStock = 'UPDATE stock SET cantidad = cantidad - ? WHERE producto = ? AND unidad = ?';
                db.run(sqlUpdateStock, [row.cantidad, row.producto, row.unidad], function(err) {
                    if (err) {
                        console.error('Error al actualizar el stock:', err.message);
                    }
                });
            });
        });
    });

    lastDeletedriegos = null;  // Limpiar la variable después de deshacer
    res.json({ message: 'Eliminación deshecha correctamente' });
});



// =======================================================================
//                           INICIALIZAR SERVIDOR
// =======================================================================

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
