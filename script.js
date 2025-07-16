document.addEventListener('DOMContentLoaded', function() {
    // --- Global State ---
    let quotes = [];
    let activeQuoteId = null;
    let currentUser = null;

    // --- DOM Elements ---
    const tabsContainer = document.getElementById('tabs-container');
    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const vatRateInput = document.getElementById('vat-rate');
    const userProfileElement = document.getElementById('user-profile');
    const userNameElement = document.getElementById('user-name');
    const userPicElement = document.getElementById('user-pic');
    const logoutBtn = document.getElementById('logout-btn');
    const loginOverlay = document.getElementById('login-overlay');

    // --- Main Initialization ---
    function init() {
        // App waits for Google Sign-In. The GSI library automatically
        // renders the button and calls handleCredentialResponse on success.
        logoutBtn.addEventListener('click', logout);
        document.body.classList.add('app-hidden');
    }
    
    // --- Google Sign-In & App Lifecycle ---
    function jwt_decode(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            console.error("Failed to decode JWT", e);
            return null;
        }
    }

    window.handleCredentialResponse = function(response) {
        const decoded = jwt_decode(response.credential);
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
    };

    function startApp() {
        // Hide login, show main app
        document.body.classList.remove('app-hidden');
        loginOverlay.style.display = 'none';
        userProfileElement.style.display = 'flex';

        // Update user profile UI
        userNameElement.textContent = currentUser.name;
        userPicElement.src = currentUser.picture;
        userPicElement.alt = `Avatar of ${currentUser.name}`;

        // Run the original app setup logic
        loadState();
        renderTabs();
        if (activeQuoteId && quotes.some(q => q.id == activeQuoteId)) {
            renderQuote(activeQuoteId);
        } else if (quotes.length > 0) {
            // if no active quote, but quotes exist, activate the first one
            switchQuote(quotes[0].id);
        }
        setupGlobalEventListeners();
        updateDate();
    }
    
    function resetUI() {
        document.body.classList.add('app-hidden');
        loginOverlay.style.display = 'flex';
        userProfileElement.style.display = 'none';

        // Clear table
        tableBody.innerHTML = '';
        document.getElementById('subtotal').textContent = '0';
        document.getElementById('tax').textContent = '0';
        document.getElementById('grand-total').querySelector('strong').textContent = '0';

        // Clear tabs
        tabsContainer.innerHTML = '';
        
        // Clear forms
        const form = document.querySelector('.page');
        if (form) {
            form.querySelectorAll('input, textarea').forEach(input => {
                if(input.type !== 'button' && input.type !== 'submit' && input.type !== 'number') {
                     input.value = '';
                }
            });
             document.getElementById('vat-rate').value = 10;
        }

        updateDate(); // Reset date to current
    }


    function logout() {
        // This function is for Google's "One Tap" prompt. Disabling it means
        // the user won't be automatically signed-in on their next visit.
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
            quotes = savedQuotes;
            activeQuoteId = savedActiveId && quotes.some(q => q.id == savedActiveId) ? savedActiveId : quotes[0].id;
        } else {
            // Create a default first quote for new users
            const newQuote = createNewQuoteObject('Báo giá đầu tiên');
            quotes = [newQuote];
            activeQuoteId = newQuote.id;
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

        const activeQuoteIndex = quotes.findIndex(q => q.id == activeQuoteId);
        if (activeQuoteIndex > -1) {
            quotes[activeQuoteIndex] = collectQuoteDataFromDOM();
        }
        localStorage.setItem(savedQuotesKey, JSON.stringify(quotes));
        localStorage.setItem(activeIdKey, activeQuoteId);
        renderTabs(); // Also update the tab name in case it changed via input
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
                    unit: row.querySelector('td:nth-child(3) input').value,
                    dimD: row.querySelector('.dim-d').value,
                    dimS: row.querySelector('.dim-s').value,
                    dimC: row.querySelector('.dim-c').value,
                    quantity: row.querySelector('.quantity').value,
                    price: row.querySelector('.price').value.replace(/\./g, '')
                });
            }
        });

        const currentQuote = quotes.find(q => q.id == activeQuoteId) || {};

        return {
            id: activeQuoteId,
            name: currentQuote.name,
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
        const quote = quotes.find(q => q.id == quoteId);
        if (!quote) return;
        
        // Populate header and client info
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

        // Recreate table
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
                    row.querySelector('td:nth-child(3) input').value = item.unit;
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
            if (quote.id == activeQuoteId) {
                tab.classList.add('active');
            }

            const tabName = document.createElement('span');
            tabName.textContent = quote.name;
            tab.appendChild(tabName);
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close-btn';
            closeBtn.innerHTML = '&times;';
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
            <td><input type="text" class="price" value="0" inputmode="numeric"></td>
            <td class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa dòng">&times;</button></td>
        `;
        return row;
    }
    
    function createCategoryRowDOM() {
        const row = document.createElement('tr');
        row.className = 'category-header';
        row.innerHTML = `
            <td colspan="6"><input type="text" placeholder="Nhập tên danh mục..."></td>
            <td class="category-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa danh mục">&times;</button></td>
        `;
        return row;
    }

    function createNewQuoteObject(name) {
        const defaultName = name || `Báo giá #${quotes.length + 1}`;
        return {
            id: Date.now(),
            name: defaultName,
            company: { name: 'Tên Công Ty Của Bạn', address: 'Địa chỉ: 123 Đường ABC, Phường X, Quận Y, TP. Z', contact: 'Điện thoại: 0987 654 321 | Email: info@tencongty.com', bank: '' },
            client: { name: '', phone: '', address: ''},
            quoteNumber: `BG-${new Date().getFullYear()}-001`,
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
        let currentCategoryTotalElement = null;

        tableBody.querySelectorAll('tr').forEach(row => {
            if (row.classList.contains('category-header')) {
                if (currentCategoryTotalElement) {
                    currentCategoryTotalElement.textContent = formatCurrency(currentCategorySubtotal);
                }
                currentCategorySubtotal = 0;
                currentCategoryTotalElement = row.querySelector('.category-total');
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
            saveState(); // Immediate save
        });

        addCategoryBtn.addEventListener('click', () => {
            const row = createCategoryRowDOM();
            tableBody.appendChild(row);
            updateTotals();
            saveState(); // Immediate save
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
                saveState(); // Immediate save
            }
        });
    }

    // --- Tab Actions ---
    function switchQuote(quoteId) {
        if (quoteId == activeQuoteId) return;
        saveState(); // Save current before switching
        activeQuoteId = quoteId;
        renderQuote(activeQuoteId);
        renderTabs(); // To update active state
        localStorage.setItem(getStorageKey('activeQuoteId'), activeQuoteId);
    }
    
    function addNewQuote() {
        saveState(); // Save current work first
        const newQuote = createNewQuoteObject();
        quotes.push(newQuote);
        activeQuoteId = newQuote.id;
        renderQuote(activeQuoteId);
        renderTabs();
        saveState(); // Save the new quote state
    }

    function deleteQuote(quoteId) {
        if (quotes.length === 1) {
            alert("Không thể xóa báo giá cuối cùng.");
            return;
        }
        
        const quoteToDelete = quotes.find(q => q.id == quoteId);
        if (confirm(`Bạn có chắc chắn muốn xóa "${quoteToDelete.name}" không?`)) {
            quotes = quotes.filter(q => q.id != quoteId);
            if (activeQuoteId == quoteId) {
                activeQuoteId = quotes[0].id;
                renderQuote(activeQuoteId);
            }
            renderTabs();
            saveState();
        }
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
            const quote = quotes.find(q => q.id == quoteId);
            if (quote) {
                quote.name = newName;
            }
            input.replaceWith(tabNameElement);
            saveState(); // This will re-render tabs with the new name
        };

        input.addEventListener('blur', saveNewName);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
            }
        });
    }

    // --- Start the App ---
    init();
});