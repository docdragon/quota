document.addEventListener('DOMContentLoaded', function() {
    // Đặt ngày hiện tại cho báo giá
    const today = new Date();
    document.getElementById('quote-date').textContent = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    
    // Hàm định dạng số
    function formatCurrency(num) {
        return num.toLocaleString('vi-VN');
    }

    // Hàm cập nhật STT
    function updateRowNumbers() {
        let itemCounter = 0;
        const rows = tableBody.querySelectorAll('tr.item-row');
        rows.forEach(row => {
            itemCounter++;
            row.querySelector('td:first-child').textContent = itemCounter;
        });
    }
    
    // Hàm tạo dòng sản phẩm mới
    function createNewItemRow() {
        const row = document.createElement('tr');
        row.className = 'item-row';
        row.innerHTML = `
            <td></td>
            <td><input type="text" placeholder="Dịch vụ/Sản phẩm..."></td>
            <td><input type="text" placeholder="Cái/Lần..." value="cái"></td>
            <td><input type="number" class="quantity" value="1" min="0"></td>
            <td><input type="number" class="price" value="0" min="0"></td>
            <td class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn">Xóa</button></td>
        `;
        // Tìm danh mục cuối cùng để thêm dòng vào
        const lastCategory = tableBody.querySelector('tr.category-header:last-of-type');
        if (lastCategory) {
            // Chèn vào sau danh mục và các item-row hiện có trong danh mục đó
             let insertBeforeNode = lastCategory.nextSibling;
             while(insertBeforeNode && insertBeforeNode.classList.contains('item-row')) {
                 insertBeforeNode = insertBeforeNode.nextSibling;
             }
             tableBody.insertBefore(row, insertBeforeNode);
        } else {
            tableBody.appendChild(row);
        }
        updateRowNumbers();
    }
    
    // Hàm tạo dòng danh mục mới
    function createNewCategoryRow() {
        const row = document.createElement('tr');
        row.className = 'category-header';
        row.innerHTML = `
            <td colspan="5"><input type="text" placeholder="Nhập tên danh mục..."></td>
            <td class="category-total text-right">0</td>
            <td class="actions"><button class="delete-btn">Xóa</button></td>
        `;
        tableBody.appendChild(row);
    }

    // Hàm cập nhật tổng tiền
    function updateTotals() {
        let grandSubtotal = 0;
        let currentCategorySubtotal = 0;
        let currentCategoryTotalElement = null;

        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            if (row.classList.contains('category-header')) {
                // Nếu có danh mục trước đó, cập nhật tổng của nó
                if (currentCategoryTotalElement) {
                    currentCategoryTotalElement.textContent = formatCurrency(currentCategorySubtotal);
                }
                // Reset cho danh mục mới
                currentCategorySubtotal = 0;
                currentCategoryTotalElement = row.querySelector('.category-total');
            } else if (row.classList.contains('item-row')) {
                const quantityInput = row.querySelector('.quantity');
                const priceInput = row.querySelector('.price');
                
                const quantity = parseFloat(quantityInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const lineTotal = quantity * price;

                row.querySelector('.line-total').textContent = formatCurrency(lineTotal);
                
                grandSubtotal += lineTotal;
                currentCategorySubtotal += lineTotal;
            }
        });

        // Cập nhật tổng cho danh mục cuối cùng
        if (currentCategoryTotalElement) {
            currentCategoryTotalElement.textContent = formatCurrency(currentCategorySubtotal);
        }

        const taxRate = 0.10; // Giả sử thuế VAT là 10%
        const tax = grandSubtotal * taxRate;
        const grandTotal = grandSubtotal + tax;

        document.getElementById('subtotal').textContent = formatCurrency(grandSubtotal);
        document.getElementById('tax').textContent = formatCurrency(tax);
        document.getElementById('grand-total').querySelector('strong').textContent = formatCurrency(grandTotal);
    }

    // Xử lý sự kiện chung cho cả bảng
    tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-btn')) {
            const rowToDelete = e.target.closest('tr');
            
            if (rowToDelete.classList.contains('category-header')) {
                // Xóa cả danh mục và các dòng con của nó
                let nextRow = rowToDelete.nextElementSibling;
                while(nextRow && nextRow.classList.contains('item-row')) {
                    const rowToRemove = nextRow;
                    nextRow = nextRow.nextElementSibling;
                    rowToRemove.remove();
                }
            }
            
            rowToDelete.remove();
            updateRowNumbers();
            updateTotals();
        }
    });

    // Sự kiện khi thay đổi số lượng hoặc đơn giá
    tableBody.addEventListener('input', function(e) {
        if (e.target.classList.contains('quantity') || e.target.classList.contains('price')) {
            updateTotals();
        }
    });

    // Sự kiện khi nhấn nút "Thêm dòng"
    addRowBtn.addEventListener('click', () => {
        createNewItemRow();
        updateTotals();
    });

    // Sự kiện khi nhấn nút "Thêm danh mục"
    addCategoryBtn.addEventListener('click', () => {
        createNewCategoryRow();
        updateTotals();
    });

    // --- Khởi tạo ban đầu ---
    // Thêm 1 danh mục và 2 dòng mặc định
    createNewCategoryRow();
    createNewItemRow();
    createNewItemRow();
    // Cập nhật tên danh mục mặc định
    tableBody.querySelector('.category-header input').value = "Hạng mục chính";
    updateTotals();
});
