
document.addEventListener('DOMContentLoaded', function() {
    // --- Global State ---
    let quotes = [];
    let activeQuoteId = null;
    let indicatorTimeout;
    let confirmCallback = null;

    // --- DOM Elements ---
    // Main Navigation & Views
    const navEditor = document.getElementById('nav-editor');
    const navList = document.getElementById('nav-list');
    const saveQuoteBtn = document.getElementById('save-quote-btn');
    const editorView = document.getElementById('editor-view');
    const listView = document.getElementById('list-view');
    const clearQuoteBtn = document.getElementById('clear-quote-btn');

    // Editor View
    const quoteNameInput = document.getElementById('quote-name-input');
    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const vatRateInput = document.getElementById('vat-rate');
    const saveIndicator = document.getElementById('save-indicator');

    // List View
    const savedQuotesContainer = document.getElementById('saved-quotes-container');
    const searchQuotesInput = document.getElementById('search-quotes-input');
    const createNewQuoteFromListBtn = document.getElementById('create-new-quote-from-list');

    // Modals
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // --- State Management (Save/Load) ---
    function loadState() {
        const savedQuotes = JSON.parse(localStorage.getItem('savedQuotes'));

        if (savedQuotes && savedQuotes.length > 0) {
            quotes = savedQuotes;
            // Sort by most recently modified to load the latest one
            quotes.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            activeQuoteId = quotes[0].id;
        } else {
            // If no quotes exist, create a fresh one and add it to the list
            addNewQuote(false); // Don't save immediately
        }
    }

    function saveState(showIndicator = true) {
        localStorage.setItem('savedQuotes', JSON.stringify(quotes));

        if (showIndicator) {
            saveIndicator.classList.add('show');
            clearTimeout(indicatorTimeout);
            indicatorTimeout = setTimeout(() => {
                saveIndicator.classList.remove('show');
            }, 2000);
        }
    }
    
    function handleSaveQuote() {
        if (!activeQuoteId) return;

        const quoteIndex = quotes.findIndex(q => q.id === activeQuoteId);
        if (quoteIndex === -1) {
             console.error("Active quote not found in quotes array. Cannot save.");
             return;
        }

        const domData = collectQuoteDataFromDOM();

        // Update the quote object in the main array
        quotes[quoteIndex] = {
            ...quotes[quoteIndex], // Keeps the original ID
            ...domData,
            lastModified: new Date().toISOString()
        };
        
        saveState(true);
        // If list view is visible, refresh it
        if (listView.style.display !== 'none') {
            renderSavedQuotes(quotes);
        }
    }

    function collectQuoteDataFromDOM() {
        const tableData = [];
        tableBody.querySelectorAll('tr').forEach(row => {
            if (row.classList.contains('category-header')) {
                tableData.push({
                    type: 'category',
                    name: row.querySelector('input').value
                });
            } else if (row.classList.contains('item-row')) {
                tableData.push({
                    type: 'item',
                    name: row.querySelector('.item-name').value,
                    spec: row.querySelector('.item-spec').value,
                    unit: row.querySelector('td[data-label="Đơn vị"] input').value,
                    dimD: row.querySelector('.dim-d').value,
                    dimS: row.querySelector('.dim-s').value,
                    dimC: row.querySelector('.dim-c').value,
                    quantity: row.querySelector('.quantity').value,
                    price: row.querySelector('.price').value.replace(/\./g, '')
                });
            }
        });

        return {
            name: quoteNameInput.value,
            company: {
                name: document.getElementById('company-name').value,
                address: document.getElementById('company-address').value,
                contact: document.getElementById('company-contact').value,
                bank: document.getElementById('company-bank').value
            },
            client: {
                name: document.getElementById('client-name').value,
                phone: document.getElementById('client-phone').value,
                address: document.getElementById('client-address').value
            },
            quoteNumber: document.getElementById('quote-number').value,
            vatRate: vatRateInput.value,
            notes: document.getElementById('notes-area').value,
            tableData: tableData
        };
    }

    // --- View Management ---
    function showEditorView() {
        editorView.style.display = 'block';
        listView.style.display = 'none';
        navEditor.classList.add('active');
        navList.classList.remove('active');
    }

    function showListView() {
        handleSaveQuote(); // Auto-save when switching to list view
        renderSavedQuotes(quotes);
        searchQuotesInput.value = '';
        editorView.style.display = 'none';
        listView.style.display = 'block';
        navEditor.classList.remove('active');
        navList.classList.add('active');
    }

    // --- Rendering ---
    function renderQuote(quoteId) {
        const quote = quotes.find(q => q.id === quoteId);
        if (!quote) return;

        quoteNameInput.value = quote.name;
        document.getElementById('company-name').value = quote.company.name;
        document.getElementById('company-address').value = quote.company.address;
        document.getElementById('company-contact').value = quote.company.contact;
        document.getElementById('company-bank').value = quote.company.bank;
        document.getElementById('client-name').value = quote.client.name;
        document.getElementById('client-phone').value = quote.client.phone;
        document.getElementById('client-address').value = quote.client.address;
        document.getElementById('quote-number').value = quote.quoteNumber;
        vatRateInput.value = quote.vatRate;
        document.getElementById('notes-area').value = quote.notes;

        tableBody.innerHTML = '';
        if (quote.tableData) {
            quote.tableData.forEach(item => {
                if (item.type === 'category') {
                    const row = createCategoryRowDOM();
                    row.querySelector('input').value = item.name;
                    tableBody.appendChild(row);
                } else if (item.type === 'item') {
                    const row = createItemRowDOM();
                    row.querySelector('.item-name').value = item.name;
                    const specTextarea = row.querySelector('.item-spec');
                    specTextarea.value = item.spec;
                    // Adjust height after content is set
                    setTimeout(() => {
                        specTextarea.style.height = 'auto';
                        specTextarea.style.height = (specTextarea.scrollHeight) + 'px';
                    }, 0);

                    row.querySelector('td[data-label="Đơn vị"] input').value = item.unit;
                    row.querySelector('.dim-d').value = item.dimD;
                    row.querySelector('.dim-s').value = item.dimS;
                    row.querySelector('.dim-c').value = item.dimC;
                    row.querySelector('.quantity').value = item.quantity;
                    const priceInput = row.querySelector('.price');
                    priceInput.value = item.price;
                    formatPriceInput(priceInput);
                    tableBody.appendChild(row);
                }
            });
        }

        updateRowNumbers();
        updateTotals();
    }

    // --- Core Logic Functions ---
    function updateDate() {
        const today = new Date();
        document.getElementById('quote-date').textContent = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    }

    function formatCurrency(num) {
        return num.toLocaleString('vi-VN');
    }

    function updateRowNumbers() {
        let itemCounter = 0;
        tableBody.querySelectorAll('tr.item-row').forEach(row => {
            itemCounter++;
            row.querySelector('td:first-child').textContent = itemCounter;
        });
    }

    function createItemRowDOM() {
        const row = document.createElement('tr');
        row.className = 'item-row';
        row.innerHTML = `
            <td data-label="STT"></td>
            <td data-label="Nội dung">
                <div class="content-cell">
                    <input type="text" class="item-name" placeholder="Tên hạng mục, sản phẩm...">
                    <div class="dimensions-wrapper">
                        <label>K.thước (m):</label>
                        <input type="number" class="dimension dim-d" value="0" min="0" step="0.01" title="Dài (m)" placeholder="Dài">
                        <span>x</span>
                        <input type="number" class="dimension dim-s" value="0" min="0" step="0.01" title="Sâu (m)" placeholder="Sâu">
                        <span>x</span>
                        <input type="number" class="dimension dim-c" value="0" min="0" step="0.01" title="Cao (m)" placeholder="Cao">
                    </div>
                    <textarea class="item-spec" placeholder="Quy cách, mô tả chi tiết..." rows="1"></textarea>
                </div>
            </td>
            <td data-label="Đơn vị"><input type="text" value="cái"></td>
            <td data-label="KL (m²)" class="volume text-right">0.00</td>
            <td data-label="SL"><input type="number" class="quantity" value="1" min="1"></td>
            <td data-label="Đơn giá"><input type="text" class="price" value="0" inputmode="numeric"></td>
            <td data-label="Thành tiền" class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa dòng" aria-label="Xóa dòng">&times;</button></td>
        `;
        const textarea = row.querySelector('.item-spec');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
        return row;
    }

    function createCategoryRowDOM() {
        const row = document.createElement('tr');
        row.className = 'category-header';
        row.innerHTML = `
            <td colspan="7"><input type="text" placeholder="Nhập tên nhóm hạng mục..."></td>
            <td class="actions"><button class="delete-btn" title="Xóa danh mục" aria-label="Xóa danh mục và các hạng mục con">&times;</button></td>
        `;
        row.querySelector('input').addEventListener('focus', (e) => e.target.placeholder = 'Nhập tên nhóm hạng mục...');
        return row;
    }

    function createNewQuoteObject() {
        const newId = Date.now();
        const date = new Date(newId);
        const name = `Báo giá mới - ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        return {
            id: newId,
            name: name,
            lastModified: new Date().toISOString(),
            company: { name: 'Tên Công Ty Của Bạn', address: 'Địa chỉ: 123 Đường ABC, Phường X, Quận Y, TP. Z', contact: 'Điện thoại: 0987 654 321 | Email: info@tencongty.com', bank: '' },
            client: { name: '', phone: '', address: ''},
            quoteNumber: `BG-${new Date().getFullYear()}-${newId.toString().slice(-4)}`,
            vatRate: 10,
            notes: 'Báo giá có hiệu lực trong vòng 30 ngày.\nThanh toán 50% khi ký hợp đồng, 50% còn lại khi bàn giao.',
            tableData: [
                { type: 'category', name: 'Hạng mục chính' },
                { type: 'item', name: '', spec: '', unit: 'cái', dimD: 0, dimS: 0, dimC: 0, quantity: 1, price: '0' }
            ]
        };
    }

    function updateTotals() {
        let grandSubtotal = 0;
        tableBody.querySelectorAll('tr.item-row').forEach(row => {
            const length = parseFloat(row.querySelector('.dim-d').value) || 0;
            const height = parseFloat(row.querySelector('.dim-c').value) || 0;
            const volume = length * height;
            row.querySelector('.volume').textContent = volume.toFixed(2);
            
            const quantity = parseFloat(row.querySelector('.quantity').value) || 0;
            const priceValue = row.querySelector('.price').value || '0';
            const price = parseFloat(priceValue.replace(/\./g, '')) || 0;

            const lineTotal = quantity * price;
            row.querySelector('.line-total').textContent = formatCurrency(lineTotal);
            
            grandSubtotal += lineTotal;
        });

        const taxRate = (parseFloat(vatRateInput.value) || 0) / 100;
        const tax = grandSubtotal * taxRate;
        const grandTotal = grandSubtotal + tax;

        document.getElementById('subtotal').textContent = formatCurrency(grandSubtotal);
        document.getElementById('tax').textContent = formatCurrency(tax);
        document.getElementById('grand-total').textContent = formatCurrency(grandTotal);
    }

    function formatPriceInput(input) {
         let numericString = input.value.replace(/\D/g, '');
        if (numericString) {
            const number = BigInt(numericString);
            input.value = new Intl.NumberFormat('vi-VN').format(number);
        } else {
            input.value = '';
        }
    }

    // --- Event Handlers ---
    function setupGlobalEventListeners() {
        // Main Navigation
        navEditor.addEventListener('click', showEditorView);
        navList.addEventListener('click', showListView);
        saveQuoteBtn.addEventListener('click', handleSaveQuote);
        clearQuoteBtn.addEventListener('click', handleClearQuote);

        // Editor View - Update totals on any input change
        editorView.addEventListener('input', (e) => {
            if (e.target.classList.contains('price')) {
                 formatPriceInput(e.target);
            }
            updateTotals();
        });

        addRowBtn.addEventListener('click', () => {
            const row = createItemRowDOM();
            tableBody.appendChild(row);
            updateRowNumbers();
            updateTotals();
        });

        addCategoryBtn.addEventListener('click', () => {
            const row = createCategoryRowDOM();
            tableBody.appendChild(row);
            updateTotals();
        });

        tableBody.addEventListener('click', function(e) {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const rowToDelete = deleteButton.closest('tr');
                if (rowToDelete.classList.contains('category-header')) {
                    let nextRow = rowToDelete.nextElementSibling;
                    while (nextRow && nextRow.classList.contains('item-row')) {
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

        // List View
        createNewQuoteFromListBtn.addEventListener('click', () => {
            addNewQuote();
            showEditorView();
        });
        searchQuotesInput.addEventListener('input', handleSearch);
        savedQuotesContainer.addEventListener('click', handleQuoteListClick);

        // Confirmation Modal Handlers
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmOkBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            hideConfirmModal();
        });
        confirmModal.addEventListener('click', (e) => {
             if (e.target === confirmModal) {
                hideConfirmModal();
            }
        });
    }

    // --- Quote Actions ---
    function switchQuote(quoteId) {
        if (quoteId === activeQuoteId) {
             showEditorView();
             return;
        };
        
        activeQuoteId = quoteId;
        renderQuote(activeQuoteId);
        showEditorView();
    }

    function addNewQuote(doSave = true) {
        const newQuote = createNewQuoteObject();
        quotes.unshift(newQuote); // Add to the beginning of the array
        activeQuoteId = newQuote.id;
        renderQuote(activeQuoteId);
        if (doSave) {
            saveState(false); // Save without showing indicator
        }
    }

    function deleteQuote(quoteId, fromListView = false) {
        const quoteToDelete = quotes.find(q => q.id === quoteId);
        if (!quoteToDelete) return;

        showConfirmModal(
            'Xác nhận xóa',
            `Bạn có chắc chắn muốn xóa vĩnh viễn báo giá "${quoteToDelete.name}" không?`,
            () => {
                quotes = quotes.filter(q => q.id !== quoteId);
                saveState(false);

                if (activeQuoteId === quoteId) {
                    if (quotes.length > 0) {
                        // Load the most recent quote
                        quotes.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
                        switchQuote(quotes[0].id);
                    } else {
                        // No quotes left, create a new one
                        addNewQuote();
                    }
                }
                
                if (fromListView) {
                    renderSavedQuotes(quotes);
                }
            }
        );
    }
    
    function handleClearQuote() {
        showConfirmModal(
            'Làm trống báo giá?',
            'Bạn có chắc muốn xoá toàn bộ nội dung báo giá này không? Thông tin công ty sẽ được giữ lại, nhưng tất cả hạng mục, ghi chú và thông tin khách hàng sẽ được xoá.',
            () => {
                const activeQuoteIndex = quotes.findIndex(q => q.id === activeQuoteId);
                if (activeQuoteIndex === -1) return;
    
                const currentQuote = quotes[activeQuoteIndex];
                const blankQuoteTemplate = createNewQuoteObject();
    
                // Overwrite the current quote with blank data, but keep essential fields
                quotes[activeQuoteIndex] = {
                    ...blankQuoteTemplate,
                    id: currentQuote.id,
                    name: currentQuote.name,
                    company: currentQuote.company,
                    lastModified: new Date().toISOString(),
                    // Regenerate quote number to be consistent, using original creation year from ID
                    quoteNumber: `BG-${new Date(currentQuote.id).getFullYear()}-${currentQuote.id.toString().slice(-4)}`,
                };
                
                renderQuote(activeQuoteId);
                handleSaveQuote(); // Use existing save function to persist changes and show indicator
            }
        );
    }

    // --- Quote List View ---
    function showConfirmModal(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmCallback = onConfirm;

        // Reset button classes
        confirmOkBtn.className = 'btn-danger';
        confirmOkBtn.textContent = 'Xóa';

        if(title === 'Làm trống báo giá?') {
            confirmOkBtn.textContent = 'Làm Trống';
        }

        confirmModal.style.display = 'flex';
    }

    function hideConfirmModal() {
        confirmModal.style.display = 'none';
        confirmCallback = null;
    }

    function renderSavedQuotes(quotesToRender) {
        savedQuotesContainer.innerHTML = '';
        if (!quotesToRender || quotesToRender.length === 0) {
            savedQuotesContainer.innerHTML = '<p class="empty-list-message">Không có báo giá nào được tạo. Hãy tạo một báo giá mới!</p>';
            return;
        }

        const sortedQuotes = [...quotesToRender].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        sortedQuotes.forEach(quote => {
            const card = document.createElement('div');
            card.className = 'quote-card';
            card.dataset.id = quote.id;
            
            const lastModifiedDate = new Date(quote.lastModified).toLocaleDateString('vi-VN');
            const clientName = quote.client?.name ? `<strong>Khách hàng:</strong> ${quote.client.name}` : '<em>Chưa có khách hàng</em>';

            card.innerHTML = `
                <div class="quote-card-info">
                    <h3 class="quote-card-name">${quote.name}</h3>
                    <p class="quote-card-details">${clientName}</p>
                    <p class="quote-card-meta">Số: ${quote.quoteNumber} &bull; Sửa lần cuối: ${lastModifiedDate}</p>
                </div>
                <div class="quote-card-actions">
                    <button class="btn-open">Mở</button>
                    <button class="btn-delete">Xóa</button>
                </div>
            `;
            savedQuotesContainer.appendChild(card);
        });
    }
    
    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredQuotes = quotes.filter(q => 
            q.name.toLowerCase().includes(searchTerm) || 
            (q.client && q.client.name.toLowerCase().includes(searchTerm)) ||
            q.quoteNumber.toLowerCase().includes(searchTerm)
        );
        renderSavedQuotes(filteredQuotes);
    }

    function handleQuoteListClick(e) {
        const target = e.target;
        const quoteCard = target.closest('.quote-card');
        if (!quoteCard) return;

        const quoteId = Number(quoteCard.dataset.id);

        if (target.matches('.btn-open')) {
            switchQuote(quoteId);
        } else if (target.matches('.btn-delete')) {
            deleteQuote(quoteId, true);
        }
    }

    // --- Main Initialization ---
    loadState();
    if (activeQuoteId) {
        renderQuote(activeQuoteId);
    }
    setupGlobalEventListeners();
    updateDate();
});