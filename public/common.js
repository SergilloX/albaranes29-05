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
