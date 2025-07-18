
document.addEventListener('DOMContentLoaded', function() {
    // --- Global State ---
    let quotes = [];
    let activeQuoteId = null;
    let indicatorTimeout;
    let confirmCallback = null;

    // --- DOM Elements ---
    const tabsContainer = document.getElementById('tabs-container');
    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const vatRateInput = document.getElementById('vat-rate');
    const quoteListBtn = document.getElementById('quote-list-btn');
    const quoteListModal = document.getElementById('quote-list-modal');
    const savedQuotesList = document.getElementById('saved-quotes-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const saveIndicator = document.getElementById('save-indicator');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    
    // --- State Management (Save/Load) ---
    function getStorageKey(baseKey) {
        return baseKey; // Data is stored locally per browser
    }

    function loadState() {
        const savedQuotesKey = getStorageKey('savedQuotes');
        const activeIdKey = getStorageKey('activeQuoteId');
        
        const savedQuotes = JSON.parse(localStorage.getItem(savedQuotesKey));
        
        if (savedQuotes && savedQuotes.length > 0) {
            quotes = savedQuotes; // Load all saved quotes into memory
            const savedActiveId = localStorage.getItem(activeIdKey);
            const activeIdNum = savedActiveId ? Number(savedActiveId) : null;
            const activeQuoteExists = quotes.some(q => q.id === activeIdNum);
            
            if (activeIdNum && activeQuoteExists) {
                activeQuoteId = activeIdNum;
            } else {
                activeQuoteId = quotes[0].id; // Default to the first quote
            }
        } else {
            // If no quotes exist, create a fresh one
            const newQuote = createNewQuoteObject('Báo giá đầu tiên');
            quotes = [newQuote];
            activeQuoteId = newQuote.id;
            saveState(false); // Save the very first quote without showing indicator
        }
    }
    
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const debouncedSave = debounce(() => saveState(), 500);

    function saveState(showIndicator = true) {
        if (activeQuoteId === null) return;

        const savedQuotesKey = getStorageKey('savedQuotes');
        const activeIdKey = getStorageKey('activeQuoteId');

        const activeQuoteData = collectQuoteDataFromDOM();
        activeQuoteData.lastModified = new Date().toISOString();
        
        const activeQuoteIndex = quotes.findIndex(q => q.id === activeQuoteId);
        if (activeQuoteIndex > -1) {
            quotes[activeQuoteIndex] = activeQuoteData;
        } else {
            quotes.push(activeQuoteData);
        }

        localStorage.setItem(savedQuotesKey, JSON.stringify(quotes));
        localStorage.setItem(activeIdKey, activeQuoteId.toString());
        
        renderTabs(); // Re-render tabs in case the name changed
        
        if (showIndicator) {
            saveIndicator.classList.add('show');
            clearTimeout(indicatorTimeout);
            indicatorTimeout = setTimeout(() => {
                saveIndicator.classList.remove('show');
            }, 2000);
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

        const currentQuote = quotes.find(q => q.id === activeQuoteId) || {};

        return {
            id: activeQuoteId,
            name: currentQuote.name || 'Báo giá mới',
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
    
    // --- Rendering ---
    function renderQuote(quoteId) {
        const quote = quotes.find(q => q.id === quoteId);
        if (!quote) return;
        
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
                    row.querySelector('.item-spec').value = item.spec;
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

    function renderTabs() {
        tabsContainer.innerHTML = '';
        quotes.forEach(quote => {
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.dataset.id = quote.id;
            if (quote.id === activeQuoteId) {
                tab.classList.add('active');
            }

            const tabName = document.createElement('span');
            tabName.textContent = quote.name;
            tab.appendChild(tabName);
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.setAttribute('aria-label', `Đóng báo giá ${quote.name}`);
            tab.appendChild(closeBtn);

            tabName.addEventListener('click', () => switchQuote(quote.id));
            tabName.addEventListener('dblclick', () => editTabName(tabName, quote.id));
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteQuote(quote.id);
            });

            tabsContainer.appendChild(tab);
        });
        
        const addTabBtn = document.createElement('button');
        addTabBtn.id = 'add-tab-btn';
        addTabBtn.textContent = '+';
        addTabBtn.title = 'Tạo báo giá mới';
        addTabBtn.setAttribute('aria-label', 'Tạo báo giá mới');
        addTabBtn.addEventListener('click', addNewQuote);
        tabsContainer.appendChild(addTabBtn);
    }
    
    // --- Core Logic Functions ---
    function updateDate() {
        const today = new Date();
        document.getElementById('quote-date').textContent = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
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
                        <input type="number" class="dimension dim-d" value="0" min="0" step="0.01" title="Dài (m)">
                        <span>x</span>
                        <input type="number" class="dimension dim-s" value="0" min="0" step="0.01" title="Sâu (m)">
                        <span>x</span>
                        <input type="number" class="dimension dim-c" value="0" min="0" step="0.01" title="Cao (m)">
                    </div>
                    <input type="text" class="item-spec" placeholder="Quy cách, mô tả chi tiết...">
                </div>
            </td>
            <td data-label="Đơn vị"><input type="text" value="cái"></td>
            <td data-label="KL (m²)" class="volume text-right">0.00</td>
            <td data-label="SL"><input type="number" class="quantity" value="1" min="1"></td>
            <td data-label="Đơn giá"><input type="text" class="price" value="0" inputmode="numeric"></td>
            <td data-label="Thành tiền" class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa dòng" aria-label="Xóa dòng">&times;</button></td>
        `;
        return row;
    }
    
    function createCategoryRowDOM() {
        const row = document.createElement('tr');
        row.className = 'category-header';
        row.innerHTML = `
            <td colspan="7"><input type="text" placeholder="Nhập tên danh mục..."></td>
            <td class="actions"><button class="delete-btn" title="Xóa danh mục" aria-label="Xóa danh mục và các hạng mục con">&times;</button></td>
        `;
        row.querySelector('input').addEventListener('focus', (e) => e.target.placeholder = 'Nhập tên danh mục...');
        return row;
    }

    function createNewQuoteObject(name) {
        const defaultName = name || `Báo giá #${quotes.length + 1}`;
        const newId = Date.now();
        return {
            id: newId,
            name: defaultName,
            lastModified: new Date().toISOString(),
            company: { name: 'Tên Công Ty Của Bạn', address: 'Địa chỉ: 123 Đường ABC, Phường X, Quận Y, TP. Z', contact: 'Điện thoại: 0987 654 321 | Email: info@tencongty.com', bank: '' },
            client: { name: '', phone: '', address: ''},
            quoteNumber: `BG-${new Date().getFullYear()}-${newId.toString().slice(-4)}`,
            vatRate: 10,
            notes: 'Báo giá có hiệu lực trong vòng 30 ngày.',
            tableData: [
                { type: 'category', name: 'Hạng mục chính' },
                { type: 'item', name: '', spec: '', unit: 'cái', dimD: 0, dimS: 0, dimC: 0, quantity: 1, price: '0' }
            ]
        };
    }

    function updateTotals() {
        let grandSubtotal = 0;
        let currentCategorySubtotal = 0;
        let currentCategoryInput = null;

        tableBody.querySelectorAll('tr').forEach(row => {
            if (row.classList.contains('category-header')) {
                if (currentCategoryInput) {
                    currentCategoryInput.placeholder = `Nhóm (${formatCurrency(currentCategorySubtotal)})`;
                }
                currentCategorySubtotal = 0;
                currentCategoryInput = row.querySelector('input');
            } else if (row.classList.contains('item-row')) {
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
                currentCategorySubtotal += lineTotal;
            }
        });

        if (currentCategoryInput) {
            currentCategoryInput.placeholder = `Nhóm (${formatCurrency(currentCategorySubtotal)})`;
        }

        const taxRate = (parseFloat(vatRateInput.value) || 0) / 100;
        const tax = grandSubtotal * taxRate;
        const grandTotal = grandSubtotal + tax;

        document.getElementById('subtotal').textContent = formatCurrency(grandSubtotal);
        document.getElementById('tax').textContent = formatCurrency(tax);
        document.getElementById('grand-total').querySelector('strong').textContent = formatCurrency(grandTotal);
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
        document.querySelector('.page').addEventListener('input', (e) => {
            if (e.target.classList.contains('price')) {
                 formatPriceInput(e.target);
            }
            updateTotals();
            debouncedSave();
        });

        addRowBtn.addEventListener('click', () => {
            const row = createItemRowDOM();
            tableBody.appendChild(row);
            updateRowNumbers();
            updateTotals();
            debouncedSave();
        });

        addCategoryBtn.addEventListener('click', () => {
            const row = createCategoryRowDOM();
            tableBody.appendChild(row);
            updateTotals();
            debouncedSave();
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
                debouncedSave();
            }
        });

        quoteListBtn.addEventListener('click', openQuoteListModal);
        modalCloseBtn.addEventListener('click', closeQuoteListModal);
        quoteListModal.addEventListener('click', (e) => {
            if (e.target === quoteListModal) {
                closeQuoteListModal();
            }
        });
        savedQuotesList.addEventListener('click', handleQuoteListClick);

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

    // --- Tab Actions ---
    function switchQuote(quoteId) {
        if (quoteId === activeQuoteId) return;
        if(activeQuoteId !== null) debouncedSave.flush();
        
        activeQuoteId = quoteId;
        renderQuote(activeQuoteId);
        renderTabs(); 
        localStorage.setItem(getStorageKey('activeQuoteId'), activeQuoteId.toString());
    }
    
    function addNewQuote() {
        if(activeQuoteId !== null) debouncedSave.flush();
        const newQuote = createNewQuoteObject();
        quotes.push(newQuote);
        localStorage.setItem(getStorageKey('savedQuotes'), JSON.stringify(quotes));
        switchQuote(newQuote.id);
    }

    function deleteQuote(quoteId, fromModal = false) {
        if (quotes.length <= 1) {
            alert("Không thể xóa báo giá cuối cùng.");
            return;
        }

        const quoteToDelete = quotes.find(q => q.id === quoteId);
        if (!quoteToDelete) return;

        showConfirmModal(
            `Bạn có chắc chắn muốn xóa vĩnh viễn báo giá "${quoteToDelete.name}" không?`,
            () => {
                quotes = quotes.filter(q => q.id !== quoteId);
                localStorage.setItem(getStorageKey('savedQuotes'), JSON.stringify(quotes));

                if (activeQuoteId === quoteId) {
                    const newActiveId = quotes[0].id;
                    switchQuote(newActiveId);
                } else {
                    renderTabs(); // Just re-render tabs if a background tab was closed
                }
                
                if (fromModal || quoteListModal.style.display === 'flex') {
                    renderSavedQuotes(quotes);
                }
            }
        );
    }

    function editTabName(tabNameElement, quoteId) {
        const currentName = tabNameElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'tab-name-edit';
        
        tabNameElement.replaceWith(input);
        input.focus();
        input.select();

        const saveNewName = () => {
            const newName = input.value.trim() || currentName;
            const quote = quotes.find(q => q.id === quoteId);
            if (quote) {
                quote.name = newName;
            }
            input.replaceWith(tabNameElement);
            debouncedSave(); // This will save the whole quote object with the new name
        };

        input.addEventListener('blur', saveNewName);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
            }
        });
    }

    // --- Quote List Modal ---
    function openQuoteListModal() {
        renderSavedQuotes(quotes);
        quoteListModal.style.display = 'flex';
    }

    function closeQuoteListModal() {
        quoteListModal.style.display = 'none';
    }
    
    function showConfirmModal(message, onConfirm) {
        confirmMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmModal.style.display = 'flex';
    }

    function hideConfirmModal() {
        confirmModal.style.display = 'none';
        confirmCallback = null;
    }

    function renderSavedQuotes(quotesToRender) {
        savedQuotesList.innerHTML = '';
        if (!quotesToRender || quotesToRender.length === 0) {
            savedQuotesList.innerHTML = '<li>Không có báo giá nào được lưu.</li>';
            return;
        }

        const sortedQuotes = [...quotesToRender].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        sortedQuotes.forEach(quote => {
            const li = document.createElement('li');
            li.dataset.id = quote.id;
            
            const lastModifiedDate = new Date(quote.lastModified).toLocaleDateString('vi-VN');
            const clientName = quote.client?.name ? `Khách hàng: ${quote.client.name}` : 'Chưa có khách hàng';

            li.innerHTML = `
                <div class="quote-item-info">
                    <span class="quote-item-name">${quote.name}</span>
                    <span class="quote-item-details">${clientName} - ${quote.quoteNumber} - Sửa lần cuối: ${lastModifiedDate}</span>
                </div>
                <div class="quote-item-actions">
                    <button class="btn-open">Mở</button>
                    <button class="btn-delete">Xóa</button>
                </div>
            `;
            savedQuotesList.appendChild(li);
        });
    }

    function handleQuoteListClick(e) {
        const target = e.target;
        const quoteItem = target.closest('li[data-id]');
        if (!quoteItem) return;

        const quoteId = Number(quoteItem.dataset.id);

        if (target.matches('.btn-open')) {
            switchQuote(quoteId);
            closeQuoteListModal();
        } else if (target.matches('.btn-delete')) {
            deleteQuote(quoteId, true);
        }
    }

    // --- Main Initialization ---
    loadState();
    renderTabs();
    if (activeQuoteId) {
        renderQuote(activeQuoteId);
    }
    setupGlobalEventListeners();
    updateDate();
});
