document.addEventListener('DOMContentLoaded', function() {
    const stockForm = document.getElementById('stock-form');
    const stockList = document.getElementById('stock-list');
    const searchInput = document.getElementById('search-product');
    let currentEditId = null;

    // Función para formatear la cantidad con puntos y comas
    function formatQuantity(quantity) {
        return quantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Función para obtener y mostrar el stock
    function fetchStock() {
        fetch('/api/stock')
            .then(response => response.json())
            .then(data => {
                displayStock(data.data);  // Muestra el stock actualizado en la tabla
                cargarProductosEnSulfatos();  // Actualiza la lista de productos en sulfatos.js inmediatamente
            });
    }

    // Función para mostrar el stock en la tabla
    function displayStock(stockItems) {
        stockList.innerHTML = '';
        stockItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.producto}</td>
                <td>${item.funcion}</td>
                <td>${formatQuantity(item.cantidad)} ${item.unidad}</td> <!-- Mostrar cantidad con la unidad -->
                <td>${item.dosis || ''}</td> <!-- Mostrar la dosis -->
                <td>${item.incompatibilidad || ''}</td>
                <td class="actions">
                <button class="edit-stock-btn" data-id="${item.id}">Editar</button>
                <button class="delete-stock-btn" data-id="${item.id}">Eliminar</button>
            </td>
            `;
            stockList.appendChild(row);
        });
    }

    // Función para añadir o actualizar un producto en stock
    stockForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(stockForm);
        const stockData = {
            producto: formData.get('producto'),
            funcion: formData.get('funcion'), // Obtener el valor de la función
            cantidad: parseFloat(formData.get('cantidad').replace(',', '.')),
            unidad: formData.get('unidad'),
            dosis: formData.get('dosis'), // Obtener el valor de la dosis
            incompatibilidad: formData.get('incompatibilidad') // Obtener el valor de la incompatibilidad
        };

        let method = 'POST';
        let url = '/api/stock';

        if (currentEditId) {
            method = 'PUT';
            url = `/api/stock/${currentEditId}`;
        }

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stockData)
        })
        .then(response => response.json())
        .then(data => {
            fetchStock();  // Actualiza la lista de stock y recarga los productos en sulfatos.js
            stockForm.reset();
            currentEditId = null;  // Resetear el ID de edición
        });
    });

    // Función para cargar los productos en la lista de sulfatos (la función se llama desde sulfatos.js)
    function cargarProductosEnSulfatos() {
        fetch('/api/stock')
            .then(response => response.json())
            .then(data => {
                populateProductoList(data.data);  // Usar función existente en sulfatos.js para recargar la lista
            });
    }

    // Función para llenar la lista de productos en sulfatos.js (se asegura que se actualice la lista visualmente)
    function populateProductoList(stockItems) {
        const productoList = document.getElementById('producto-list'); // Asegúrate de que el elemento esté disponible
        productoList.innerHTML = ''; // Limpiar la lista
        stockItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.producto;
            li.style.display = 'none'; // Ocultar todos los elementos al inicio
            li.addEventListener('click', function() {
                document.getElementById('producto-sulfato').value = item.producto;
                productoList.style.display = 'none';
            });
            productoList.appendChild(li);
        });
    }

    // Función para eliminar un producto de stock
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-stock-btn')) {
            const stockId = e.target.getAttribute('data-id');

            // Guardar el ID del stock a eliminar en una variable global
            window.stockToDelete = stockId;

            // Mostrar el modal de confirmación
            document.getElementById('delete-confirmation-modal-stock').style.display = 'block';
        }
    });

    document.getElementById('confirm-delete-stock').addEventListener('click', function() {
        const stockId = window.stockToDelete;
        if (stockId) {
            fetch(`/api/stock/${stockId}`, {
                method: 'DELETE'
            })
            .then(() => {
                fetchStock();  // Vuelve a cargar el stock después de eliminar un producto

                // Mostrar mensaje de deshacer
                document.getElementById('undo-message-stock').style.display = 'block';

                // Ocultar el modal
                document.getElementById('delete-confirmation-modal-stock').style.display = 'none';

                // Ocultar el mensaje de deshacer después de 5 segundos
                setTimeout(() => {
                    document.getElementById('undo-message-stock').style.display = 'none';
                }, 5000);
            });
        }
    });

    document.getElementById('cancel-delete-stock').addEventListener('click', function() {
        // Ocultar el modal de confirmación sin hacer nada
        document.getElementById('delete-confirmation-modal-stock').style.display = 'none';
    });

    // Cerrar el modal al hacer clic en la 'X'
    document.querySelector('.modal .close').addEventListener('click', function() {
        document.getElementById('delete-confirmation-modal-stock').style.display = 'none';
    });

    document.getElementById('undo-delete-stock').addEventListener('click', function(e) {
        e.preventDefault();

        fetch('/api/stock/undo', {
            method: 'POST'
        })
        .then(() => {
            fetchStock();  // Vuelve a cargar el stock después de deshacer la eliminación
            document.getElementById('undo-message-stock').style.display = 'none';
        });
    });

    // Función para editar un producto de stock
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('edit-stock-btn')) {
            const stockId = e.target.getAttribute('data-id');
            fetch(`/api/stock/${stockId}`)
                .then(response => response.json())
                .then(data => {
                    const item = data.data;
                    document.getElementById('producto').value = item.producto;
                    document.getElementById('funcion').value = item.funcion; // Cargar la función en el formulario
                    document.getElementById('cantidad').value = item.cantidad;
                    document.getElementById('unidad').value = item.unidad;
                    document.getElementById('dosis').value = item.dosis;
                    document.getElementById('incompatibilidad').value = item.incompatibilidad || ''; // Cargar la incompatibilidad en el formulario
                    currentEditId = stockId;  // Guardar el ID para la edición
                })
                .catch(error => console.error("Error fetching product data for editing:", error));  // Manejo de errores
        }
    });

    // Función para buscar productos
    searchInput.addEventListener('input', function() {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = stockList.querySelectorAll('tr');
        rows.forEach(row => {
            const productCell = row.querySelector('td:first-child').textContent.toLowerCase();
            row.style.display = productCell.includes(searchTerm) ? '' : 'none';
        });
    });

    // Inicializar la lista de stock y asegurarse de que los productos estén disponibles en sulfatos.js
    fetchStock();
});
