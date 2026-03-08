/* =========================================
   SmartLab Admin - Users Page Management
   Integrates with existing API for full CRUD operations
========================================= */

class UsersPageManager {
    constructor() {
        this.currentPage = 1;
        this.usersPerPage = 10;
        this.allUsers = [];
        this.filteredUsers = [];
        this._searchTimer = null;
        this.init();
    }

    // ── Helpers ──────────────────────────────────────────
    $(id) { return document.getElementById(id); }

    esc(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Initialization ──────────────────────────────────
    init() {
        this.tbody = this.$('users-table-body');
        this.roleFilter = this.$('user-role-filter');
        this.statusFilter = this.$('user-status-filter');
        this.sortSelect = this.$('user-sort');
        this.searchInput = this.$('user-search');
        this.clearBtn = this.$('users-clear-filters-btn');
        this.activeFiltersEl = this.$('users-active-filters');
        this.resultsCountEl = this.$('users-results-count');

        if (!this.tbody) {
            console.error('UsersPageManager: users-table-body not found');
            return;
        }

        this.bindEvents();
        this.loadUsers();
        this.loadRoles();
        this.loadStatuses();
    }

    // ── Event Binding ───────────────────────────────────
    bindEvents() {
        // Add user button
        this.$('add-user-btn')?.addEventListener('click', () => this.showUserModal());

        // Dropdown filters → instant apply
        const instant = () => { this.currentPage = 1; this.applyFilters(); };
        [this.roleFilter, this.statusFilter, this.sortSelect]
            .forEach(el => el?.addEventListener('change', instant));

        // Search → debounced 300ms
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => { this.currentPage = 1; this.applyFilters(); }, 300);
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

        // Stat card clicks
        document.querySelectorAll('.users-page .stat-clickable[data-role-filter]').forEach(card => {
            card.addEventListener('click', () => {
                const val = card.dataset.roleFilter;
                if (this.roleFilter) this.roleFilter.value = val ? val.toLowerCase() : '';
                this.currentPage = 1;
                this.applyFilters();
            });
        });

        // Table action buttons (delegated)
        this.tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            e.stopPropagation();
            const action = btn.dataset.action;
            const userId = btn.dataset.userId;
            if (!userId) return;
            switch (action) {
                case 'edit': this.editUser(userId); break;
                case 'delete': this.deleteUser(userId); break;
                case 'activate': this.toggleUserStatus(userId, 'activate'); break;
                case 'deactivate': this.toggleUserStatus(userId, 'deactivate'); break;
            }
        });
    }

    // ── Data Loading ────────────────────────────────────
    async loadUsers() {
        try {
            this.tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#9ca3af;">Loading users...</td></tr>';

            const response = await fetch('/api/users', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            this.allUsers = await response.json();
            this.applyFilters();
        } catch (error) {
            console.error('UsersPageManager: Error loading users:', error);
            this.showToast('Failed to load users: ' + error.message, 'error');
            this.tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#ef4444;">Error loading users</td></tr>`;
        }
    }

    // ── Filtering & Sorting ─────────────────────────────
    applyFilters() {
        const roleVal = (this.roleFilter?.value || '').toLowerCase();
        const statusVal = (this.statusFilter?.value || '').toLowerCase();
        const searchVal = (this.searchInput?.value || '').trim().toLowerCase();
        const sortVal = this.sortSelect?.value || 'id-desc';

        // Filter
        this.filteredUsers = this.allUsers.filter(u => {
            // Role
            if (roleVal && (u.role_name || '').toLowerCase() !== roleVal) return false;
            // Status
            if (statusVal && (u.status_name || '').toLowerCase() !== statusVal) return false;
            // Search (name, email, department, program)
            if (searchVal) {
                const haystack = [
                    u.full_name,
                    u.gmail,
                    u.department_name,
                    u.department_code,
                    u.program_name,
                    u.program_code,
                    u.program,
                    u.year_level
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(searchVal)) return false;
            }
            return true;
        });

        // Sort
        this.filteredUsers.sort((a, b) => {
            switch (sortVal) {
                case 'id-asc':   return (a.user_id || 0) - (b.user_id || 0);
                case 'id-desc':  return (b.user_id || 0) - (a.user_id || 0);
                case 'name-asc': return (a.full_name || '').localeCompare(b.full_name || '');
                case 'name-desc':return (b.full_name || '').localeCompare(a.full_name || '');
                case 'email-asc':return (a.gmail || '').localeCompare(b.gmail || '');
                default: return 0;
            }
        });

        this.updateStats();
        this.renderTable();
        this.renderPagination();
        this.updateResultsCount();
        this.renderActiveFilters();
    }

    clearFilters() {
        if (this.roleFilter) this.roleFilter.value = '';
        if (this.statusFilter) this.statusFilter.value = '';
        if (this.sortSelect) this.sortSelect.value = 'id-desc';
        if (this.searchInput) this.searchInput.value = '';
        this.currentPage = 1;
        this.applyFilters();
    }

    clearSingleFilter(target) {
        switch (target) {
            case 'role':   if (this.roleFilter) this.roleFilter.value = ''; break;
            case 'status': if (this.statusFilter) this.statusFilter.value = ''; break;
            case 'search': if (this.searchInput) this.searchInput.value = ''; break;
            case 'sort':   if (this.sortSelect) this.sortSelect.value = 'id-desc'; break;
        }
        this.currentPage = 1;
        this.applyFilters();
    }

    // ── Stats ───────────────────────────────────────────
    updateStats() {
        const counts = { total: this.allUsers.length, Admin: 0, Faculty: 0, Student: 0 };
        this.allUsers.forEach(u => {
            if (counts[u.role_name] !== undefined) counts[u.role_name]++;
        });
        const set = (id, v) => { const el = this.$(id); if (el) el.textContent = v; };
        set('total-users-count', counts.total);
        set('admin-count', counts.Admin);
        set('faculty-count', counts.Faculty);
        set('student-count', counts.Student);
    }

    // ── Results Count ───────────────────────────────────
    updateResultsCount() {
        if (!this.resultsCountEl) return;
        const total = this.allUsers.length;
        const shown = this.filteredUsers.length;
        this.resultsCountEl.textContent = shown === total
            ? `${total} user${total !== 1 ? 's' : ''}`
            : `${shown} of ${total} user${total !== 1 ? 's' : ''}`;
    }

    // ── Active Filter Tags ──────────────────────────────
    renderActiveFilters() {
        if (!this.activeFiltersEl) return;
        const tags = [];
        const x = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        const roleVal = this.roleFilter?.value || '';
        if (roleVal) {
            const label = this.roleFilter.options[this.roleFilter.selectedIndex]?.text || roleVal;
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Role:</span> ${this.esc(label)} <button class="filter-tag-remove" data-clear="role">${x}</button></span>`);
        }
        const statusVal = this.statusFilter?.value || '';
        if (statusVal) {
            const label = this.statusFilter.options[this.statusFilter.selectedIndex]?.text || statusVal;
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Status:</span> ${this.esc(label)} <button class="filter-tag-remove" data-clear="status">${x}</button></span>`);
        }
        const searchVal = (this.searchInput?.value || '').trim();
        if (searchVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Search:</span> "${this.esc(searchVal)}" <button class="filter-tag-remove" data-clear="search">${x}</button></span>`);
        }
        const sortVal = this.sortSelect?.value || 'id-desc';
        if (sortVal !== 'id-desc') {
            const sortLabels = { 'id-asc': 'Oldest First', 'name-asc': 'Name A-Z', 'name-desc': 'Name Z-A', 'email-asc': 'Email A-Z' };
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Sort:</span> ${sortLabels[sortVal] || sortVal} <button class="filter-tag-remove" data-clear="sort">${x}</button></span>`);
        }

        this.activeFiltersEl.innerHTML = tags.join('');
    }

    // ── Table Rendering ─────────────────────────────────
    renderTable() {
        if (this.filteredUsers.length === 0) {
            this.tbody.innerHTML = '<tr class="no-data-row"><td colspan="7">No users found</td></tr>';
            return;
        }

        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const page = this.filteredUsers.slice(startIndex, endIndex);

        this.tbody.innerHTML = page.map(u => this.createUserRow(u)).join('');
    }

    createUserRow(user) {
        const roleCss = (user.role_name || '').toLowerCase();
        const statusCss = (user.status_name || '').toLowerCase();
        const lastActive = user.last_login_at
            ? new Date(user.last_login_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
            : 'Never';

        const roleName = (user.role_name || '').toLowerCase();

        let affiliation = '—';
        if (roleName === 'faculty') {
            affiliation = user.department_name || user.department || '—';
        } else if (roleName === 'student') {
            const programLabel = user.program_code || user.program_name || user.program;
            const yearLabel = user.year_level ? String(user.year_level) : '';
            if (programLabel && yearLabel) {
                affiliation = `${programLabel} - ${yearLabel}`;
            } else if (programLabel) {
                affiliation = programLabel;
            } else if (yearLabel) {
                affiliation = `Year ${yearLabel}`;
            }
        }

        const toggleBtn = statusCss === 'active'
            ? `<button class="btn-icon" data-action="deactivate" data-user-id="${user.user_id}" title="Deactivate" style="color:#f59e0b;">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
               </button>`
            : `<button class="btn-icon" data-action="activate" data-user-id="${user.user_id}" title="Activate" style="color:#10b981;">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="20,6 9,17 4,12"/></svg>
               </button>`;

        return `
            <tr data-user-id="${user.user_id}">
                <td>${user.user_id}</td>
                <td>${this.esc(user.full_name || '—')}</td>
                <td>${this.esc(user.gmail)}</td>
                <td><span class="role-badge ${roleCss}">${this.esc(user.role_name)}</span></td>
                <td>${this.esc(affiliation)}</td>
                <td><span class="status-badge ${statusCss}">${this.esc(user.status_name)}</span></td>
                <td>${lastActive}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit" data-action="edit" data-user-id="${user.user_id}" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" data-action="delete" data-user-id="${user.user_id}" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                            </svg>
                        </button>
                        ${toggleBtn}
                    </div>
                </td>
            </tr>`;
    }

    // ── Pagination ──────────────────────────────────────
    renderPagination() {
        const container = this.$('users-pagination');
        if (!container) return;

        const total = this.filteredUsers.length;
        const totalPages = Math.ceil(total / this.usersPerPage);

        if (totalPages <= 1) { container.innerHTML = ''; return; }

        const start = ((this.currentPage - 1) * this.usersPerPage) + 1;
        const end = Math.min(this.currentPage * this.usersPerPage, total);

        let pages = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                pages += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                pages += '<span class="pagination-btn" disabled>...</span>';
            }
        }

        container.innerHTML = `
            <div class="pagination-info">Showing ${start} to ${end} of ${total} users</div>
            <div class="pagination-controls">
                <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                </button>
                ${pages}
                <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
                </button>
            </div>`;

        container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
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

    // ── Dynamic Filter Options ──────────────────────────
    async loadRoles() {
        try {
            const response = await fetch('/api/users-role', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to load roles');
            const roles = await response.json();

            if (this.roleFilter) {
                this.roleFilter.innerHTML = '<option value="">All Roles</option>';
                roles.forEach(role => {
                    this.roleFilter.innerHTML += `<option value="${role.role_name.toLowerCase()}">${role.role_name}</option>`;
                });
            }
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    }

    async loadStatuses() {
        try {
            const response = await fetch('/api/users-status', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to load statuses');
            const statuses = await response.json();

            if (this.statusFilter) {
                this.statusFilter.innerHTML = '<option value="">All Status</option>';
                statuses.forEach(status => {
                    this.statusFilter.innerHTML += `<option value="${status.status_name.toLowerCase()}">${status.status_name}</option>`;
                });
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    }

    // ── CRUD Actions ────────────────────────────────────
    showUserModal(userId = null) {
        if (userId) {
            ModalManager.show('edit-user', { userId, onSuccess: () => this.loadUsers() });
        } else {
            ModalManager.show('add-user', { onSuccess: () => this.loadUsers() });
        }
    }

    editUser(userId) { this.showUserModal(userId); }

    async deleteUser(userId) {
        ModalManager.show('confirm', {
            title: 'Delete User',
            message: 'Are you sure you want to delete this user? This action cannot be undone.',
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE', headers: SmartLab.Core.Auth.getAuthHeaders() });
                    if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed to delete user'); }
                    this.showToast('User deleted successfully', 'success');
                    this.loadUsers();
                } catch (error) {
                    this.showToast(error.message || 'Failed to delete user', 'error');
                }
            }
        });
    }

    async toggleUserStatus(userId, action) {
        const msg = action === 'activate'
            ? 'Are you sure you want to activate this user?'
            : 'Are you sure you want to deactivate this user?';

        ModalManager.show('confirm', {
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
            message: msg,
            type: action === 'activate' ? 'success' : 'warning',
            confirmText: action === 'activate' ? 'Activate' : 'Deactivate',
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/users/${userId}/${action}`, { method: 'PUT', headers: SmartLab.Core.Auth.getAuthHeaders() });
                    if (!res.ok) { const err = await res.json(); throw new Error(err.message || `Failed to ${action} user`); }
                    this.showToast(`User ${action}d successfully`, 'success');
                    this.loadUsers();
                } catch (error) {
                    this.showToast(error.message || `Failed to ${action} user`, 'error');
                }
            }
        });
    }

    showToast(message, type = 'info') {
        if (window.SmartLab?.Core?.UI?.showToast) {
            window.SmartLab.Core.UI.showToast(message, type);
        }
    }
}

// Initialize when DOM is ready OR when called manually in SPA context
const initializeUsersPage = () => {
    new UsersPageManager();
};

// Auto-initialize only if DOM is still loading (not in SPA context)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUsersPage);
} else if (!window.AdminApp) {
    initializeUsersPage();
}

// Export for manual initialization in SPA context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeUsersPage, UsersPageManager };
}

// Add toast styles (only once)
if (!document.getElementById('users-toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'users-toast-styles';
    styleSheet.textContent = `
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 300px;
}
.toast.show { opacity: 1; transform: translateX(0); }
.toast-success { background: #10b981; }
.toast-error { background: #ef4444; }
.toast-info { background: #3b82f6; }
.toast-warning { background: #f59e0b; }
`;
    document.head.appendChild(styleSheet);
}
