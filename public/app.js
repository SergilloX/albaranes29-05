document.addEventListener('DOMContentLoaded', function() {
    const albaranForm = document.getElementById('albaran-form');
    const albaranesList = document.getElementById('albaranes-list');
    const totalKilosElement = document.getElementById('total-kilos');
    const totalImporteElement = document.getElementById('total-importe');
    const cobroForm = document.getElementById('cobro-form');
    const cobrosList = document.getElementById('cobros-list');
    const pendienteCobroElement = document.getElementById('pendiente-cobro');
    const totalCobradoElement = document.getElementById('total-cobrado');
    const filtroInvernaderoSelect = document.getElementById('filtro-invernadero');
    const campaignSelect = document.getElementById('campaign-select');  // Seleccionador de campaña

    let lastDeletedAlbaran = null;
    let undoTimeout;
    let albaranToDelete = null;
    let currentCampaign = '2024-2025'; // Campaña inicial

    const deleteModal = document.getElementById('delete-confirmation-modal-albaranes');
    const undoMessage = document.getElementById('undo-message-albaranes');
    const confirmDeleteButton = document.getElementById('confirm-delete-albaranes');
    const cancelDeleteButton = document.getElementById('cancel-delete-albaranes');

    // Valor inicial base del pendiente de cobro
    const basePendienteCobro = 918741.44;
    let initialPendienteCobro = basePendienteCobro;

    // =======================================================================
    //                      FUNCIONES AUXILIARES
    // =======================================================================

    // Función para formatear el importe en euros con puntos y comas
    function formatCurrency(amount) {
        const number = parseFloat(amount);
        if (isNaN(number)) return '0,00 €';
        const rounded = number.toFixed(2);
        const [integerPart, decimalPart] = rounded.split('.');

        const integerPartWithDots = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${integerPartWithDots},${decimalPart} €`;
    }
  
  
    function calculateImporte(precio, kilos) {
    // Verifica que precio y kilos sean numéricos
    if (isNaN(precio) || isNaN(kilos)) {
        console.error("Precio o kilos no son valores numéricos válidos");
        return 0;
    }
    const baseImponible = precio - (0.12 * precio) - (0.018 * kilos);
    const importeCon12 = baseImponible + (0.12 * baseImponible);
    const importeFinal = importeCon12 - (0.02 * importeCon12);
    return parseFloat(importeFinal.toFixed(2));
}


    // Función para formatear la fecha en dd/mm/aaaa
    function formatDate(date) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
    }

    // Función para actualizar el pendiente de cobro y el total cobrado
    function updatePendienteCobro() {
        fetch('/api/cobros')
            .then(response => response.json())
            .then(cobrosData => {
                let totalCobros = 0;
                cobrosData.data.forEach(cobro => {
                    totalCobros += parseFloat(cobro.importe);
                });

                const pendienteCobro = initialPendienteCobro - totalCobros;
                pendienteCobroElement.textContent = formatCurrency(pendienteCobro);
                totalCobradoElement.textContent = formatCurrency(totalCobros);
            });
    }

    // Función para inicializar el valor de initialPendienteCobro basado en el valor base menos los cobros existentes
    function initializePendienteCobro() {
    // Primero, obtener todos los albaranes y calcular el total ajustado
    fetch('/api/albaranes')
        .then(response => response.json())
        .then(albaranesData => {
            let totalAlbaranesAjustado = 0;
            albaranesData.data.forEach(albaran => {
                totalAlbaranesAjustado += parseFloat(albaran.importe);
            });

            // Luego, obtener todos los cobros y calcular el total
            fetch('/api/cobros')
                .then(response => response.json())
                .then(cobrosData => {
                    let totalCobros = 0;
                    cobrosData.data.forEach(cobro => {
                        totalCobros += parseFloat(cobro.importe);
                    });

                    // Calcular el pendiente de cobro inicial
                    initialPendienteCobro = basePendienteCobro - totalCobros + totalAlbaranesAjustado;
                    updatePendienteCobro();  // Actualizar el valor mostrado inicialmente
                });
        });
}


    // =======================================================================
    //                      MANEJO DE CAMPAÑAS
    // =======================================================================

    function loadCampaign(campaign) {
        fetch('/api/campaign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ campaign })
        })
        .then(response => response.json())
        .then(data => {
            currentCampaign = campaign;
            fetchAlbaranes();
            initializePendienteCobro();  // Inicializa el pendiente de cobro al cambiar de campaña
        });
    }

    function loadCampaigns() {
        fetch('/api/campaigns')
            .then(response => response.json())
            .then(data => {
                campaignSelect.innerHTML = '';

                data.campaigns.forEach(campaign => {
                    const option = document.createElement('option');
                    option.value = campaign;
                    option.textContent = campaign;
                    campaignSelect.appendChild(option);
                });

                const addNewOption = document.createElement('option');
                addNewOption.value = 'add-new';
                addNewOption.textContent = 'Añadir Nueva Campaña';
                campaignSelect.appendChild(addNewOption);

                const currentCampaignOption = data.campaigns.includes(currentCampaign) ? currentCampaign : data.campaigns[0];
                campaignSelect.value = currentCampaignOption;

                loadCampaign(currentCampaignOption);
            });
    }

    campaignSelect.addEventListener('change', function() {
        const selectedCampaign = campaignSelect.value;

        if (selectedCampaign === 'add-new') {
            const newCampaign = prompt('Introduce el nombre de la nueva campaña (ej. 2025-2026):');
            if (newCampaign) {
                loadCampaign(newCampaign);
                const option = document.createElement('option');
                option.value = newCampaign;
                option.textContent = newCampaign;
                campaignSelect.appendChild(option);
                campaignSelect.value = newCampaign;
            }
        } else {
            loadCampaign(selectedCampaign);
        }
    });

    loadCampaigns();

    // =======================================================================
    //                      FUNCIONES PARA COBROS
    // =======================================================================

    cobroForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(cobroForm);
        const cobroData = {};
        formData.forEach((value, key) => {
            cobroData[key] = value;
        });

        fetch('/api/cobros', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cobroData)
        })
        .then(response => response.json())
        .then(data => {
            fetchCobros();
            cobroForm.reset();
        });
    });

    function fetchCobros() {
        fetch('/api/cobros')
            .then(response => response.json())
            .then(data => {
                cobrosList.innerHTML = '';

                data.data.forEach(cobro => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${formatDate(cobro.fecha)}</td>
                        <td>${formatCurrency(cobro.importe)}</td>
                        <td><button class="delete-cobro-btn" data-id="${cobro.id}">Eliminar</button></td>
                    `;
                    cobrosList.appendChild(row);
                });

                updatePendienteCobro();  // Actualizar pendiente de cobro con cobros cargados
            });
    }

    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-cobro-btn')) {
            const cobroId = e.target.getAttribute('data-id');
            window.cobroToDelete = cobroId;
            document.getElementById('delete-confirmation-modal-cobros').style.display = 'block';
        }
    });

    document.getElementById('confirm-delete-cobros').addEventListener('click', function() {
        const cobroId = window.cobroToDelete;
        if (cobroId) {
            fetch(`/api/cobros/${cobroId}`, {
                method: 'DELETE'
            })
            .then(() => {
                fetchCobros();
                document.getElementById('undo-message-cobros').style.display = 'block';
                document.getElementById('delete-confirmation-modal-cobros').style.display = 'none';
                setTimeout(() => {
                    document.getElementById('undo-message-cobros').style.display = 'none';
                }, 5000);
            });
        }
    });

    document.getElementById('cancel-delete-cobros').addEventListener('click', function() {
        document.getElementById('delete-confirmation-modal-cobros').style.display = 'none';
    });

    document.querySelector('.modal .close').addEventListener('click', function() {
        document.getElementById('delete-confirmation-modal-cobros').style.display = 'none';
    });

    document.getElementById('undo-delete-cobros').addEventListener('click', function(e) {
        e.preventDefault();

        fetch('/api/cobros/undo', {
            method: 'POST'
        })
        .then(() => {
            fetchCobros();
            document.getElementById('undo-message-cobros').style.display = 'none';
        });
    });

    // =======================================================================
    //                      FUNCIONES PARA ALBARANES
    // =======================================================================

    function fetchAlbaranes() {
        fetch('/api/albaranes')
            .then(response => response.json())
            .then(data => {
                albaranesList.innerHTML = '';
                let totalKilos = 0;
                let totalImporte = 0;

                data.data.forEach(albaran => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${albaran.albaran}</td>
                        <td>${formatDate(albaran.fecha)}</td>
                        <td>${formatCurrency(albaran.kilos).replace(' €','')} kg</td> 
                        <td>${formatCurrency(albaran.importe)}</td>
                        <td>${albaran.invernadero || ''}</td>
                        <td><button class="delete-btn" data-id="${albaran.id}">Eliminar</button></td>
                    `;
                    albaranesList.appendChild(row);

                    totalKilos += parseFloat(albaran.kilos);
                    totalImporte += parseFloat(albaran.importe);
                });

                totalKilosElement.textContent = `${formatCurrency(totalKilos).replace(' €','')} kg`;
                totalImporteElement.textContent = `${formatCurrency(totalImporte)}`;
                applyFilter();
            });
    }

     // Evento de envío del formulario de albarán
albaranForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(albaranForm);
    const albaranData = {};
    formData.forEach((value, key) => {
        albaranData[key] = value ? value.replace(',', '.') : null; // Reemplazar coma por punto si existe
    });

    // Convierte "importe" y "kilos" a números
    const importe = parseFloat(albaranData.importe); // Cambia "precio" por "importe" si usas este campo
    const kilos = parseFloat(albaranData.kilos);

    // Valida que ambos valores sean números válidos
    if (isNaN(importe) || isNaN(kilos)) {
        alert('Por favor, ingrese valores numéricos válidos para importe y kilos.');
        return;
    }

    // Calcula el importe final usando la función creada
    console.log("Importe:", importe);
    console.log("Kilos:", kilos);

    const importeCalculado = calculateImporte(importe, kilos); // Asegúrate de que calculateImporte esté usando los valores correctos
    albaranData.importe = importeCalculado;

    // Realiza el envío de datos al servidor
    fetch('/api/albaranes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(albaranData)
    })
    .then(response => response.json())
    .then(data => {
        initialPendienteCobro += importeCalculado;
        updatePendienteCobro();
        fetchAlbaranes();
        fetchCobros();
        albaranForm.reset();
    });
});




    function showDeleteConfirmationModal(id) {
        albaranToDelete = id;
        deleteModal.style.display = 'block';
    }

    function hideDeleteConfirmationModal() {
        deleteModal.style.display = 'none';
    }

    function deleteAlbaran() {
    fetch(`/api/albaranes/${albaranToDelete}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        const totalAjustado = parseFloat(data.data.importe);
        initialPendienteCobro -= totalAjustado;  // Restar el importe del albarán eliminado a pendiente de cobro
        updatePendienteCobro();  // Actualizar pendienteCobro en la interfaz

        fetchAlbaranes();
        fetchCobros();
        showUndoOption();
        hideDeleteConfirmationModal();
    });
}


    function showUndoOption() {
        undoMessage.style.display = 'block';
        undoTimeout = setTimeout(() => {
            undoMessage.style.display = 'none';
        }, 10000); // 10 segundos para deshacer
    }

    document.getElementById('undo-delete-albaranes').addEventListener('click', function() {
        restoreAlbaran(lastDeletedAlbaran);
        clearTimeout(undoTimeout);
        undoMessage.style.display = 'none';
    });

    function restoreAlbaran(albaran) {
        fetch('/api/albaranes/undo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(albaran)
        })
        .then(response => response.json())
        .then(data => {
            fetchAlbaranes();
            initializePendienteCobro();  // Recalcular después de restaurar un albarán
        });
    }

    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const albaranId = e.target.getAttribute('data-id');
            showDeleteConfirmationModal(albaranId);
        }
    });

    confirmDeleteButton.addEventListener('click', function() {
        deleteAlbaran();
    });

    cancelDeleteButton.addEventListener('click', function() {
        hideDeleteConfirmationModal();
    });

    function applyFilter() {
        const selectedInvernadero = filtroInvernaderoSelect.value;
        const rows = albaranesList.querySelectorAll('tr');
        let totalKilosFiltered = 0;
        let totalImporteFiltered = 0;

        rows.forEach(row => {
            const invernaderoCell = row.cells[4].textContent;
            const kilosCell = parseFloat(row.cells[2].textContent.replace('.','').replace(',','.'));
            const importeCell = parseFloat(row.cells[3].textContent.replace(' €','').replace('.','').replace(',','.'));

            const showRow = selectedInvernadero === "" || invernaderoCell === selectedInvernadero;
            row.style.display = showRow ? "" : "none";

            if (showRow) {
                totalKilosFiltered += kilosCell;
                totalImporteFiltered += importeCell;
            }
        });

        const totalAjustadoFiltered = (totalImporteFiltered).toFixed(2);
        totalKilosElement.textContent = `${formatCurrency(totalKilosFiltered).replace(' €','')} kg`; 
        totalImporteElement.textContent = `${formatCurrency(totalAjustadoFiltered)}`;
    }

    filtroInvernaderoSelect.addEventListener('change', applyFilter);

    function showPage(pageId) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.style.display = page.id === pageId ? 'block' : 'none';
        });

        const navLinks = document.querySelectorAll('nav a');
        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href').substring(1) === pageId);
        });
    }

    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click',function(e) {
            e.preventDefault();
            const pageId = link.getAttribute('href').substring(1);
            showPage(pageId);
        });
    });

    fetchAlbaranes();
    initializePendienteCobro();  // Inicializa pendienteCobro con el valor base menos los cobros actuales
    fetchCobros();

    showPage('albaranes');
});
