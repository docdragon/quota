
// Moved from inside DOMContentLoaded to be globally available.
function jwt_decode(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        console.error("Failed to decode JWT", e);
        return null;
    }
}

// Global callback for Google Sign-In.
// This function is guaranteed to exist when the GSI library loads.
window.handleCredentialResponse = function(response) {
    // Dispatch a custom event with the credential response.
    // The main application logic, which runs after DOMContentLoaded, will listen for this.
    const event = new CustomEvent('google-signin-success', { detail: response });
    document.dispatchEvent(event);
};


document.addEventListener('DOMContentLoaded', function() {
    // --- Global State ---
    let quotes = [];
    let activeQuoteId = null;
    let currentUser = null;
    let indicatorTimeout;
    let confirmCallback = null;

    // --- DOM Elements ---
    const tabsContainer = document.getElementById('tabs-container');
    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const vatRateInput = document.getElementById('vat-rate');
    const headerRightSide = document.getElementById('header-right-side');
    const userProfileElement = document.getElementById('user-profile');
    const userNameElement = document.getElementById('user-name');
    const userPicElement = document.getElementById('user-pic');
    const logoutBtn = document.getElementById('logout-btn');
    const loginOverlay = document.getElementById('login-overlay');
    const quoteListBtn = document.getElementById('quote-list-btn');
    const quoteListModal = document.getElementById('quote-list-modal');
    const savedQuotesList = document.getElementById('saved-quotes-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const saveIndicator = document.getElementById('save-indicator');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // --- Main Initialization ---
    function init() {
        logoutBtn.addEventListener('click', logout);
        document.body.classList.add('app-hidden');
        
        // Listen for the custom sign-in event dispatched by the global callback.
        document.addEventListener('google-signin-success', (e) => {
            const response = e.detail;
            const decoded = jwt_decode(response.credential); // jwt_decode is global
            if (!decoded) {
                alert("Đăng nhập thất bại. Vui lòng thử lại.");
                return;
            }
            currentUser = {
                id: decoded.sub,
                name: decoded.name,
                picture: decoded.picture
            };
            startApp();
        });
    }
    
    // --- Google Sign-In & App Lifecycle ---
    function startApp() {
        document.body.classList.remove('app-hidden');
        loginOverlay.style.display = 'none';
        headerRightSide.style.display = 'flex';

        userNameElement.textContent = currentUser.name;
        userPicElement.src = currentUser.picture;
        userPicElement.alt = `Avatar of ${currentUser.name}`;

        loadState();
        renderTabs();
        if (activeQuoteId && quotes.some(q => q.id === activeQuoteId)) {
            renderQuote(activeQuoteId);
        } else if (quotes.length > 0) {
            switchQuote(quotes[0].id);
        }
        setupGlobalEventListeners();
        updateDate();
    }
    
    function resetUI() {
        document.body.classList.add('app-hidden');
        loginOverlay.style.display = 'flex';
        headerRightSide.style.display = 'none';

        tableBody.innerHTML = '';
        document.getElementById('subtotal').textContent = '0';
        document.getElementById('tax').textContent = '0';
        document.getElementById('grand-total').querySelector('strong').textContent = '0';

        tabsContainer.innerHTML = '';
        
        const form = document.querySelector('.page');
        if (form) {
            form.querySelectorAll('input, textarea').forEach(input => {
                if(input.type !== 'button' && input.type !== 'submit' && input.type !== 'number') {
                     input.value = '';
                }
            });
             document.getElementById('vat-rate').value = 10;
        }

        updateDate();
    }

    function logout() {
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }

        currentUser = null;
        quotes = [];
        activeQuoteId = null;

        resetUI();
    }

    // --- State Management (Save/Load) ---
    function getStorageKey(baseKey) {
        if (!currentUser) return null;
        return `${baseKey}_${currentUser.id}`;
    }

    function loadState() {
        const savedQuotesKey = getStorageKey('savedQuotes');
        const activeIdKey = getStorageKey('activeQuoteId');
        
        if (!savedQuotesKey || !activeIdKey) return;

        const savedQuotes = JSON.parse(localStorage.getItem(savedQuotesKey));
        const savedActiveId = localStorage.getItem(activeIdKey);
        
        if (savedQuotes && savedQuotes.length > 0) {
             const activeIdNum = savedActiveId ? Number(savedActiveId) : null;
             const activeQuote = savedQuotes.find(q => q.id === activeIdNum);
             quotes = [activeQuote || savedQuotes[0]];
             activeQuoteId = quotes[0].id;
        } else {
            const newQuote = createNewQuoteObject('Báo giá đầu tiên');
            quotes = [newQuote];
            activeQuoteId = newQuote.id;
            saveState(); // Save the very first quote
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

    function saveState() {
        const savedQuotesKey = getStorageKey('savedQuotes');
        const activeIdKey = getStorageKey('activeQuoteId');
        if (!savedQuotesKey || !activeIdKey || !currentUser) return;

        let allQuotes = JSON.parse(localStorage.getItem(savedQuotesKey) || '[]');
        const activeQuoteData = collectQuoteDataFromDOM();
        activeQuoteData.lastModified = new Date().toISOString();
        
        const activeQuoteIndexInStorage = allQuotes.findIndex(q => q.id === activeQuoteId);
        if (activeQuoteIndexInStorage > -1) {
            allQuotes[activeQuoteIndexInStorage] = activeQuoteData;
        } else {
            allQuotes.push(activeQuoteData);
        }

        const activeQuoteIndexInMemory = quotes.findIndex(q => q.id === activeQuoteId);
         if (activeQuoteIndexInMemory > -1) {
            quotes[activeQuoteIndexInMemory] = activeQuoteData;
        }

        localStorage.setItem(savedQuotesKey, JSON.stringify(allQuotes));
        localStorage.setItem(activeIdKey, activeQuoteId.toString());
        renderTabs();
        
        saveIndicator.classList.add('show');
        clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
            saveIndicator.classList.remove('show');
        }, 2000);
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
            name: document.getElementById('company-name').value === 'Tên Công Ty Của Bạn' ? (currentQuote.name || 'Báo giá mới') : document.querySelector('.tab.active span')?.textContent || 'Báo giá mới',
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
        // Removed category total cell to simplify structure. Total is in input placeholder now.
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
        if (quoteId === activeQuoteId && document.querySelector('.tab.active')) return;
        if(activeQuoteId !== null) debouncedSave.flush();
        activeQuoteId = quoteId;
        renderQuote(activeQuoteId);
        renderTabs(); 
        localStorage.setItem(getStorageKey('activeQuoteId'), activeQuoteId.toString());
    }
    
    function addNewQuote() {
        debouncedSave.flush();
        const newQuote = createNewQuoteObject();
        quotes.push(newQuote);
        saveState();
        switchQuote(newQuote.id);
    }

    function deleteQuote(quoteId, fromModal = false) {
        const savedQuotesKey = getStorageKey('savedQuotes');
        let allQuotes = JSON.parse(localStorage.getItem(savedQuotesKey) || '[]');

        if (allQuotes.length <= 1) {
            alert("Không thể xóa báo giá cuối cùng.");
            return;
        }

        const quoteToDelete = allQuotes.find(q => q.id === quoteId);
        if (!quoteToDelete) return;

        showConfirmModal(
            `Bạn có chắc chắn muốn xóa vĩnh viễn báo giá "${quoteToDelete.name}" không?`,
            () => {
                const newQuotesList = allQuotes.filter(q => q.id !== quoteId);
                localStorage.setItem(savedQuotesKey, JSON.stringify(newQuotesList));
                
                quotes = quotes.filter(q => q.id !== quoteId);
                
                if (activeQuoteId === quoteId) {
                    let newActiveId = null;
                    if (quotes.length > 0) {
                        newActiveId = quotes[0].id;
                    } else if (newQuotesList.length > 0) {
                         newActiveId = newQuotesList[0].id;
                         quotes.push(newQuotesList[0]);
                    }
                    if (newActiveId) {
                        switchQuote(newActiveId);
                    } else {
                         // This case shouldn't be reached if we prevent deleting the last quote
                         activeQuoteId = null;
                         resetUI(); // Or create a new blank one
                    }
                }
                
                renderTabs();
                
                if (fromModal || quoteListModal.style.display === 'flex') {
                    renderSavedQuotes(newQuotesList);
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
            debouncedSave();
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
        const savedQuotesKey = getStorageKey('savedQuotes');
        if (!savedQuotesKey) return;
        const allQuotes = JSON.parse(localStorage.getItem(savedQuotesKey) || '[]');
        renderSavedQuotes(allQuotes);
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

        quotesToRender.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        quotesToRender.forEach(quote => {
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
            const isOpen = quotes.some(q => q.id === quoteId);
            if (!isOpen) {
                const savedQuotesKey = getStorageKey('savedQuotes');
                const allQuotes = JSON.parse(localStorage.getItem(savedQuotesKey) || '[]');
                const quoteData = allQuotes.find(q => q.id === quoteId);
                if (quoteData) {
                    quotes.push(quoteData);
                }
            }
            switchQuote(quoteId);
            closeQuoteListModal();
        } else if (target.matches('.btn-delete')) {
            deleteQuote(quoteId, true);
        }
    }

    // --- Start the App ---
    init();
});
