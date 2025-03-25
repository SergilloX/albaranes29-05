document.addEventListener('DOMContentLoaded', function() {
    const gastoForm = document.getElementById('gasto-form');
    const gastosList = document.getElementById('gastos-list');
    const totalGastoImporteElement = document.getElementById('total-gasto-importe');
    const conceptoSearch = document.getElementById('concepto-search');
    const conceptoList = document.getElementById('concepto-list');
    const filtroProveedorSearch = document.getElementById('filtro-proveedor-search');
    const filtroProveedorList = document.getElementById('filtro-proveedor-list');
    const nuevoProveedorLabel = document.getElementById('nuevo-proveedor-label');
    const nuevoProveedorInput = document.getElementById('nuevo-proveedor');
    const addNewProviderBtn = document.getElementById('add-new-provider');
    const clearFilterBtn = document.getElementById('clear-filter');
    const campaignSelect = document.getElementById('campaign-select');  // Seleccionador de campaña

    let currentCampaign = '2024-2025'; // Campaña inicial

    // Función para formatear el importe en euros
    function formatCurrency(amount) {
        const number = parseFloat(amount);
        if (isNaN(number)) return '0,00 €';
        const rounded = number.toFixed(2);
        const [integerPart, decimalPart] = rounded.split('.');
        const integerPartWithDots = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${integerPartWithDots},${decimalPart} €`;
    }

    // Función para formatear la fecha
    function formatDate(date) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
    }

    // =======================================================================
    //                      MANEJO DE CAMPAÑAS
    // =======================================================================

    /**
     * Función para calcular la nueva campaña basada en la actual.
     */
    function calculateNextCampaign(currentCampaign) {
        const [startYear, endYear] = currentCampaign.split('-').map(Number);
        return `${startYear + 1}-${endYear + 1}`;
    }

    /**
     * Función para cargar la campaña seleccionada o crear una nueva.
     */
    function loadCampaign(campaign) {
        console.log(`Loading campaign: ${campaign}`); // Depuración
        fetch('/api/campaign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ campaign })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            currentCampaign = data.campaign;
            fetchGastos();  // Supone que esta función existe para recargar la lista de gastos
            cargarProveedores();  // Supone que esta función existe para recargar los proveedores

            // Eliminar la opción "Añadir Nueva Campaña" temporalmente
            const addNewCampaignOption = campaignSelect.querySelector('option[value="add-new"]');
            if (addNewCampaignOption) {
                addNewCampaignOption.remove();
            }

            // Añadir la nueva campaña al seleccionador si no está ya presente
            const existingOption = campaignSelect.querySelector(`option[value="${currentCampaign}"]`);
            if (!existingOption) {
                const option = document.createElement('option');
                option.value = currentCampaign;
                option.textContent = currentCampaign;
                campaignSelect.appendChild(option);
            }

            // Seleccionar automáticamente la nueva campaña añadida
            campaignSelect.value = currentCampaign;

            // Volver a añadir la opción "Añadir Nueva Campaña" al final
            if (addNewCampaignOption) {
                campaignSelect.appendChild(addNewCampaignOption);
            }
        })
        .catch(error => console.error('Error al cargar la campaña:', error));
    }

    /**
     * Función para cargar todas las campañas desde el servidor y llenar el `select`.
     */
    function loadCampaigns() {
        fetch('/api/campaigns')
            .then(response => response.json())
            .then(data => {
                // Limpiar el select de campañas
                campaignSelect.innerHTML = '';

                // Agregar las campañas al select
                data.campaigns.forEach(campaign => {
                    const option = document.createElement('option');
                    option.value = campaign;
                    option.textContent = campaign;
                    campaignSelect.appendChild(option);
                });

                // Añadir la opción para crear una nueva campaña
                const addNewOption = document.createElement('option');
                addNewOption.value = 'add-new';
                addNewOption.textContent = 'Añadir Nueva Campaña';
                campaignSelect.appendChild(addNewOption);

                // Seleccionar la campaña actual
                campaignSelect.value = currentCampaign;

                // Cargar los datos de la campaña actual
                loadCampaign(currentCampaign);
            });
    }

    // Manejar el cambio en el seleccionador de campañas
    campaignSelect.addEventListener('change', function() {
        const selectedCampaign = campaignSelect.value;

        if (selectedCampaign === 'add-new') {
            const nextCampaign = calculateNextCampaign(currentCampaign);
            loadCampaign(nextCampaign);
        } else {
            loadCampaign(selectedCampaign);
        }
    });

    // =======================================================================
    //                      FUNCIONES PARA GASTOS
    // =======================================================================

    // Función para actualizar el total de gastos
    function updateTotalGastos() {
        let totalGastoImporte = 0;
        const rows = gastosList.querySelectorAll('tr:not(.header-row)');
        rows.forEach(row => {
            const importeText = row.querySelector('.importe').textContent;
            const importe = parseFloat(importeText.replace(/\./g, '').replace(',', '.').replace(' €', ''));
            totalGastoImporte += importe;
        });
        totalGastoImporteElement.textContent = formatCurrency(totalGastoImporte);
    }

    // Función para obtener y mostrar los gastos
    function fetchGastos(filtro = '') {
        fetch('/api/gastos')
            .then(response => response.json())
            .then(data => {
                gastosList.innerHTML = '';

                const filteredData = filtro ? data.data.filter(gasto => gasto.concepto.toLowerCase().includes(filtro)) : data.data;

                filteredData.forEach(gasto => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${gasto.concepto}</td>
                        <td>${formatDate(gasto.fecha)}</td>
                        <td class="importe">${formatCurrency(gasto.importe)}</td>
                        <td><button class="delete-gasto-btn" data-id="${gasto.id}">Eliminar</button></td>
                    `;
                    gastosList.appendChild(row);
                });

                updateTotalGastos();
            });
    }

    // Función para cargar los proveedores en los selectores
    function cargarProveedores() {
        fetch('/api/proveedores')
            .then(response => response.json())
            .then(proveedores => {
                // Limpiar las opciones actuales
                conceptoList.innerHTML = '';
                filtroProveedorList.innerHTML = '';

                // Añadir proveedores y ordenar
                proveedores.sort().forEach(proveedor => {
                    const li = document.createElement('li');
                    li.textContent = proveedor;
                    li.style.display = 'none';  // Ocultar todos los elementos al inicio
                    li.addEventListener('click', function() {
                        conceptoSearch.value = proveedor;
                        conceptoList.style.display = 'none';
                    });
                    conceptoList.appendChild(li);

                    const liFiltro = li.cloneNode(true);
                    liFiltro.addEventListener('click', function() {
                        filtroProveedorSearch.value = proveedor;
                        filtroProveedorList.style.display = 'none';
                    });
                    filtroProveedorList.appendChild(liFiltro);
                });
            });
    }

    // Filtrar los proveedores en la lista desplegable
    conceptoSearch.addEventListener('input', function() {
        const searchTerm = conceptoSearch.value.toLowerCase();
        const items = conceptoList.querySelectorAll('li');
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
            conceptoList.style.display = 'block';
        } else {
            conceptoList.style.display = 'none';
        }
    });

    // Similar para filtroProveedorSearch
    filtroProveedorSearch.addEventListener('input', function() {
        const searchTerm = filtroProveedorSearch.value.toLowerCase();
        fetchGastos(searchTerm);
    });

    // Manejar clic en el botón "Añadir nuevo proveedor"
    addNewProviderBtn.addEventListener('click', function() {
    nuevoProveedorLabel.style.display = 'block';
    nuevoProveedorInput.style.display = 'block';
    nuevoProveedorInput.required = true;
    conceptoSearch.disabled = true;
    nuevoProveedorInput.focus();
    
    // Deshabilitar el botón temporalmente
    addNewProviderBtn.disabled = true;
});

    
    // Añadir un nuevo gasto
    gastoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let concepto = conceptoSearch.value;
      // Si el campo de nuevo proveedor está oculto, eliminamos el atributo required
    if (nuevoProveedorInput.style.display === 'none') {
        nuevoProveedorInput.required = false;
    }
    if (concepto === '' && nuevoProveedorInput.style.display !== 'none') {
        concepto = nuevoProveedorInput.value;
        
        // Añadir nuevo proveedor a la lista
        nuevoProveedorInput.required = false;
        const li = document.createElement('li');
        li.textContent = concepto;
        li.addEventListener('click', function() {
            conceptoSearch.value = concepto;
            conceptoList.style.display = 'none';
        });
        conceptoList.appendChild(li);
        
        // Asegurarse de cargar los proveedores actualizados
        cargarProveedores();
    }

    const gastoData = {
        concepto,
        fecha: gastoForm.fecha.value,
        importe: gastoForm.importe.value.replace(',', '.')
    };

    fetch('/api/gastos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gastoData)
    })
    .then(response => response.json())
    .then(data => {
        fetchGastos(); // Actualizar la lista de gastos

        // Restablecer el formulario completamente
        gastoForm.reset();
        nuevoProveedorLabel.style.display = 'none';
        nuevoProveedorInput.style.display = 'none';
        nuevoProveedorInput.value = '';
        nuevoProveedorInput.required = false;
        conceptoSearch.disabled = false;
        conceptoSearch.value = '';
        
        // Habilitar el botón de añadir nuevo proveedor
        addNewProviderBtn.disabled = false;
        
        // Volver a habilitar los botones para añadir gasto
        document.querySelectorAll('button[type="submit"]').forEach(button => {
            button.disabled = false; // Asegurar que el botón de añadir gasto esté habilitado
        });

        cargarProveedores(); // Actualizar la lista de proveedores
    });
});



    // Eliminar un gasto
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-gasto-btn')) {
            const gastoId = e.target.getAttribute('data-id');

            // Guardar el ID del gasto a eliminar en una variable global
            window.gastoToDelete = gastoId;

            // Mostrar el modal de confirmación
            document.getElementById('delete-confirmation-modal-gastos').style.display = 'block';
        }
    });

    document.getElementById('confirm-delete-gastos').addEventListener('click', function() {
        const gastoId = window.gastoToDelete;
        if (gastoId) {
            fetch(`/api/gastos/${gastoId}`, {
                method: 'DELETE'
            })
            .then(() => {
                fetchGastos();

                // Mostrar mensaje de deshacer
                document.getElementById('undo-message-gastos').style.display = 'block';

                // Ocultar el modal
                document.getElementById('delete-confirmation-modal-gastos').style.display = 'none';

                // Ocultar el mensaje de deshacer después de 5 segundos
                setTimeout(() => {
                    document.getElementById('undo-message-gastos').style.display = 'none';
                }, 5000);
            });
        }
    });

    document.getElementById('cancel-delete-gastos').addEventListener('click', function() {
        // Ocultar el modal de confirmación sin hacer nada
        document.getElementById('delete-confirmation-modal-gastos').style.display = 'none';
    });

    // Cerrar el modal al hacer clic en la 'X'
    document.querySelector('.modal .close').addEventListener('click', function() {
        document.getElementById('delete-confirmation-modal-gastos').style.display = 'none';
    });

    document.getElementById('undo-delete-gastos').addEventListener('click', function(e) {
        e.preventDefault();

        fetch('/api/gastos/undo', {
            method: 'POST'
        })
        .then(() => {
            fetchGastos();
            document.getElementById('undo-message-gastos').style.display = 'none';
        });
    });

    // Manejar clic en el botón "Borrar filtro"
    clearFilterBtn.addEventListener('click', function() {
        filtroProveedorSearch.value = '';
        fetchGastos(); // Mostrar todos los proveedores
    });

    // Ocultar el dropdown si se hace clic fuera de él
    document.addEventListener('click', function(e) {
        if (!conceptoSearch.contains(e.target) && !conceptoList.contains(e.target)) {
            conceptoList.style.display = 'none';
        }
    });

    // Inicializar la lista de gastos, cargar proveedores y campañas
    loadCampaigns();
});
