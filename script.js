document.addEventListener('DOMContentLoaded', function() {
    // Đặt ngày hiện tại cho báo giá
    const today = new Date();
    document.getElementById('quote-date').textContent = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    let rowCount = 0;

    function createNewRow() {
        rowCount++;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" placeholder="Dịch vụ/Sản phẩm..."></td>
            <td><input type="text" placeholder="Cái/Lần..."></td>
            <td><input type="number" class="quantity" value="1" min="0"></td>
            <td><input type="number" class="price" value="0" min="0"></td>
            <td class="line-total">0</td>
        `;
        tableBody.appendChild(row);
    }

    function updateTotals() {
        let subtotal = 0;
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const quantity = parseFloat(row.querySelector('.quantity').value) || 0;
            const price = parseFloat(row.querySelector('.price').value) || 0;
            const lineTotal = quantity * price;
            row.querySelector('.line-total').textContent = lineTotal.toLocaleString();
            subtotal += lineTotal;
        });

        const tax = subtotal * 0.10; // Giả sử thuế VAT là 10%
        const grandTotal = subtotal + tax;

        document.getElementById('subtotal').textContent = subtotal.toLocaleString();
        document.getElementById('tax').textContent = tax.toLocaleString();
        document.getElementById('grand-total').querySelector('strong').textContent = grandTotal.toLocaleString();
    }

    // Sự kiện khi nhấn nút "Thêm dòng"
    addRowBtn.addEventListener('click', createNewRow);

    // Sự kiện khi thay đổi số lượng hoặc đơn giá
    tableBody.addEventListener('input', function(e) {
        if (e.target.classList.contains('quantity') || e.target.classList.contains('price')) {
            updateTotals();
        }
    });

    // Thêm 2 dòng mặc định khi tải trang
    createNewRow();
    createNewRow();
});