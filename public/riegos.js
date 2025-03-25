document.addEventListener('DOMContentLoaded', function() {
    const riegoForm = document.getElementById('riego-form');
    const riegoList = document.getElementById('riego-list');
    const productTableBody = document.querySelector('#product-riego-table tbody');
    const addProductBtn = document.getElementById('add-product-riego-btn');
    const registerriegoBtn = document.getElementById('register-riego-btn');
    const productoSearch = document.getElementById('producto-riego'); // Campo de búsqueda de productos
    const productoList = document.getElementById('producto-riego-list'); // Lista desplegable de productos
    
    const stockList = {};  // Almacenar el stock actual
    let productsToAdd = []; // Almacenar los productos que se van a añadir
    let riegoToDelete = null; // Para almacenar el riego que se va a eliminar

    // Función para formatear la cantidad con puntos y comas
    function formatQuantity(quantity) {
        return quantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Función para formatear la fecha a dd/mm/aaaa
    function formatDate(fecha) {
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
    }

    // Función para obtener y mostrar el stock disponible
    function fetchStock() {
        return fetch('/api/stock')
            .then(response => response.json())
            .then(data => {
                data.data.forEach(item => {
                    stockList[item.producto] = {
                        cantidad: parseFloat(item.cantidad),
                        unidad: item.unidad,
                        id: item.id
                    };
                });
                populateProductoList(data.data);
            });
    }

    // Función para llenar la lista de productos en la búsqueda
    function populateProductoList(stockItems) {
        productoList.innerHTML = ''; // Limpiar la lista
        stockItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.producto;
            li.style.display = 'none'; // Ocultar todos los elementos al inicio
            li.addEventListener('click', function() {
                productoSearch.value = item.producto;
                productoList.style.display = 'none';
            });
            productoList.appendChild(li);
        });
    }

    // Evento para filtrar los productos en la lista desplegable
    productoSearch.addEventListener('input', function() {
        const searchTerm = productoSearch.value.toLowerCase();
        const items = productoList.querySelectorAll('li');
        let visibleItems = 0;
        items.forEach(item => {
            if (item.textContent.toLowerCase().includes(searchTerm)) {
                item.style.display = 'block';
                visibleItems++;
            } else {
                item.style.display = 'none';
            }
        });
        if (searchTerm && visibleItems > 0) {
            productoList.style.display = 'block';
        } else {
            productoList.style.display = 'none';
        }
    });

    // Función para obtener y mostrar los riegos registrados
    function fetchriegos() {
        fetch('/api/riegos')
            .then(response => response.json())
            .then(data => {
                displayriegos(data.data);
            });
    }

    // Función para mostrar los riegos en la tabla
    function displayriegos(riegoItems) {
        riegoList.innerHTML = '';
        const groupedriegos = riegoItems.reduce((acc, item) => {
            const key = `${item.fecha}-${item.invernadero}`;
            if (!acc[key]) {
                acc[key] = {
                    fecha: item.fecha,
                    invernadero: item.invernadero,
                    productos: [],
                    ph: item.ph // Incluir pH en el grupo
                };
            }
            acc[key].productos.push(item);
            return acc;
        }, {});

        Object.keys(groupedriegos).forEach((key, groupIndex) => {
            const group = groupedriegos[key];
            const numProductos = group.productos.length;
            const isOddGroup = groupIndex % 2 === 0;

            group.productos.forEach((item, index) => {
                const row = document.createElement('tr');
                const rowClass = isOddGroup ? 'odd-row' : 'even-row';

                row.classList.add(rowClass);

                if (index === 0) {
                    row.innerHTML = `
                        <td rowspan="${numProductos}" class="${rowClass}">${formatDate(group.fecha)}</td>
                        <td class="${rowClass}">${item.producto}</td>
                        <td class="${rowClass}">${formatQuantity(item.cantidad)} ${item.unidad}</td>
                        <td rowspan="${numProductos}" class="${rowClass}">${group.invernadero}</td>
                        <td rowspan="${numProductos}" class="${rowClass}">${group.ph}</td> <!-- Mostrar pH en la tabla -->
                        <td rowspan="${numProductos}" class="${rowClass}"><button class="delete-riego-btn" data-fecha="${group.fecha}" data-invernadero="${group.invernadero}">Eliminar</button></td>
                    `;
                } else {
                    row.innerHTML = `
                        <td class="${rowClass}">${item.producto}</td>
                        <td class="${rowClass}">${formatQuantity(item.cantidad)} ${item.unidad}</td>
                    `;
                }

                riegoList.appendChild(row);
            });
        });

        // Añadir eventos para manejar el hover
        document.querySelectorAll('#riego-list tr').forEach(row => {
            row.addEventListener('mouseover', () => row.classList.add('hovered-row'));
            row.addEventListener('mouseout', () => row.classList.remove('hovered-row'));
        });
    }

    // Función para actualizar el stock después de registrar un riego
    function updateStock(producto, cantidad, unidad) {
        if (stockList[producto]) {
            stockList[producto].cantidad -= cantidad;
            if (stockList[producto].cantidad <= 0) {
                stockList[producto].cantidad = 0;
            }

            fetch(`/api/stock/${stockList[producto].id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cantidad: stockList[producto].cantidad,
                    unidad: unidad
                })
            }).then(() => fetchStock());  // Asegura que el stock esté actualizado inmediatamente después de la actualización
        }
    }

    // Evento para añadir un producto al registro de riegos
    addProductBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const producto = productoSearch.value.trim();
        const cantidad = parseFloat(document.getElementById('cantidad-riego').value);
        const unidad = document.getElementById('unidad-riego').value;

        if (!producto || isNaN(cantidad) || cantidad <= 0) {
            alert('Por favor, ingrese un producto y una cantidad válida.');
            return;
        }

        // Verificar si el producto existe en el stock
        if (!stockList[producto]) {
            alert(`El producto "${producto}" no existe en el stock.`);
            return;
        }

        // Verificar si la cantidad solicitada es mayor que la disponible en el stock
        if (stockList[producto].cantidad < cantidad) {
            alert(`No hay suficiente stock para el producto "${producto}". Cantidad disponible: ${stockList[producto].cantidad} ${unidad}.`);
            return;
        }

        productsToAdd.push({ producto, cantidad, unidad });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto}</td>
            <td>${formatQuantity(cantidad)} ${unidad}</td>
        `;
        productTableBody.appendChild(row);

        productoSearch.value = '';
        document.getElementById('cantidad-riego').value = '';
        document.getElementById('unidad-riego').value = 'KG';
    });

    // Evento para registrar todos los productos añadidos en el riego
    registerriegoBtn.addEventListener('click', function(e) {
        e.preventDefault();

        if (productsToAdd.length === 0) {
            alert('Por favor, agregue al menos un producto antes de registrar el riego.');
            return;
        }

        const formData = new FormData(riegoForm);
        const fecha = formData.get('fecha');
        const invernadero = document.getElementById('invernadero-riego').value;
        const ph = parseFloat(document.getElementById('ph-riego').value); // Obtener el valor de pH

        const promises = productsToAdd.map(product => {
            const riegoData = {
                fecha,
                producto: product.producto,
                cantidad: product.cantidad,
                unidad: product.unidad,
                invernadero,
                ph // Incluir pH en los datos enviados
            };

            return fetch('/api/riegos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(riegoData)
            }).then(response => response.json())
              .then(() => {
                  updateStock(riegoData.producto, riegoData.cantidad, riegoData.unidad);
              });
        });

        Promise.all(promises).then(() => {
            productTableBody.innerHTML = '';
            productsToAdd = [];
            fetchriegos(); // Actualizar la lista de riegos
            riegoForm.reset();
        }).catch(error => {
            console.error('Error registrando los riegos:', error);
            alert('Ocurrió un error al registrar los riegos.');
        });
    });

    // Función para mostrar el modal de confirmación de eliminación
    function showConfirmationModal(fecha, invernadero) {
        riegoToDelete = { fecha, invernadero };
        document.getElementById('delete-confirmation-modal-riegos').style.display = 'block';
    }

    // Función para ocultar el modal de confirmación
    function hideConfirmationModal() {
        riegoToDelete = null;
        document.getElementById('delete-confirmation-modal-riegos').style.display = 'none';
    }

    // Función para eliminar un riego
    function deleteriego() {
        if (riegoToDelete) {
            const { fecha, invernadero } = riegoToDelete;

            fetch(`/api/riegos?fecha=${encodeURIComponent(fecha)}&invernadero=${encodeURIComponent(invernadero)}`, {
                method: 'DELETE'
            })
            .then(() => {
                fetchriegos();
                hideConfirmationModal();

                // Mostrar mensaje de deshacer
                document.getElementById('undo-message-riegos').style.display = 'block';

                // Ocultar el mensaje de deshacer después de 5 segundos
                setTimeout(() => {
                    document.getElementById('undo-message-riegos').style.display = 'none';
                }, 5000);
            })
            .catch(error => {
                console.error('Error al eliminar los riegos:', error);
                alert('Ocurrió un error al eliminar los riegos.');
            });
        }
    }

    // Función para deshacer la eliminación de un riego
    function undoDeleteriego() {
        fetch('/api/riegos/undo', {
            method: 'POST'
        })
        .then(() => {
            fetchriegos();
            document.getElementById('undo-message-riegos').style.display = 'none';
        })
        .catch(error => {
            console.error('Error al deshacer la eliminación de los riegos:', error);
            alert('Ocurrió un error al deshacer la eliminación de los riegos.');
        });
    }

    // Evento para capturar clics en los botones de eliminar riego
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-riego-btn')) {
            const fecha = e.target.getAttribute('data-fecha');
            const invernadero = e.target.getAttribute('data-invernadero');
            showConfirmationModal(fecha, invernadero);
        }
    });

    // Evento para confirmar la eliminación
    document.getElementById('confirm-delete-riegos').addEventListener('click', deleteriego);

    // Evento para cancelar la eliminación
    document.getElementById('cancel-delete-riegos').addEventListener('click', hideConfirmationModal);

    // Evento para cerrar el modal cuando se hace clic en la 'X'
    document.querySelector('#delete-confirmation-modal-riegos .close').addEventListener('click', hideConfirmationModal);

    // Evento para deshacer la eliminación
    document.getElementById('undo-delete-riegos').addEventListener('click', function(e) {
        e.preventDefault();
        undoDeleteriego();
    });

    // Inicializar la lista de stock y riegos
    fetchStock().then(fetchriegos);
});
