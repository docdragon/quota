document.addEventListener('DOMContentLoaded', function() {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace with your own Firebase project configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDFhW2GT1e4hx7GGed9QuBseG0hRZx2uVI",
  authDomain: "quota-96ee4.firebaseapp.com",
  projectId: "quota-96ee4",
  storageBucket: "quota-96ee4.firebasestorage.app",
  messagingSenderId: "394287063195",
  appId: "1:394287063195:web:0e0fd8c50b562a73cce63e",
  measurementId: "G-JTYHFWD3L1"
    };

    // --- Firebase Initialization ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    let quotesCollection;
    let managedItemsCollection;

    // --- Global State ---
    let quotes = [];
    let managedItems = [];
    let activeQuoteId = null;
    let indicatorTimeout;
    let confirmCallback = null;
    let unsubscribeQuotes = () => {};
    let unsubscribeManagedItems = () => {};
    let activeAutocompleteInput = null;
    let autocompleteActiveIndex = -1;
    let autocompleteHideTimeout;

    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const mainHeader = document.querySelector('.main-header');
    const appContainer = document.getElementById('app-container');
    const userProfile = document.getElementById('user-profile');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const navEditor = document.getElementById('nav-editor');
    const navList = document.getElementById('nav-list');
    const navManagement = document.getElementById('nav-management');
    const editorView = document.getElementById('editor-view');
    const listView = document.getElementById('list-view');
    const managementView = document.getElementById('management-view');

    const saveQuoteBtn = document.getElementById('save-quote-btn');
    const clearQuoteBtn = document.getElementById('clear-quote-btn');
    const quoteNameInput = document.getElementById('quote-name-input');
    const tableBody = document.querySelector('#quote-table tbody');
    const addRowBtn = document.getElementById('add-row');
    const addCategoryBtn = document.getElementById('add-category');
    const addFromSavedBtn = document.getElementById('add-from-saved');
    const vatRateInput = document.getElementById('vat-rate');
    const saveIndicator = document.getElementById('save-indicator');

    const savedQuotesContainer = document.getElementById('saved-quotes-container');
    const searchQuotesInput = document.getElementById('search-quotes-input');
    const createNewQuoteFromListBtn = document.getElementById('create-new-quote-from-list');

    const addItemForm = document.getElementById('add-item-form');
    const savedItemsList = document.getElementById('saved-items-list');
    const managementFormTitle = document.getElementById('management-form-title');
    const itemFormSubmitBtn = document.getElementById('item-form-submit-btn');
    const itemFormCancelBtn = document.getElementById('item-form-cancel-btn');

    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    const selectItemModal = document.getElementById('select-item-modal');
    const selectItemList = document.getElementById('select-item-list');
    const searchSavedItemsInput = document.getElementById('search-saved-items-input');
    
    const autocompleteBox = document.getElementById('autocomplete-box');

    // --- Event Listeners Setup ---
    // Setup login listener immediately on load
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
                .catch(err => {
                    console.error("Login failed with an error:", err);
                    alert(`Đăng nhập thất bại.\n\nMã lỗi: ${err.code}\nThông báo: ${err.message}\n\nVui lòng kiểm tra lại cấu hình Firebase và đảm bảo trình duyệt không chặn cửa sổ pop-up.`);
                });
        });
    } else {
        console.error("FATAL: Login button with id 'login-btn' not found in the DOM.");
    }
    setupGlobalEventListeners(); // Setup all other listeners

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            loginView.style.display = 'none';
            mainHeader.style.display = 'block';
            appContainer.style.display = 'block';
            
            const userRef = db.collection('users').doc(user.uid);
            quotesCollection = userRef.collection('quotes');
            managedItemsCollection = userRef.collection('managed_items');

            setupUserProfile(user);
            initializeAppState();
        } else {
            // User is signed out
            loginView.style.display = 'flex';
            mainHeader.style.display = 'none';
            appContainer.style.display = 'none';
            userProfile.style.display = 'none';
            
            // Clear state and unsubscribe from listeners
            unsubscribeQuotes();
            unsubscribeManagedItems();
            quotes = [];
            managedItems = [];
            activeQuoteId = null;
        }
    });

    function setupUserProfile(user) {
        userProfile.style.display = 'flex';
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
    }

    // --- Main App Initialization ---
    function initializeAppState() {
        loadQuotes();
        loadManagedItems();
        updateDate();
        showEditorView(); // Default to editor view
    }

    async function loadQuotes() {
        unsubscribeQuotes = quotesCollection
            .orderBy('lastModified', 'desc')
            .onSnapshot(async (snapshot) => {
                if (snapshot.empty) {
                    await addNewQuote(false); // Create first quote if none exist
                    return;
                }
                
                quotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const currentQuoteExists = quotes.some(q => q.id === activeQuoteId);
                if (!activeQuoteId || !currentQuoteExists) {
                    activeQuoteId = quotes[0]?.id;
                }

                if (activeQuoteId) {
                    renderQuote(activeQuoteId);
                }
                
                if (listView.style.display !== 'none') {
                    renderSavedQuotes(quotes);
                }
            }, error => {
                console.error("Error loading quotes:", error);
                alert("Không thể tải danh sách báo giá. Vui lòng thử lại.");
            });
    }

    function loadManagedItems() {
        unsubscribeManagedItems = managedItemsCollection
            .orderBy('name')
            .onSnapshot((snapshot) => {
                managedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (managementView.style.display !== 'none') {
                    renderManagedItems(managedItems);
                }
                 if (selectItemModal.style.display !== 'none') {
                    renderSelectableItems(managedItems);
                }
            }, error => {
                console.error("Error loading managed items:", error);
            });
    }

    async function handleSaveQuote() {
        if (!activeQuoteId) return;

        const domData = collectQuoteDataFromDOM();
        const quoteData = {
            ...domData,
            lastModified: new Date().toISOString()
        };

        try {
            await quotesCollection.doc(activeQuoteId).set(quoteData, { merge: true });
            showSaveIndicator();
        } catch (error) {
            console.error("Error saving quote: ", error);
            alert("Lỗi khi lưu báo giá. Vui lòng thử lại.");
        }
    }
    
    function showSaveIndicator() {
        saveIndicator.classList.add('show');
        clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
            saveIndicator.classList.remove('show');
        }, 2000);
    }
    
    // --- Data Collection ---
    function collectQuoteDataFromDOM() {
        const tableData = [];
        tableBody.querySelectorAll('tr').forEach(row => {
            if (row.classList.contains('category-header')) {
                tableData.push({ type: 'category', name: row.querySelector('input').value });
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
            client: { name: document.getElementById('client-name').value, phone: document.getElementById('client-phone').value, address: document.getElementById('client-address').value },
            quoteNumber: document.getElementById('quote-number').value,
            vatRate: vatRateInput.value,
            notes: document.getElementById('notes-area').value,
            tableData: tableData
        };
    }

    // --- View Management ---
    function showView(viewToShow) {
        [editorView, listView, managementView].forEach(view => {
            view.style.display = view === viewToShow ? 'block' : 'none';
        });
        [navEditor, navList, navManagement].forEach(nav => nav.classList.remove('active'));

        if(viewToShow === editorView) navEditor.classList.add('active');
        if(viewToShow === listView) navList.classList.add('active');
        if(viewToShow === managementView) navManagement.classList.add('active');
    }

    function showEditorView() { showView(editorView); }
    function showListView() { handleSaveQuote(); renderSavedQuotes(quotes); searchQuotesInput.value = ''; showView(listView); }
    function showManagementView() { renderManagedItems(managedItems); showView(managementView); }


    // --- Rendering ---
    function renderQuote(quoteIdToRender) {
        const quote = quotes.find(q => q.id === quoteIdToRender);
        if (!quote) return;

        quoteNameInput.value = quote.name || '';
        const company = quote.company || {};
        document.getElementById('company-name').value = company.name || '';
        document.getElementById('company-address').value = company.address || '';
        document.getElementById('company-contact').value = company.contact || '';
        document.getElementById('company-bank').value = company.bank || '';
        const client = quote.client || {};
        document.getElementById('client-name').value = client.name || '';
        document.getElementById('client-phone').value = client.phone || '';
        document.getElementById('client-address').value = client.address || '';
        document.getElementById('quote-number').value = quote.quoteNumber || '';
        vatRateInput.value = quote.vatRate || 10;
        document.getElementById('notes-area').value = quote.notes || '';

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
                    setTimeout(() => { specTextarea.style.height = 'auto'; specTextarea.style.height = (specTextarea.scrollHeight) + 'px'; }, 0);
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

    // --- Core Logic & DOM Creation ---
    function updateDate() { document.getElementById('quote-date').textContent = `Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`; }
    function formatCurrency(num) { return num.toLocaleString('vi-VN'); }
    function formatPriceInput(input) { let numericString = input.value.replace(/\D/g, ''); if (numericString) { input.value = new Intl.NumberFormat('vi-VN').format(BigInt(numericString)); } else { input.value = ''; } }
    function updateRowNumbers() { let itemCounter = 0; tableBody.querySelectorAll('tr.item-row').forEach(row => { itemCounter++; row.querySelector('td:first-child').textContent = itemCounter; }); }

    function createItemRowDOM(itemData = {}) {
        const row = document.createElement('tr');
        row.className = 'item-row';
        row.innerHTML = `
            <td data-label="STT"></td>
            <td data-label="Nội dung"><div class="content-cell">
                <input type="text" class="item-name" placeholder="Tên hạng mục, sản phẩm..." value="${itemData.name || ''}" autocomplete="off">
                <div class="dimensions-wrapper">
                    <label>K.thước (m):</label>
                    <input type="number" class="dimension dim-d" value="${itemData.dimD || 0}" min="0" step="0.01" title="Dài (m)" placeholder="Dài">
                    <span>x</span><input type="number" class="dimension dim-s" value="${itemData.dimS || 0}" min="0" step="0.01" title="Sâu (m)" placeholder="Sâu">
                    <span>x</span><input type="number" class="dimension dim-c" value="${itemData.dimC || 0}" min="0" step="0.01" title="Cao (m)" placeholder="Cao">
                </div>
                <textarea class="item-spec" placeholder="Quy cách, mô tả chi tiết..." rows="1">${itemData.spec || ''}</textarea>
            </div></td>
            <td data-label="Đơn vị"><input type="text" value="${itemData.unit || 'cái'}"></td>
            <td data-label="KL (m²)" class="volume text-right">0.00</td>
            <td data-label="SL"><input type="number" class="quantity" value="${itemData.quantity || 1}" min="1"></td>
            <td data-label="Đơn giá"><input type="text" class="price" value="${itemData.price || 0}" inputmode="numeric"></td>
            <td data-label="Thành tiền" class="line-total text-right">0</td>
            <td class="actions"><button class="delete-btn" title="Xóa dòng" aria-label="Xóa dòng"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
        const textarea = row.querySelector('.item-spec');
        textarea.addEventListener('input', () => { textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight) + 'px'; });
        setTimeout(() => textarea.dispatchEvent(new Event('input')), 0);
        formatPriceInput(row.querySelector('.price'));
        return row;
    }

    function createCategoryRowDOM() {
        const row = document.createElement('tr');
        row.className = 'category-header';
        row.innerHTML = `
            <td colspan="7"><input type="text" placeholder="Nhập tên nhóm hạng mục..."></td>
            <td class="actions"><button class="delete-btn" title="Xóa danh mục" aria-label="Xóa danh mục và các hạng mục con"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
        return row;
    }

    function createNewQuoteObject() {
        const newId = Date.now();
        const date = new Date(newId);
        const name = `Báo giá mới - ${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}`;
        return {
            name: name,
            lastModified: new Date().toISOString(),
            company: { name: 'Tên Công Ty Của Bạn', address: 'Địa chỉ', contact: 'Điện thoại | Email', bank: '' },
            client: { name: '', phone: '', address: ''},
            quoteNumber: `BG-${new Date().getFullYear()}-${String(newId).slice(-4)}`,
            vatRate: 10,
            notes: 'Báo giá có hiệu lực trong vòng 30 ngày.\nThanh toán 50% khi ký hợp đồng, 50% còn lại khi bàn giao.',
            tableData: [{ type: 'item', name: '', spec: '', unit: 'cái', dimD: 0, dimS: 0, dimC: 0, quantity: 1, price: '0' }]
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
            const price = parseFloat((row.querySelector('.price').value || '0').replace(/\./g, '')) || 0;
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
    
    // --- Event Handlers ---
    function setupGlobalEventListeners() {
        logoutBtn.addEventListener('click', () => { auth.signOut().catch(err => console.error("Logout failed:", err)); });

        navEditor.addEventListener('click', showEditorView);
        navList.addEventListener('click', showListView);
        navManagement.addEventListener('click', showManagementView);

        saveQuoteBtn.addEventListener('click', handleSaveQuote);
        clearQuoteBtn.addEventListener('click', handleClearQuote);
        
        editorView.addEventListener('input', handleEditorInput);
        editorView.addEventListener('focusin', handleAutocompleteFocus);
        editorView.addEventListener('keydown', handleAutocompleteKeydown);
        editorView.addEventListener('focusout', handleAutocompleteBlur);
        
        autocompleteBox.addEventListener('mousedown', (e) => {
            // This prevents the input from losing focus (and the box from closing)
            // when clicking on the scrollbar or an item in the autocomplete box.
            e.preventDefault();
        });


        addRowBtn.addEventListener('click', () => { tableBody.appendChild(createItemRowDOM()); updateRowNumbers(); updateTotals(); });
        addCategoryBtn.addEventListener('click', () => { tableBody.appendChild(createCategoryRowDOM()); updateTotals(); });
        addFromSavedBtn.addEventListener('click', openSelectItemModal);

        tableBody.addEventListener('click', function(e) {
            const deleteButton = e.target.closest('.delete-btn');
            if (!deleteButton) return;
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
        });

        createNewQuoteFromListBtn.addEventListener('click', () => { addNewQuote(); showEditorView(); });
        searchQuotesInput.addEventListener('input', handleSearch);
        savedQuotesContainer.addEventListener('click', handleQuoteListClick);

        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmOkBtn.addEventListener('click', () => { if (typeof confirmCallback === 'function') { confirmCallback(); } hideConfirmModal(); });
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) hideConfirmModal(); });

        addItemForm.addEventListener('submit', handleManageItemSubmit);
        itemFormCancelBtn.addEventListener('click', resetManagementForm);
        savedItemsList.addEventListener('click', handleSavedItemsListClick);

        selectItemModal.querySelector('.close-modal-btn').addEventListener('click', closeSelectItemModal);
        selectItemModal.addEventListener('click', (e) => { if (e.target === selectItemModal) closeSelectItemModal(); });
        searchSavedItemsInput.addEventListener('input', (e) => renderSelectableItems(managedItems, e.target.value));
        selectItemList.addEventListener('click', handleSelectableItemClick);
    }
    
    function handleEditorInput(e) {
        // Autocomplete logic
        if (e.target.matches('.item-name')) {
            handleAutocompleteInput(e.target);
        }

        // Price formatting
        if (e.target.classList.contains('price')) {
            formatPriceInput(e.target);
        }

        // Always update totals on any input in the editor
        updateTotals();
    }

    // --- Quote Actions ---
    function switchQuote(quoteId) { if (quoteId === activeQuoteId) { showEditorView(); return; }; activeQuoteId = quoteId; renderQuote(activeQuoteId); showEditorView(); }
    
    async function addNewQuote(doSwitchToEditor = true) {
        const newQuote = createNewQuoteObject();
        try {
            const docRef = await quotesCollection.add(newQuote);
            activeQuoteId = docRef.id;
            if (doSwitchToEditor) {
                renderQuote(activeQuoteId); // Manually render because listener might not have fired yet
                showEditorView();
            }
        } catch (error) {
            console.error("Error adding new quote: ", error);
        }
    }

    function deleteQuote(quoteId, fromListView = false) {
        const quoteToDelete = quotes.find(q => q.id === quoteId);
        if (!quoteToDelete) return;
        showConfirmModal('Xác nhận xóa', `Bạn có chắc chắn muốn xóa vĩnh viễn báo giá "${quoteToDelete.name}" không?`, async () => {
            try {
                await quotesCollection.doc(quoteId).delete();
                if (activeQuoteId === quoteId) {
                    activeQuoteId = null; // Let the listener pick the next one
                }
                // The onSnapshot listener will handle re-rendering the list.
            } catch (error) {
                console.error("Error deleting quote: ", error);
            }
        });
    }
    
    function handleClearQuote() {
        showConfirmModal('Làm trống báo giá?', 'Toàn bộ hạng mục, ghi chú và thông tin khách hàng sẽ được xoá. Thông tin công ty sẽ được giữ lại.', () => {
            const currentQuote = quotes.find(q => q.id === activeQuoteId);
            if (!currentQuote) return;
            const blankQuoteTemplate = createNewQuoteObject();
            const clearedQuote = { ...blankQuoteTemplate, id: currentQuote.id, name: currentQuote.name, company: currentQuote.company, quoteNumber: currentQuote.quoteNumber };
            renderQuote(currentQuote.id); // Re-render first
            quotesCollection.doc(currentQuote.id).set(clearedQuote, { merge: true }).then(handleSaveQuote);
        });
    }

    // --- Quote List View ---
    function showConfirmModal(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmOkBtn.className = 'btn-danger';
        confirmOkBtn.textContent = title.includes('xóa') ? 'Xóa' : 'Xác nhận';
        if(title.includes('Làm trống')) confirmOkBtn.textContent = 'Làm Trống';
        confirmModal.style.display = 'flex';
    }
    function hideConfirmModal() { confirmModal.style.display = 'none'; confirmCallback = null; }

    function renderSavedQuotes(quotesToRender) {
        savedQuotesContainer.innerHTML = '';
        if (!quotesToRender || quotesToRender.length === 0) {
            savedQuotesContainer.innerHTML = '<p class="empty-list-message">Không có báo giá nào. Hãy tạo một báo giá mới!</p>';
            return;
        }
        quotesToRender.forEach(quote => {
            const card = document.createElement('div');
            card.className = 'quote-card';
            card.dataset.id = quote.id;
            const lastModifiedDate = new Date(quote.lastModified).toLocaleDateString('vi-VN');
            const clientName = quote.client?.name ? `<strong>Khách hàng:</strong> ${quote.client.name}` : '<em>Chưa có khách hàng</em>';
            card.innerHTML = `
                <div class="quote-card-info">
                    <h3 class="quote-card-name">${quote.name}</h3><p class="quote-card-details">${clientName}</p>
                    <p class="quote-card-meta">Số: ${quote.quoteNumber} &bull; Sửa lần cuối: ${lastModifiedDate}</p>
                </div>
                <div class="quote-card-actions"><button class="btn-open">Mở</button><button class="btn-delete">Xóa</button></div>`;
            savedQuotesContainer.appendChild(card);
        });
    }
    
    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredQuotes = quotes.filter(q => q.name.toLowerCase().includes(searchTerm) || (q.client && q.client.name.toLowerCase().includes(searchTerm)) || q.quoteNumber.toLowerCase().includes(searchTerm));
        renderSavedQuotes(filteredQuotes);
    }

    function handleQuoteListClick(e) {
        const target = e.target;
        const quoteCard = target.closest('.quote-card');
        if (!quoteCard) return;
        const quoteId = quoteCard.dataset.id;
        if (target.matches('.btn-open')) switchQuote(quoteId);
        else if (target.matches('.btn-delete')) deleteQuote(quoteId, true);
    }
    
    // --- Management View ---
    function renderManagedItems(items) {
        savedItemsList.innerHTML = '';
        if (items.length === 0) {
            savedItemsList.innerHTML = '<p class="empty-list-message">Chưa có hạng mục nào được lưu.</p>';
            return;
        }
        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'managed-item-card';
            itemCard.dataset.id = item.id;
            itemCard.innerHTML = `
                <div class="item-card-info">
                    <p class="item-card-name">${item.name}</p>
                    <p class="item-card-spec">${item.spec || 'Không có mô tả'}</p>
                </div>
                <div class="item-card-details">
                    <span class="item-card-price">${formatCurrency(Number(item.price))}đ</span> / ${item.unit}
                </div>
                <div class="item-card-actions">
                    <button class="btn-edit-item">Sửa</button>
                    <button class="btn-delete-item">Xóa</button>
                </div>`;
            savedItemsList.appendChild(itemCard);
        });
    }

    async function handleManageItemSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('item-form-id').value;
        const itemData = {
            name: document.getElementById('item-form-name').value,
            spec: document.getElementById('item-form-spec').value,
            unit: document.getElementById('item-form-unit').value,
            price: document.getElementById('item-form-price').value.replace(/\./g, '')
        };
        try {
            if (id) {
                await managedItemsCollection.doc(id).update(itemData);
            } else {
                await managedItemsCollection.add(itemData);
            }
            resetManagementForm();
        } catch (error) {
            console.error("Error saving managed item:", error);
            alert("Lỗi khi lưu hạng mục.");
        }
    }

    function resetManagementForm() {
        addItemForm.reset();
        document.getElementById('item-form-id').value = '';
        managementFormTitle.textContent = 'Thêm Hạng mục mới';
        itemFormSubmitBtn.textContent = 'Lưu Hạng mục';
        itemFormCancelBtn.style.display = 'none';
    }

    function handleSavedItemsListClick(e) {
        const card = e.target.closest('.managed-item-card');
        if (!card) return;
        const id = card.dataset.id;
        const item = managedItems.find(i => i.id === id);
        if (!item) return;

        if (e.target.matches('.btn-delete-item')) {
            showConfirmModal('Xóa Hạng mục?', `Bạn có chắc muốn xóa hạng mục "${item.name}"?`, () => {
                managedItemsCollection.doc(id).delete().catch(err => console.error("Error deleting item: ", err));
            });
        } else if (e.target.matches('.btn-edit-item')) {
            document.getElementById('item-form-id').value = item.id;
            document.getElementById('item-form-name').value = item.name;
            document.getElementById('item-form-spec').value = item.spec;
            document.getElementById('item-form-unit').value = item.unit;
            const priceInput = document.getElementById('item-form-price');
            priceInput.value = item.price;
            formatPriceInput(priceInput);
            managementFormTitle.textContent = 'Chỉnh sửa Hạng mục';
            itemFormSubmitBtn.textContent = 'Cập nhật';
            itemFormCancelBtn.style.display = 'inline-block';
            window.scrollTo(0, 0);
        }
    }

    // --- Select Item Modal ---
    function openSelectItemModal() {
        renderSelectableItems(managedItems);
        selectItemModal.style.display = 'flex';
        searchSavedItemsInput.focus();
    }
    
    function closeSelectItemModal() {
        selectItemModal.style.display = 'none';
        searchSavedItemsInput.value = '';
    }

    function renderSelectableItems(items, searchTerm = '') {
        selectItemList.innerHTML = '';
        const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filteredItems.length === 0) {
            selectItemList.innerHTML = '<p class="empty-list-message">Không tìm thấy hạng mục nào.</p>';
            return;
        }
        filteredItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'selectable-item';
            itemDiv.dataset.id = item.id;
            itemDiv.innerHTML = `
                <p class="item-name">${item.name}</p>
                <p class="item-details">${formatCurrency(Number(item.price))}đ / ${item.unit}</p>`;
            selectItemList.appendChild(itemDiv);
        });
    }

    function handleSelectableItemClick(e) {
        const itemDiv = e.target.closest('.selectable-item');
        if (!itemDiv) return;
        const id = itemDiv.dataset.id;
        const item = managedItems.find(i => i.id === id);
        if (item) {
            const newRow = createItemRowDOM(item);
            tableBody.appendChild(newRow);
            updateRowNumbers();
            updateTotals();
            closeSelectItemModal();
        }
    }
    
    // --- Autocomplete Logic ---
    function handleAutocompleteFocus(e) {
        if (e.target.matches('.item-name')) {
            activeAutocompleteInput = e.target;
            if (e.target.value.trim().length > 0) {
                handleAutocompleteInput(e.target);
            }
        }
    }

    function handleAutocompleteInput(inputElement) {
        const value = inputElement.value.trim().toLowerCase();
        if (value.length === 0) {
            hideAutocomplete();
            return;
        }
        const filteredItems = managedItems.filter(item =>
            item.name.toLowerCase().includes(value)
        );
        if (filteredItems.length > 0) {
            showAutocomplete(filteredItems, inputElement);
        } else {
            hideAutocomplete();
        }
    }

    function handleAutocompleteKeydown(e) {
        if (!activeAutocompleteInput || autocompleteBox.style.display === 'none') return;
        if (!e.target.matches('.item-name')) return;

        const items = autocompleteBox.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                autocompleteActiveIndex++;
                if (autocompleteActiveIndex >= items.length) autocompleteActiveIndex = 0;
                highlightSuggestion();
                break;
            case 'ArrowUp':
                e.preventDefault();
                autocompleteActiveIndex--;
                if (autocompleteActiveIndex < 0) autocompleteActiveIndex = items.length - 1;
                highlightSuggestion();
                break;
            case 'Enter':
                e.preventDefault();
                if (autocompleteActiveIndex > -1) {
                    items[autocompleteActiveIndex].click();
                } else {
                    hideAutocomplete();
                }
                break;
            case 'Escape':
                hideAutocomplete();
                break;
        }
    }

    function handleAutocompleteBlur(e) {
        if (e.target.matches('.item-name')) {
            autocompleteHideTimeout = setTimeout(() => {
                hideAutocomplete();
            }, 150);
        }
    }

    function showAutocomplete(results, inputElement) {
        clearTimeout(autocompleteHideTimeout);
        autocompleteBox.innerHTML = '';
        
        results.slice(0, 10).forEach(item => { // Limit to 10 suggestions
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <p class="item-name">${item.name}</p>
                <p class="item-details">${formatCurrency(Number(item.price))}đ / ${item.unit}</p>`;
            div.addEventListener('click', () => {
                selectAutocompleteItem(item);
            });
            autocompleteBox.appendChild(div);
        });

        const rect = inputElement.getBoundingClientRect();
        autocompleteBox.style.left = `${rect.left + window.scrollX}px`;
        autocompleteBox.style.top = `${rect.bottom + window.scrollY}px`;
        autocompleteBox.style.width = `${rect.width}px`;
        
        autocompleteBox.style.display = 'block';
        autocompleteActiveIndex = -1;
    }

    function hideAutocomplete() {
        autocompleteBox.style.display = 'none';
        activeAutocompleteInput = null;
        autocompleteActiveIndex = -1;
    }

    function highlightSuggestion() {
        const items = autocompleteBox.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            if (index === autocompleteActiveIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function selectAutocompleteItem(item) {
        if (!activeAutocompleteInput) return;
        clearTimeout(autocompleteHideTimeout);

        const row = activeAutocompleteInput.closest('tr');
        if (row) {
            row.querySelector('.item-name').value = item.name;
            
            const specTextarea = row.querySelector('.item-spec');
            specTextarea.value = item.spec || '';
            specTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            row.querySelector('td[data-label="Đơn vị"] input').value = item.unit || 'cái';
            
            const priceInput = row.querySelector('.price');
            priceInput.value = item.price || '0';
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        hideAutocomplete();
        activeAutocompleteInput.focus();
    }
});