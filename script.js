
document.addEventListener('DOMContentLoaded', function() {
    // Đặt ngày hiện tại cho báo giá
    const today = new Date();
    document.getElementById('quote-date').textContent = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const vatRateInput = document.getElementById('vat-rate');
    
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
            <td>
                <div class="content-cell">
                    <input type="text" class="item-name" placeholder="Tên hạng mục, sản phẩm...">
                    <div class="dimensions-wrapper">
                        <label>K.thước (m):</label>
                        <input type="number" class="dimension dim-d" value="0" min="0" step="0.01" title="Dài (m)">
                        <span>x</span>
                        <input type="number" class="dimension dim-s" value="0" min="0" step="0.01" title="Sâu (m)">
                        <span>x</span>
                        <input type="number" class="dimension dim-c" value="0" min="0" step="0.01" title="Cao (m)">
                    </div>
                    <input type="text" class="item-spec" placeholder="Quy cách, mô tả chi tiết...">
                </div>
            </td>
            <td><input type="text" value="cái"></td>
            <td class="volume text-right">0.00</td>
            <td><input type="number" class="quantity" value="1" min="1"></td>
            <td><input type="number" class="price" value="0" min="0"></td>
            <td class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa dòng">&times;</button></td>
        `;
        // Tìm danh mục cuối cùng để thêm dòng vào
        const lastCategory = tableBody.querySelector('tr.category-header:last-of-type');
        if (lastCategory) {
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
            <td colspan="6"><input type="text" placeholder="Nhập tên danh mục..."></td>
            <td class="category-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa danh mục">&times;</button></td>
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
                // Tính toán khối lượng
                const length = parseFloat(row.querySelector('.dim-d').value) || 0;
                const height = parseFloat(row.querySelector('.dim-c').value) || 0;
                const volume = length * height;
                const volumeCell = row.querySelector('.volume');
                volumeCell.textContent = volume.toFixed(2);
                
                // Tính toán thành tiền
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

        const taxRate = (parseFloat(vatRateInput.value) || 0) / 100;
        const tax = grandSubtotal * taxRate;
        const grandTotal = grandSubtotal + tax;

        document.getElementById('subtotal').textContent = formatCurrency(grandSubtotal);
        document.getElementById('tax').textContent = formatCurrency(tax);
        document.getElementById('grand-total').querySelector('strong').textContent = formatCurrency(grandTotal);
    }

    // Xử lý sự kiện chung cho cả bảng
    tableBody.addEventListener('click', function(e) {
        // Use .closest() to handle clicks on the button's content (the '×' symbol)
        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton) {
            const rowToDelete = deleteButton.closest('tr');
            
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

    // Sự kiện khi thay đổi giá trị trong các ô input
    tableBody.addEventListener('input', function(e) {
        const target = e.target;
        if (target.tagName === 'INPUT') {
             updateTotals();
        }
    });
    
    // Sự kiện khi thay đổi thuế VAT
    vatRateInput.addEventListener('input', updateTotals);


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
    // Thêm 1 danh mục và 1 dòng mặc định
    createNewCategoryRow();
    createNewItemRow();
    // Cập nhật tên danh mục mặc định
    tableBody.querySelector('.category-header input').value = "Hạng mục chính";
    updateTotals();
});