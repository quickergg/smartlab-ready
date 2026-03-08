/* =========================================
   SmartLab Admin - Equipment Management
   SPA class-based architecture with ModalManager integration
========================================= */

class EquipmentManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.allEquipment = [];
        this.filteredEquipment = [];
        this.statusOptions = [];
        this.isSubmitting = false;
        this._searchTimer = null;
        this.currentView = 'table';
        this.calendarDate = new Date();
        this.monthlyData = {}; // { 'YYYY-MM-DD': { reserved_items, reserved_qty, pending_items, pending_qty } }

        this.init();
    }

    // =========================================
    // Helpers
    // =========================================

    $(id) { return document.getElementById(id); }

    esc(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async init() {
        // Cache filter elements
        this.searchInput = this.$('equipment-search');
        this.dateFilter = this.$('equipment-date-filter');
        this.statusFilter = this.$('equipment-status-filter');
        this.sortSelect = this.$('equipment-sort');
        this.clearBtn = this.$('equipment-clear-filters-btn');
        this.activeFiltersEl = this.$('equipment-active-filters');
        this.resultsCountEl = this.$('equipment-results-count');

        this.bindEvents();
        await this.loadStatusOptions();
        await this.loadEquipment();
        this.loadDashboardStats();
    }

    // =========================================
    // Event Binding
    // =========================================

    bindEvents() {
        // Add equipment button
        const addBtn = this.$('add-equipment-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        // View toggle buttons
        document.querySelectorAll('.equipment-page .view-tab[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) this.switchView(view);
            });
        });

        // Calendar navigation
        this.$('eq-cal-prev')?.addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
            this.renderCalendar();
        });
        this.$('eq-cal-next')?.addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
            this.renderCalendar();
        });
        this.$('eq-cal-today')?.addEventListener('click', () => {
            this.calendarDate = new Date();
            this.renderCalendar();
        });

        // Dropdown filters → instant apply
        const instant = () => { this.currentPage = 1; this.applyFiltersAndRender(); };
        this.dateFilter?.addEventListener('change', instant);
        this.statusFilter?.addEventListener('change', instant);
        this.sortSelect?.addEventListener('change', instant);

        // Search → debounced 300ms
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => { this.currentPage = 1; this.applyFiltersAndRender(); }, 300);
            });
        }

        // Clear all
        this.clearBtn?.addEventListener('click', () => this.clearFilters());

        // Active filter tag removal (delegated)
        this.activeFiltersEl?.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-tag-remove');
            if (!btn) return;
            this.clearSingleFilter(btn.dataset.clear);
        });
    }

    // =========================================
    // Data Loading
    // =========================================

    async loadStatusOptions() {
        try {
            const response = await fetch('/api/equipment/status', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to load equipment status options');
            this.statusOptions = await response.json();
        } catch (error) {
            console.error('EquipmentManager: Error loading status options:', error);
        }
    }

    async loadEquipment() {
        const tbody = this.$('equipment-table-body');

        try {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading equipment...</td></tr>';
            }

            const response = await fetch('/api/equipment', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            this.allEquipment = Array.isArray(data) ? data : [];
            this.applyFiltersAndRender();

        } catch (error) {
            console.error('EquipmentManager: Error loading equipment:', error);
            this.showToast('Failed to load equipment: ' + error.message, 'error');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Failed to load equipment. Please try again.</td></tr>';
            }
        }
    }

    // =========================================
    // Filtering & Sorting
    // =========================================

    applyFiltersAndRender() {
        const dateVal = (this.dateFilter?.value || '').trim();
        const statusVal = (this.statusFilter?.value || '').trim();
        const searchVal = (this.searchInput?.value || '').trim().toLowerCase();
        const sortVal = this.sortSelect?.value || 'name-asc';

        // If date is selected, fetch date-specific availability
        if (dateVal && dateVal !== this._lastDateFetch) {
            this._lastDateFetch = dateVal;
            this._fetchDateAvailability(dateVal);
            return; // will re-call applyFiltersAndRender after fetch
        }

        // Use date-specific data if available
        const sourceData = (dateVal && this._dateAvailability)
            ? this._dateAvailability
            : this.allEquipment;

        // Filter
        this.filteredEquipment = sourceData.filter(item => {
            if (statusVal && (item.status_name || '') !== statusVal) return false;
            if (searchVal && !(item.equipment_name || '').toLowerCase().includes(searchVal)) return false;
            return true;
        });

        // Sort
        this.filteredEquipment.sort((a, b) => {
            switch (sortVal) {
                case 'name-asc': return (a.equipment_name || '').localeCompare(b.equipment_name || '');
                case 'name-desc': return (b.equipment_name || '').localeCompare(a.equipment_name || '');
                case 'qty-desc': return (b.total_qty || 0) - (a.total_qty || 0);
                case 'qty-asc': return (a.total_qty || 0) - (b.total_qty || 0);
                case 'available-desc': return (b.available_on_date ?? b.available_qty ?? 0) - (a.available_on_date ?? a.available_qty ?? 0);
                case 'status-asc': return (a.status_name || '').localeCompare(b.status_name || '');
                default: return 0;
            }
        });

        this.updateStats();
        this.updateResultsCount();
        this.renderActiveFilters();
        this.renderTable();
        this.renderPagination();
    }

    async _fetchDateAvailability(dateStr) {
        try {
            const response = await fetch(`/api/equipment/availability?date=${dateStr}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this._dateAvailability = await response.json();
        } catch (err) {
            console.error('EquipmentManager: Error fetching date availability:', err);
            this._dateAvailability = null;
        }
        this.applyFiltersAndRender();
    }

    clearFilters() {
        if (this.dateFilter) { this.dateFilter.value = ''; this._lastDateFetch = ''; this._dateAvailability = null; }
        if (this.statusFilter) this.statusFilter.value = '';
        if (this.sortSelect) this.sortSelect.value = 'name-asc';
        if (this.searchInput) this.searchInput.value = '';
        this.currentPage = 1;
        this.applyFiltersAndRender();
    }

    clearSingleFilter(target) {
        switch (target) {
            case 'date':   if (this.dateFilter) { this.dateFilter.value = ''; this._lastDateFetch = ''; this._dateAvailability = null; } break;
            case 'status': if (this.statusFilter) this.statusFilter.value = ''; break;
            case 'search': if (this.searchInput) this.searchInput.value = ''; break;
            case 'sort':   if (this.sortSelect) this.sortSelect.value = 'name-asc'; break;
        }
        this.currentPage = 1;
        this.applyFiltersAndRender();
    }

    // =========================================
    // Results Count
    // =========================================

    updateResultsCount() {
        if (!this.resultsCountEl) return;
        const total = this.allEquipment.length;
        const shown = this.filteredEquipment.length;
        this.resultsCountEl.textContent = shown === total
            ? `${total} item${total !== 1 ? 's' : ''}`
            : `${shown} of ${total} item${total !== 1 ? 's' : ''}`;
    }

    // =========================================
    // Active Filter Tags
    // =========================================

    renderActiveFilters() {
        if (!this.activeFiltersEl) return;
        const tags = [];
        const x = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        const dateVal = this.dateFilter?.value || '';
        if (dateVal) {
            const dateLabel = window.SmartLab?.Core?.Utils?.formatDate ? SmartLab.Core.Utils.formatDate(dateVal + 'T00:00:00') : dateVal;
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Date:</span> ${this.esc(dateLabel)} <button class="filter-tag-remove" data-clear="date">${x}</button></span>`);
        }
        const statusVal = this.statusFilter?.value || '';
        if (statusVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Status:</span> ${this.esc(statusVal)} <button class="filter-tag-remove" data-clear="status">${x}</button></span>`);
        }
        const searchVal = (this.searchInput?.value || '').trim();
        if (searchVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Search:</span> "${this.esc(searchVal)}" <button class="filter-tag-remove" data-clear="search">${x}</button></span>`);
        }
        const sortVal = this.sortSelect?.value || 'name-asc';
        if (sortVal !== 'name-asc') {
            const sortLabels = {
                'name-desc': 'Name Z-A',
                'qty-desc': 'Total Qty High-Low',
                'qty-asc': 'Total Qty Low-High',
                'available-desc': 'Available High-Low',
                'status-asc': 'Status A-Z'
            };
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Sort:</span> ${sortLabels[sortVal] || sortVal} <button class="filter-tag-remove" data-clear="sort">${x}</button></span>`);
        }
        this.activeFiltersEl.innerHTML = tags.join('');
    }

    // =========================================
    // Stats Dashboard
    // =========================================

    updateStats() {
        // Quick client-side inventory totals (always up to date with filtered data)
        let totalQty = 0, availableQty = 0, borrowedQty = 0, damagedQty = 0;
        this.allEquipment.forEach(item => {
            totalQty += item.total_qty || 0;
            availableQty += item.available_qty || 0;
            borrowedQty += item.borrowed_qty || 0;
            damagedQty += item.damaged_qty || 0;
        });

        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('stat-total-equipment', totalQty);
        setEl('stat-available-equipment', availableQty);
        setEl('stat-borrowed-equipment', borrowedQty);
        setEl('stat-damaged-equipment', damagedQty);
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/equipment/stats', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this._renderDashboardStats(data);
        } catch (err) {
            console.error('EquipmentManager: Error loading dashboard stats:', err);
        }
    }

    _renderDashboardStats(data) {
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const inv = data.inventory || {};

        // Row 1: inventory (also update from server data)
        setEl('stat-total-equipment', inv.total_qty || 0);
        setEl('stat-unique-items', `${inv.unique_items || 0} items`);
        setEl('stat-available-equipment', inv.available_qty || 0);
        setEl('stat-borrowed-equipment', inv.borrowed_qty || 0);
        setEl('stat-damaged-equipment', inv.damaged_qty || 0);

        // Row 2: usage & request metrics
        setEl('stat-utilization-rate', `${inv.utilization_rate || 0}%`);

        const today = data.today || {};
        setEl('stat-today-reserved', today.qty_reserved || 0);
        setEl('stat-today-items', `${today.items_reserved || 0} items`);

        setEl('stat-pending-requests', data.pending_requests || 0);

        const upcoming = data.upcoming || {};
        setEl('stat-upcoming-requests', upcoming.requests || 0);
        setEl('stat-upcoming-qty', `${upcoming.qty || 0} qty`);

        setEl('stat-low-stock', inv.low_stock_count || 0);

        const overdue = data.overdue || {};
        setEl('stat-overdue-count', overdue.requests || 0);
        setEl('stat-overdue-qty', `${overdue.qty || 0} qty`);

        // Highlight overdue card if > 0
        const overdueCard = this.$('stat-overdue-card');
        if (overdueCard) {
            overdueCard.classList.toggle('alert', (overdue.requests || 0) > 0);
        }

        // Highlight low stock card if > 0
        const lowStockCard = this.$('stat-low-stock-card');
        if (lowStockCard) {
            lowStockCard.classList.toggle('alert', (inv.low_stock_count || 0) > 0);
        }

        // Row 3: most reserved
        const list = document.getElementById('most-reserved-list');
        if (list && data.most_reserved) {
            if (data.most_reserved.length === 0) {
                list.innerHTML = '<span style="color:#9ca3af;font-size:0.8rem;">No reservation data yet</span>';
            } else {
                list.innerHTML = data.most_reserved.map((item, i) => `
                    <div class="most-reserved-item">
                        <span class="rank">#${i + 1}</span>
                        <span class="name">${this.esc(item.equipment_name)}</span>
                        <span class="count">${item.total_reserved} reserved</span>
                    </div>
                `).join('');
            }
        }
    }

    // =========================================
    // Table Rendering
    // =========================================

    renderTable() {
        const tbody = document.getElementById('equipment-table-body');
        const thead = document.querySelector('#equipment-table thead tr');
        if (!tbody) return;

        const hasDate = !!(this.dateFilter?.value);

        // Update table headers based on date filter
        if (thead) {
            thead.innerHTML = hasDate
                ? '<th>Name</th><th>Total Qty</th><th>Available</th><th>Reserved</th><th>Pending</th><th>Avail. on Date</th><th>Status</th><th>Actions</th>'
                : '<th>Name</th><th>Total Qty</th><th>Available</th><th>Borrowed</th><th>Damaged</th><th>Status</th><th>Actions</th>';
        }

        const cols = hasDate ? 8 : 7;
        if (this.filteredEquipment.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center; color:#6b7280;">No equipment found</td></tr>`;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredEquipment.slice(startIndex, endIndex);

        tbody.innerHTML = pageItems.map(item => this.createEquipmentRow(item, hasDate)).join('');
        this.bindActionButtons();
    }

    createEquipmentRow(item, hasDate = false) {
        const esc = (text) => {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        };

        const statusClass = (item.status_name || '').toLowerCase();
        const statusBadge = `<span class="status-badge ${statusClass}">${esc(item.status_name)}</span>`;

        const dateCols = hasDate
            ? `<td>${item.available_qty}</td>
               <td>${item.reserved_qty ?? 0}</td>
               <td>${item.pending_qty ?? 0}</td>
               <td style="font-weight:600;color:${(item.available_on_date ?? item.available_qty) > 0 ? '#059669' : '#dc2626'}">${item.available_on_date ?? item.available_qty}</td>`
            : `<td>${item.available_qty}</td>
               <td>${item.borrowed_qty}</td>
               <td>${item.damaged_qty}</td>`;

        return `
            <tr data-equipment-id="${item.equipment_id}">
                <td>${esc(item.equipment_name)}</td>
                <td>${item.total_qty}</td>
                ${dateCols}
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit" data-action="edit" data-id="${item.equipment_id}" title="Edit Equipment">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" data-action="delete" data-id="${item.equipment_id}" title="Delete Equipment">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    bindActionButtons() {
        // Edit buttons
        document.querySelectorAll('[data-action="edit"][data-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.showEditModal(id);
            });
        });

        // Delete buttons
        document.querySelectorAll('[data-action="delete"][data-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.handleDelete(id);
            });
        });
    }

    // =========================================
    // Pagination
    // =========================================

    renderPagination() {
        const container = document.getElementById('equipment-pagination');
        if (!container) return;

        const total = this.filteredEquipment.length;
        const totalPages = Math.ceil(total / this.itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const start = ((this.currentPage - 1) * this.itemsPerPage) + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, total);

        const info = `<div class="pagination-info">Showing ${start} to ${end} of ${total} equipment</div>`;
        const controls = this.createPaginationControls(totalPages);

        container.innerHTML = info + controls;
        this.bindPaginationEvents();
    }

    createPaginationControls(totalPages) {
        let html = '<div class="pagination-controls">';

        html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
        </button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                html += '<span class="pagination-btn" disabled>...</span>';
            }
        }

        html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"></polyline>
            </svg>
        </button>`;

        html += '</div>';
        return html;
    }

    bindPaginationEvents() {
        document.querySelectorAll('#equipment-pagination .pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderTable();
                    this.renderPagination();
                }
            });
        });
    }

    // =========================================
    // Modal Operations - Add
    // =========================================

    showAddModal() {
        if (window.modalManager) {
            window.modalManager.show('add-equipment', {
                onSuccess: () => this.loadEquipment()
            });
        } else {
            console.error('EquipmentManager: ModalManager not available');
            this.showToast('Modal system not available', 'error');
        }
    }

    // =========================================
    // Modal Operations - Edit
    // =========================================

    async showEditModal(equipmentId) {
        try {
            const response = await fetch(`/api/equipment/${equipmentId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to load equipment details');
            const equipment = await response.json();

            if (window.modalManager) {
                window.modalManager.show('edit-equipment', {
                    equipment: equipment,
                    onSuccess: () => this.loadEquipment()
                });
            } else {
                console.error('EquipmentManager: ModalManager not available');
                this.showToast('Modal system not available', 'error');
            }
        } catch (error) {
            console.error('EquipmentManager: Error loading equipment for edit:', error);
            this.showToast('Failed to load equipment details', 'error');
        }
    }

    // =========================================
    // Delete Operation
    // =========================================

    async handleDelete(equipmentId) {
        try {
            // Load equipment details first
            const response = await fetch(`/api/equipment/${equipmentId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to load equipment details');
            const equipment = await response.json();

            const borrowedQty = equipment.borrowed_qty || 0;
            const damagedQty = equipment.damaged_qty || 0;

            // Prevent deletion if items are borrowed or damaged
            if (borrowedQty > 0 || damagedQty > 0) {
                let message = 'Cannot delete this equipment because ';
                const reasons = [];
                if (borrowedQty > 0) {
                    reasons.push(`${borrowedQty} item${borrowedQty > 1 ? 's are' : ' is'} currently borrowed`);
                }
                if (damagedQty > 0) {
                    reasons.push(`${damagedQty} item${damagedQty > 1 ? 's are' : ' is'} currently damaged`);
                }
                message += reasons.join(' and ') + '.';
                this.showToast(message, 'warning');
                return;
            }

            // Show confirmation via ModalManager
            if (window.modalManager) {
                window.modalManager.show('confirm', {
                    title: 'Delete Equipment',
                    message: `Are you sure you want to delete "${equipment.equipment_name}"? This action cannot be undone.`,
                    type: 'danger',
                    confirmText: 'Delete',
                    onConfirm: async () => {
                        await this.executeDelete(equipmentId, equipment.equipment_name);
                    }
                });
            } else {
                // Fallback to styled confirm
                const confirmed = await SmartLab.Core.UI.confirm(`Are you sure you want to delete "${equipment.equipment_name}"? This action cannot be undone.`, 'Delete Equipment', { type: 'danger', confirmText: 'Delete' });
                if (confirmed) {
                    await this.executeDelete(equipmentId, equipment.equipment_name);
                }
            }

        } catch (error) {
            console.error('EquipmentManager: Error deleting equipment:', error);
            this.showToast('Failed to delete equipment: ' + error.message, 'error');
        }
    }

    async executeDelete(equipmentId, equipmentName) {
        try {
            const response = await fetch(`/api/equipment/${equipmentId}`, {
                method: 'DELETE',
                headers: SmartLab.Core.Auth.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to delete equipment');

            this.showToast(`"${equipmentName}" deleted successfully`, 'success');
            await this.loadEquipment();
        } catch (error) {
            console.error('EquipmentManager: Delete failed:', error);
            this.showToast('Failed to delete equipment: ' + error.message, 'error');
        }
    }

    // =========================================
    // View Switching
    // =========================================

    switchView(view) {
        if (view === this.currentView) return;
        this.currentView = view;

        // Toggle active tab
        document.querySelectorAll('.equipment-page .view-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        const tableView = this.$('equipment-table-view');
        const calView = this.$('equipment-calendar-view');

        if (view === 'calendar') {
            tableView?.classList.add('hidden');
            calView?.classList.remove('hidden');
            this.renderCalendar();
        } else {
            tableView?.classList.remove('hidden');
            calView?.classList.add('hidden');
        }
    }

    // =========================================
    // Calendar View
    // =========================================

    async renderCalendar() {
        const grid = this.$('eq-cal-grid');
        const label = this.$('eq-cal-month-label');
        if (!grid) return;

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();

        if (label) {
            label.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
        }

        // Load monthly data
        await this._loadMonthlyData(year, month + 1);

        const today = new Date();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        let cells = [];

        // Previous month trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            cells.push(`<div class="cal-day-cell outside"><div class="cal-day-number">${prevMonthDays - i}</div></div>`);
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            const info = this.monthlyData[dateKey];

            let usageHTML = '';
            if (info) {
                if (info.reserved_qty > 0) {
                    usageHTML += `<div class="cal-usage-pill reserved">${info.reserved_items} item${info.reserved_items > 1 ? 's' : ''} · ${info.reserved_qty} reserved</div>`;
                }
                if (info.pending_qty > 0) {
                    usageHTML += `<div class="cal-usage-pill pending">${info.pending_items} item${info.pending_items > 1 ? 's' : ''} · ${info.pending_qty} pending</div>`;
                }
            }

            const cls = ['cal-day-cell'];
            if (isToday) cls.push('today');

            cells.push(`
                <div class="${cls.join(' ')}" data-date="${dateKey}">
                    <div class="cal-day-number">${d}</div>
                    <div class="cal-usage-dots">${usageHTML}</div>
                </div>
            `);
        }

        // Next month leading days
        const remainder = cells.length % 7;
        if (remainder > 0) {
            for (let i = 1; i <= 7 - remainder; i++) {
                cells.push(`<div class="cal-day-cell outside"><div class="cal-day-number">${i}</div></div>`);
            }
        }

        grid.innerHTML = cells.join('');

        // Bind click on day cells
        grid.onclick = (e) => {
            const cell = e.target.closest('.cal-day-cell:not(.outside)');
            if (!cell) return;
            const dateStr = cell.dataset.date;
            if (dateStr) this._showDayDetail(dateStr);
        };
    }

    async _loadMonthlyData(year, month) {
        try {
            const response = await fetch(`/api/equipment/availability/month?year=${year}&month=${month}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            // Index by date
            this.monthlyData = {};
            data.forEach(row => {
                this.monthlyData[row.date] = row;
            });
        } catch (err) {
            console.error('EquipmentManager: Error loading monthly data:', err);
            this.monthlyData = {};
        }
    }

    async _showDayDetail(dateStr) {
        // Fetch detailed equipment availability for this date
        try {
            const response = await fetch(`/api/equipment/availability?date=${dateStr}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const items = await response.json();

            const dateLabel = window.SmartLab?.Core?.Utils?.formatDate ? SmartLab.Core.Utils.formatDate(dateStr + 'T00:00:00') : dateStr;

            // Build rows - only show items that have reservations or pending on this date
            const activeItems = items.filter(i => (i.reserved_qty || 0) > 0 || (i.pending_qty || 0) > 0);

            let tableHTML = '';
            if (activeItems.length === 0) {
                tableHTML = '<div class="eq-no-usage">No equipment reserved or pending for this date.</div>';
            } else {
                tableHTML = `
                    <table class="eq-detail-table">
                        <thead>
                            <tr>
                                <th>Equipment</th>
                                <th>Total</th>
                                <th>Reserved</th>
                                <th>Pending</th>
                                <th>Avail.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeItems.map(i => `
                                <tr>
                                    <td style="font-weight:500;">${this.esc(i.equipment_name)}</td>
                                    <td>${i.total_qty}</td>
                                    <td style="color:#1e40af;font-weight:500;">${i.reserved_qty || 0}</td>
                                    <td style="color:#92400e;font-weight:500;">${i.pending_qty || 0}</td>
                                    <td style="font-weight:600;color:${(i.available_on_date ?? 0) > 0 ? '#059669' : '#dc2626'}">${i.available_on_date ?? i.available_qty}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            // Summary line
            const toNumber = (value) => {
                if (value === null || value === undefined) return 0;
                const num = Number(value);
                return Number.isFinite(num) ? num : 0;
            };
            const totalReserved = items.reduce((sum, item) => sum + toNumber(item.reserved_qty), 0);
            const totalPending = items.reduce((sum, item) => sum + toNumber(item.pending_qty), 0);
            const summaryHTML = totalReserved || totalPending
                ? `<div class="eq-summary-pills">
                       <span class="eq-summary-pill reserved">${totalReserved} reserved</span>
                       <span class="eq-summary-pill pending">${totalPending} pending</span>
                   </div>`
                : '';

            // Create overlay (inside equipment-page so scoped CSS applies)
            const page = document.querySelector('.equipment-page');
            const overlay = document.createElement('div');
            overlay.className = 'cal-day-modal-overlay';
            overlay.innerHTML = `
                <div class="cal-day-modal">
                    <div class="cal-day-modal-header">
                        <h4>Equipment Usage - ${dateLabel}</h4>
                        <button class="cal-day-modal-close">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div class="cal-day-modal-body">
                        ${summaryHTML}
                        ${tableHTML}
                    </div>
                </div>
            `;

            (page || document.body).appendChild(overlay);

            // Close handlers
            const close = () => overlay.remove();
            overlay.querySelector('.cal-day-modal-close').addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

        } catch (err) {
            console.error('EquipmentManager: Error loading day detail:', err);
            this.showToast('Failed to load equipment details for this date', 'error');
        }
    }

    // =========================================
    // Utility
    // =========================================

    showToast(message, type = 'info') {
        if (window.SmartLab?.Core?.UI?.showToast) {
            window.SmartLab.Core.UI.showToast(message, type);
        } else if (window.modalManager?.showToast) {
            window.modalManager.showToast(message, type);
        } else {
        }
    }
}
