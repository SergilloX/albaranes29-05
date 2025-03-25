document.addEventListener('DOMContentLoaded', function() {
    const sulfatoForm = document.getElementById('sulfato-form');
    const sulfatoList = document.getElementById('sulfato-list');
    const productTableBody = document.querySelector('#product-table tbody');
    const addProductBtn = document.getElementById('add-product-btn');
    const registerSulfatoBtn = document.getElementById('register-sulfato-btn');
    const productoSearch = document.getElementById('producto-sulfato'); // Campo de búsqueda de productos
    const productoList = document.getElementById('producto-list'); // Lista desplegable de productos

    const stockList = {};  // Almacenar el stock actual
    let productsToAdd = []; // Almacenar los productos que se van a añadir
    let productToDelete = null; // Producto que se va a eliminar

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
    function fetchStock2() {
    return fetch('/api/stock')
        .then(response => response.json())
        .then(data => {
            data.data.forEach(item => {
                stockList[item.producto] = {
                    cantidad: parseFloat(item.cantidad),
                    unidad: item.unidad,
                    id: item.id,
                    funcion: item.funcion,  // Asegúrate de incluir todos los campos necesarios
                    dosis: item.dosis,
                    incompatibilidad: item.incompatibilidad
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

    // Función para obtener y mostrar los sulfatos registrados
    function fetchSulfatos() {
        fetch('/api/sulfatos')
            .then(response => response.json())
            .then(data => {
                displaySulfatos(data.data);
            });
    }

    // Función para mostrar los sulfatos en la tabla
    function displaySulfatos(sulfatoItems) {
        sulfatoList.innerHTML = '';
        const groupedSulfatos = sulfatoItems.reduce((acc, item) => {
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

        Object.keys(groupedSulfatos).forEach((key, groupIndex) => {
            const group = groupedSulfatos[key];
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
                        <td class="${rowClass}">
                            <button class="delete-product-btn" data-id="${item.id}">Eliminar</button>
                        </td>
                    `;
                } else {
                    row.innerHTML = `
                        <td class="${rowClass}">${item.producto}</td>
                        <td class="${rowClass}">${formatQuantity(item.cantidad)} ${item.unidad}</td>
                        <td class="${rowClass}">
                            <button class="delete-product-btn" data-id="${item.id}">Eliminar</button>
                        </td>
                    `;
                }

                sulfatoList.appendChild(row);
            });
        });

        // Añadir eventos para manejar el hover
        document.querySelectorAll('#sulfato-list tr').forEach(row => {
            row.addEventListener('mouseover', () => row.classList.add('hovered-row'));
            row.addEventListener('mouseout', () => row.classList.remove('hovered-row'));
        });
    }
  // Función para actualizar el stock después de registrar un sulfato
    function updateStock(producto, cantidad, unidad) {
    if (stockList[producto]) {
        stockList[producto].cantidad -= cantidad;
        if (stockList[producto].cantidad <= 0) {
            stockList[producto].cantidad = 0;
        }
        
        // Agrega todos los campos necesarios en el cuerpo del PUT
        fetch(`/api/stock/${stockList[producto].id}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        producto: producto,
        funcion: stockList[producto].funcion,
        cantidad: stockList[producto].cantidad,
        unidad: unidad,
        dosis: stockList[producto].dosis,
        incompatibilidad: stockList[producto].incompatibilidad
    })
}).then(response => {
    if (!response.ok) {
        return response.json().then(errorData => {
            console.error('Error del servidor:', errorData);
            throw new Error('Error en la solicitud PUT');
        });
    }
    return fetchStock2();
})
.catch(error => console.error('Error en la actualización del stock:', error));

    }
}
  

  
  // Evento para añadir un producto al registro de sulfatos
    addProductBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const producto = productoSearch.value.trim();
        const cantidad = parseFloat(document.getElementById('cantidad-sulfato').value);
        const unidad = document.getElementById('unidad-sulfato').value;

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
        document.getElementById('cantidad-sulfato').value = '';
        document.getElementById('unidad-sulfato').value = 'KG';
    });

    // Evento para registrar todos los productos añadidos en el sulfato
    registerSulfatoBtn.addEventListener('click', function(e) {
        e.preventDefault();

        if (productsToAdd.length === 0) {
            alert('Por favor, agregue al menos un producto antes de registrar el sulfato.');
            return;
        }

        const formData = new FormData(sulfatoForm);
        const fecha = formData.get('fecha');
        const invernadero = document.getElementById('invernadero-sulfato').value;
        const ph = parseFloat(document.getElementById('ph-sulfato').value); // Obtener el valor de pH

        const promises = productsToAdd.map(product => {
            const sulfatoData = {
                fecha,
                producto: product.producto,
                cantidad: product.cantidad,
                unidad: product.unidad,
                invernadero,
                ph // Incluir pH en los datos enviados
            };

            return fetch('/api/sulfatos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sulfatoData)
            }).then(response => response.json())
              .then(() => {
                  updateStock(sulfatoData.producto, sulfatoData.cantidad, sulfatoData.unidad);
              });
        });

        Promise.all(promises).then(() => {
            productTableBody.innerHTML = '';
            productsToAdd = [];
            fetchSulfatos(); // Actualizar la lista de sulfatos
            sulfatoForm.reset();
        }).catch(error => {
            console.error('Error registrando los sulfatos:', error);
            alert('Ocurrió un error al registrar los sulfatos.');
        });
    });

    // Abrir el modal de confirmación al hacer clic en "Eliminar Producto"
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-product-btn')) {
            productToDelete = e.target.getAttribute('data-id'); // Guardar el ID del producto

            // Mostrar el modal de confirmación
            document.getElementById('delete-confirmation-modal-product').style.display = 'block';
        }
    });

    // Función para ocultar el modal de confirmación
    function hideConfirmationModal() {
        document.getElementById('delete-confirmation-modal-product').style.display = 'none';
        productToDelete = null; // Limpiar la variable si se cancela
    }

    // Evento para confirmar la eliminación
    document.getElementById('confirm-delete-product').addEventListener('click', function() {
        if (productToDelete) {
            // Hacer la petición para eliminar el producto
            fetch(`/api/sulfatos/${productToDelete}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                fetchStock2();
                fetchSulfatos(); // Actualizar la lista de sulfatos después de eliminar
                hideConfirmationModal(); // Ocultar el modal
            })
            .catch(error => {
                console.error('Error al eliminar el producto del sulfato:', error);
                alert('Ocurrió un error al eliminar el producto.');
                hideConfirmationModal(); // Ocultar el modal
            });
        }
    });

    // Evento para cancelar la eliminación y cerrar el modal
    document.getElementById('cancel-delete-product').addEventListener('click', hideConfirmationModal);

    // Cerrar el modal al hacer clic en la 'X'
    document.querySelector('.modal .close').addEventListener('click', hideConfirmationModal);

    // Inicializar la lista de stock y sulfatos
    fetchStock2().then(fetchSulfatos);
});