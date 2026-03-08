/* =========================================
   SmartLab – Admin: Request Management System
   RequestsManager class for SPA compatibility
   Status IDs: 1=Pending, 2=Approved, 3=Declined, 4=Cancelled, 5=Returned, 6=Borrowed
   ========================================= */

class RequestsManager {
  constructor() {
    this.allRequests = [];
    this.filteredRequests = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.STATUS = { PENDING: 1, APPROVED: 2, DECLINED: 3, CANCELLED: 4, RETURNED: 5, BORROWED: 6 };
    this.STATUS_TEXT = { 1: 'Pending', 2: 'Approved', 3: 'Declined', 4: 'Cancelled', 5: 'Returned', 6: 'Borrowed' };
    this.STATUS_CSS = { 1: 'pending', 2: 'approved', 3: 'declined', 4: 'cancelled', 5: 'returned', 6: 'borrowed' };
    this.selectedRequest = null;
    this.requestDetailsCache = new Map();
    this.equipmentLookup = new Map();
    this._conflictStylesInjected = false;
    this.init();
  }

  renderPagination() {
    if (!this.paginationContainer) return;

    const total = this.filteredRequests.length;
    const totalPages = Math.ceil(total / this.itemsPerPage) || 0;

    if (totalPages <= 1) {
      this.paginationContainer.innerHTML = '';
      return;
    }

    const start = ((this.currentPage - 1) * this.itemsPerPage) + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, total);

    const info = `<div class="pagination-info">Showing ${start} to ${end} of ${total} requests</div>`;
    const controls = this.createPaginationControls(totalPages);

    this.paginationContainer.innerHTML = info + controls;
    this.bindPaginationEvents();
  }

  createPaginationControls(totalPages) {
    let html = '<div class="pagination-controls">';
    const prevDisabled = this.currentPage === 1 ? 'disabled' : '';
    const nextDisabled = this.currentPage === totalPages ? 'disabled' : '';

    html += `<button class="pagination-btn" ${prevDisabled} data-page="${this.currentPage - 1}">
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

    html += `<button class="pagination-btn" ${nextDisabled} data-page="${this.currentPage + 1}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9,18 15,12 9,6"></polyline>
      </svg>
    </button>`;

    html += '</div>';
    return html;
  }

  bindPaginationEvents() {
    if (!this.paginationContainer) return;
    this.paginationContainer.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = Number(btn.dataset.page);
        if (!target || target === this.currentPage) return;
        this.currentPage = target;
        this.renderTable();
        this.renderPagination();
      });
    });
  }

  renderEquipmentBlock(details) {
    const equipment = Array.isArray(details.equipment) ? details.equipment : [];
    if (!equipment.length) {
      return `
        <div class="approve-equipment-block empty">
          <strong>Equipment</strong>
          <span>No equipment requested for this approval.</span>
        </div>`;
    }
    const items = equipment.map(item => {
      const fallbackName = this.equipmentLookup.get(Number(item.equipment_id)) || item.equipment_name || 'Equipment';
      const name = this.esc(fallbackName);
      const qty = Number(item.quantity) || 1;
      return `<li><span>${name}</span><strong>×${qty}</strong></li>`;
    }).join('');
    return `
      <div class="approve-equipment-block">
        <strong>Equipment Requested</strong>
        <ul>${items}</ul>
      </div>`;
  }

  // ── Helpers ──────────────────────────────────────────────
  esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  fmtDate(d) {
    return SmartLab.Core.Utils.formatDate(d);
  }

  fmtDateTime(d) {
    return SmartLab.Core.Utils.formatDateTime(d);
  }

  fmtTime(start, end) {
    return SmartLab.Core.Utils.formatTimeRange(start, end);
  }

  deriveRoomLabel(record) {
    if (!record) return '';
    const normalize = (val) => typeof val === 'string' ? val.trim() : '';
    const fromField = normalize(record.room_label);
    if (fromField) return fromField;
    const number = normalize(record.room_number);
    const name = normalize(record.room_name);
    const combined = number && name ? `${number} - ${name}` : [number, name].filter(Boolean).join(' ').trim();
    if (combined) return combined;
    const location = normalize(record.location);
    if (location) return location;
    return '';
  }

  deriveProgramLabel(record) {
    if (!record) return '';
    const normalize = (val) => typeof val === 'string' ? val.trim() : '';
    const direct = normalize(record.program_code);
    if (direct) return direct;
    const code = normalize(record.program_code);
    const name = normalize(record.program_name);
    const combined = [code, name].filter(Boolean).join(' — ').trim();
    if (combined) return combined;
    const fallback = normalize(record.program);
    if (fallback) return fallback;
    return '';
  }

  deriveSubjectLabel(record) {
    if (!record) return '';
    const normalize = (val) => typeof val === 'string' ? val.trim() : '';
    const direct = normalize(record.subject_label);
    if (direct) return direct;
    const name = normalize(record.subject_name);
    if (name) return name;
    const subject = normalize(record.subject);
    if (subject) return subject;
    const code = normalize(record.subject_code);
    if (code) return code;
    return '';
  }

  normalizeRequestRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const dateNeeded = record.date_needed ? String(record.date_needed).slice(0, 10) : null;
    const roomLabel = this.deriveRoomLabel(record);
    const programLabel = this.deriveProgramLabel(record);
    const subjectLabel = this.deriveSubjectLabel(record);
    return {
      ...record,
      date_needed: dateNeeded,
      room_label: roomLabel || null,
      program_label: programLabel || null,
      subject_label: subjectLabel || null,
      location: roomLabel || record.location || null,
      program: programLabel || record.program || null,
      subject: subjectLabel || record.subject || null,
      role_name: record.role_name || record.role || null,
      role: record.role || record.role_name || null
    };
  }

  getRoomDisplay(record) {
    return this.deriveRoomLabel(record) || '-';
  }

  getSubjectDisplay(record) {
    return this.deriveSubjectLabel(record) || '-';
  }

  getProgramDisplay(record) {
    const label = this.deriveProgramLabel(record);
    if (!label) return '-';
    return label;
  }

  formatProgramWithYear(record) {
    const programLabel = this.deriveProgramLabel(record);
    const year = record?.year_level ? `Year ${record.year_level}` : '';
    if (programLabel && year) return `${programLabel} - ${year}`;
    return programLabel || year || '';
  }

  getStatusTimestamp(r) {
    if (!r) return null;
    switch (r.status_id) {
      case this.STATUS.APPROVED:
        return r.approved_at || r.created_at;
      case this.STATUS.BORROWED:
        return r.borrowed_at || r.approved_at || r.created_at;
      case this.STATUS.RETURNED:
        return r.returned_at || r.borrowed_at || r.approved_at || r.created_at;
      case this.STATUS.DECLINED:
        return r.declined_at || r.created_at;
      case this.STATUS.CANCELLED:
        return r.cancelled_at || r.created_at;
      default:
        return r.created_at;
    }
  }

  notify(msg, type = 'info') {
    if (window.SmartLab?.Core?.UI?.showToast) {
      window.SmartLab.Core.UI.showToast(msg, type);
    }
  }

  $(id) { return document.getElementById(id); }

  // ── Initialization ──────────────────────────────────────
  init() {
    this.tbody = this.$('requests-table-body');
    this.paginationContainer = this.$('requests-pagination');
    this.statusFilter = this.$('request-status-filter');
    this.roleFilter = this.$('request-role-filter');
    this.sortSelect = this.$('request-sort');
    this.searchInput = this.$('request-search');
    this.dateFrom = this.$('request-date-from');
    this.dateTo = this.$('request-date-to');
    this.clearBtn = this.$('clear-filters-btn');
    this.activeFiltersEl = this.$('active-filters');
    this.resultsCountEl = this.$('results-count');
    this.modal = this.$('request-details-modal');
    this._searchTimer = null;

    if (!this.tbody) {
      console.error('RequestsManager: requests-table-body not found');
      return;
    }

    // Init academic context filter
    this.acFilter = new AcademicContextFilter({
      containerId: 'academic-context-filter',
      onChange: () => this.loadRequests()
    });
    this.acFilter.init().then(() => {
      this.applyPresetFilters();
      this.bindEvents();
      this.loadRequests();
    });
  }

  applyPresetFilters() {
    try {
      const presetRaw = sessionStorage.getItem('smartlab:requestsFilter');
      let preset = null;
      if (presetRaw) {
        sessionStorage.removeItem('smartlab:requestsFilter');
        preset = JSON.parse(presetRaw);
      } else if (window.__SmartLabRequestsPreset) {
        preset = window.__SmartLabRequestsPreset;
        delete window.__SmartLabRequestsPreset;
      }
      if (!preset) return;
      if (preset?.status && this.statusFilter) {
        this.statusFilter.value = preset.status;
      }
      if (preset?.role && this.roleFilter) {
        this.roleFilter.value = preset.role;
      }
    } catch (error) {
      console.warn('RequestsManager: Failed to apply preset filters', error);
    }
  }

  bindEvents() {
    // Dropdown / date filters → instant apply
    const instant = () => this.applyFilters();
    [this.statusFilter, this.roleFilter, this.sortSelect, this.dateFrom, this.dateTo]
      .forEach(el => el?.addEventListener('change', instant));

    // Search → debounced 300ms
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.applyFilters(), 300);
      });
    }

    // Clear all
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Active filter tag removal (delegated)
    if (this.activeFiltersEl) {
      this.activeFiltersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-tag-remove');
        if (!btn) return;
        const target = btn.dataset.clear;
        this.clearSingleFilter(target);
      });
    }

    // Stat card clicks
    document.querySelectorAll('.stat-clickable[data-filter]').forEach(card => {
      card.addEventListener('click', () => {
        const val = card.dataset.filter;
        if (this.statusFilter) this.statusFilter.value = val;
        this.applyFilters();
      });
    });

    // Table row click → open modal (delegated)
    this.tbody.addEventListener('click', (e) => this.handleTableClick(e));

    // Modal close
    if (this.modal) {
      this.$('request-modal-close')?.addEventListener('click', () => this.closeModal());
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    // Modal footer buttons (delegated)
    this.$('modal-footer-actions')?.addEventListener('click', (e) => this.handleModalAction(e));
  }

  // ── Data Loading ────────────────────────────────────────
  async loadRequests() {
    this.tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#9ca3af;">Loading requests...</td></tr>`;
    this.requestDetailsCache.clear();

    try {
      const qs = this.acFilter ? this.acFilter.toQueryString() : '';
      const res = await fetch('/api/borrowRequests/all' + (qs ? '?' + qs : ''), { headers: SmartLab.Core.Auth.getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.allRequests = Array.isArray(data)
        ? data.map(record => this.normalizeRequestRecord(record))
        : [];
    } catch (err) {
      console.error('Failed to load requests:', err);
      // Fallback to pending
      try {
        const qs2 = this.acFilter ? this.acFilter.toQueryString() : '';
        const res2 = await fetch('/api/borrowRequests/pending' + (qs2 ? '?' + qs2 : ''), { headers: SmartLab.Core.Auth.getAuthHeaders() });
        if (res2.ok) {
          const data2 = await res2.json();
          this.allRequests = Array.isArray(data2)
            ? data2.map(record => this.normalizeRequestRecord(record))
            : [];
        } else {
          this.allRequests = [];
        }
      } catch {
        this.allRequests = [];
      }
    }

    this.applyFilters();
  }

  // ── Filtering ───────────────────────────────────────────
  applyFilters() {
    const statusVal = this.statusFilter?.value || 'all';
    const roleVal = this.roleFilter?.value || 'all';
    const searchVal = (this.searchInput?.value || '').trim().toLowerCase();
    const dateFromVal = this.dateFrom?.value || '';
    const dateToVal = this.dateTo?.value || '';
    const sortVal = this.sortSelect?.value || 'newest';

    // Filter
    this.currentPage = 1;
    this.filteredRequests = this.allRequests.filter(r => {
      // Status
      if (statusVal !== 'all') {
        if ((this.STATUS_TEXT[r.status_id] || '') !== statusVal) return false;
      }
      // Role
      if (roleVal !== 'all') {
        if ((r.role_name || '') !== roleVal) return false;
      }
      // Search (name, email, equipment, location, purpose)
      if (searchVal) {
        const haystack = [
          r.full_name,
          r.requester_gmail,
          r.equipment_list,
          this.deriveRoomLabel(r),
          this.deriveProgramLabel(r),
          this.deriveSubjectLabel(r),
          r.purpose
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }
      // Date range
      if (dateFromVal || dateToVal) {
        const reqDate = r.date_needed ? String(r.date_needed).slice(0, 10) : '';
        if (!reqDate) return false;
        if (dateFromVal && reqDate < dateFromVal) return false;
        if (dateToVal && reqDate > dateToVal) return false;
      }
      return true;
    });

    // Sort
    this.filteredRequests.sort((a, b) => {
      switch (sortVal) {
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'newest':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'date-asc':
          return new Date(a.date_needed || 0) - new Date(b.date_needed || 0);
        case 'date-desc':
          return new Date(b.date_needed || 0) - new Date(a.date_needed || 0);
        case 'name-asc':
          return (a.full_name || '').localeCompare(b.full_name || '');
        case 'name-desc':
          return (b.full_name || '').localeCompare(a.full_name || '');
        default:
          return 0;
      }
    });

    this.updateStats();
    this.renderTable();
    this.updateResultsCount();
    this.renderActiveFilters();
    this.renderPagination();
  }

  clearFilters() {
    if (this.statusFilter) this.statusFilter.value = 'all';
    if (this.roleFilter) this.roleFilter.value = 'all';
    if (this.sortSelect) this.sortSelect.value = 'newest';
    if (this.searchInput) this.searchInput.value = '';
    if (this.dateFrom) this.dateFrom.value = '';
    if (this.dateTo) this.dateTo.value = '';
    this.applyFilters();
  }

  clearSingleFilter(target) {
    switch (target) {
      case 'status': if (this.statusFilter) this.statusFilter.value = 'all'; break;
      case 'role':   if (this.roleFilter) this.roleFilter.value = 'all'; break;
      case 'search': if (this.searchInput) this.searchInput.value = ''; break;
      case 'date':   if (this.dateFrom) this.dateFrom.value = ''; if (this.dateTo) this.dateTo.value = ''; break;
      case 'sort':   if (this.sortSelect) this.sortSelect.value = 'newest'; break;
    }
    this.applyFilters();
  }

  // ── Results Count ──────────────────────────────────────
  updateResultsCount() {
    if (!this.resultsCountEl) return;
    const total = this.allRequests.length;
    const shown = this.filteredRequests.length;
    this.resultsCountEl.textContent = shown === total
      ? `${total} request${total !== 1 ? 's' : ''}`
      : `${shown} of ${total} request${total !== 1 ? 's' : ''}`;
  }

  // ── Active Filter Tags ────────────────────────────────
  renderActiveFilters() {
    if (!this.activeFiltersEl) return;
    const tags = [];
    const x = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    const statusVal = this.statusFilter?.value || 'all';
    if (statusVal !== 'all') {
      tags.push(`<span class="filter-tag"><span class="filter-tag-label">Status:</span> ${this.esc(statusVal)} <button class="filter-tag-remove" data-clear="status">${x}</button></span>`);
    }
    const roleVal = this.roleFilter?.value || 'all';
    if (roleVal !== 'all') {
      tags.push(`<span class="filter-tag"><span class="filter-tag-label">Role:</span> ${this.esc(roleVal)} <button class="filter-tag-remove" data-clear="role">${x}</button></span>`);
    }
    const searchVal = (this.searchInput?.value || '').trim();
    if (searchVal) {
      tags.push(`<span class="filter-tag"><span class="filter-tag-label">Search:</span> "${this.esc(searchVal)}" <button class="filter-tag-remove" data-clear="search">${x}</button></span>`);
    }
    const df = this.dateFrom?.value || '';
    const dt = this.dateTo?.value || '';
    if (df || dt) {
      const label = df && dt ? `${df} → ${dt}` : df ? `From ${df}` : `Until ${dt}`;
      tags.push(`<span class="filter-tag"><span class="filter-tag-label">Date:</span> ${label} <button class="filter-tag-remove" data-clear="date">${x}</button></span>`);
    }
    const sortVal = this.sortSelect?.value || 'newest';
    if (sortVal !== 'newest') {
      const sortLabels = { oldest: 'Oldest First', 'date-asc': 'Date Needed ↑', 'date-desc': 'Date Needed ↓', 'name-asc': 'Name A-Z', 'name-desc': 'Name Z-A' };
      tags.push(`<span class="filter-tag"><span class="filter-tag-label">Sort:</span> ${sortLabels[sortVal] || sortVal} <button class="filter-tag-remove" data-clear="sort">${x}</button></span>`);
    }

    this.activeFiltersEl.innerHTML = tags.join('');
  }

  // ── Stats ───────────────────────────────────────────────
  updateStats() {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    this.allRequests.forEach(r => { if (counts[r.status_id] !== undefined) counts[r.status_id]++; });

    const el = (id, val) => { const e = this.$(id); if (e) e.textContent = val; };
    el('pending-count', counts[1]);
    el('approved-count', counts[2]);
    el('borrowed-count', counts[6]);
    el('declined-count', counts[3]);
    el('returned-count', counts[5]);
  }

  // ── Table Rendering ─────────────────────────────────────
  renderTable() {
    const total = this.filteredRequests.length;
    if (total === 0) {
      this.tbody.innerHTML = `<tr class="no-data-row"><td colspan="8">No requests found</td></tr>`;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / this.itemsPerPage));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredRequests.slice(startIndex, endIndex);

    this.tbody.innerHTML = pageItems.map(r => {
      const statusText = this.STATUS_TEXT[r.status_id] || 'Unknown';
      const statusCss = this.STATUS_CSS[r.status_id] || '';
      const equipment = (r.equipment_list && r.equipment_list.trim()) ? r.equipment_list : '-';
      const dateNeeded = this.fmtDate(r.date_needed);
      const timeStr = this.fmtTime(r.time_start || r.time_of_use, r.time_end);
      const roomDisplay = this.getRoomDisplay(r);

      // Action buttons based on status
      let actions = '';
      if (r.status_id === this.STATUS.PENDING) {
        actions = `
          <button class="btn-icon approve" data-action="approve" title="Approve">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"></polyline></svg>
          </button>
          <button class="btn-icon decline" data-action="decline" title="Decline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>`;
      } else if (r.status_id === this.STATUS.APPROVED) {
        actions = `
          <button class="btn-icon borrow" data-action="borrow" title="Mark Borrowed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          </button>
          <button class="btn-icon cancel" data-action="cancel" title="Cancel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>`;
      } else if (r.status_id === this.STATUS.BORROWED) {
        actions = `
          <button class="btn-icon return" data-action="return" title="Mark Returned">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18,7 9.5,17 6,13"></polyline><polyline points="22,7 13.5,17 12,15.5"></polyline></svg>
          </button>`;
      }

      const hasActions = actions.trim().length > 0;

      return `
        <tr data-id="${r.borrow_request_id}">
          <td>${r.borrow_request_id}</td>
          <td>${this.esc(r.full_name || r.requester_gmail || '-')}</td>
          <td>${this.esc(r.location || '-')}</td>
          <td title="${this.esc(equipment)}">${this.esc(equipment.length > 35 ? equipment.slice(0, 35) + '...' : equipment)}</td>
          <td>${dateNeeded}</td>
          <td>${timeStr}</td>
          <td><span class="status-badge ${statusCss}">${statusText}</span></td>
          <td class="actions-cell">
            <div class="action-buttons${hasActions ? '' : ' action-buttons--empty'}">
              ${hasActions ? actions : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  // ── Table Click Handling ────────────────────────────────
  handleTableClick(e) {
    // Check for action button clicks first
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const row = actionBtn.closest('tr[data-id]');
      if (!row) return;
      const id = Number(row.dataset.id);
      const action = actionBtn.dataset.action;

      if (action === 'approve') {
        this.approveRequestWithConflictCheck(id);
        return;
      }
      else if (action === 'decline') this.openDeclineModal(id);
      else if (action === 'borrow') this.confirmAction(id, this.STATUS.BORROWED, 'Mark this request as borrowed?');
      else if (action === 'cancel') this.confirmAction(id, this.STATUS.CANCELLED, 'Cancel this request?');
      else if (action === 'return') this.confirmAction(id, this.STATUS.RETURNED, 'Mark this request as returned?');
      return;
    }

    // Row click → open detail modal
    const row = e.target.closest('tr[data-id]');
    if (row) {
      const id = Number(row.dataset.id);
      const request = this.allRequests.find(r => r.borrow_request_id === id);
      if (request) this.openDetailModal(request);
    }
  }

  // ── Quick Confirm (Approve / Return) ───────────────────
  async confirmAction(id, statusId, message) {
    const label = this.STATUS_TEXT[statusId];
    const typeMap = {
      [this.STATUS.APPROVED]: { type: 'success', confirmText: 'Approve' },
      [this.STATUS.BORROWED]: { type: 'info',    confirmText: 'Mark Borrowed' },
      [this.STATUS.CANCELLED]:{ type: 'danger',  confirmText: 'Yes, Cancel' },
      [this.STATUS.RETURNED]: { type: 'success', confirmText: 'Mark Returned' }
    };
    const opts = typeMap[statusId] || { type: 'warning', confirmText: 'Confirm' };
    const ok = await SmartLab.Core.UI.confirm(message, `${label} Request`, opts);
    if (!ok) return;
    const success = await this.updateStatus(id, statusId);
    if (success) {
      this.notify(`Request ${label} successfully!`, 'success');
      await this.loadRequests();
    }
  }

  async approveRequestWithConflictCheck(id) {
    try {
      const details = await this.fetchRequestDetails(id);
      const conflictResult = await this.runConflictCheck(details);
      this.ensureConflictStyles();
      const dialog = this.composeApproveDialog(details, conflictResult);
      const ok = await SmartLab.Core.UI.confirm(dialog.message, dialog.title, dialog.options);
      if (!ok) return;
      const success = await this.updateStatus(id, this.STATUS.APPROVED);
      if (success) {
        this.notify('Request approved successfully!', 'success');
        await this.loadRequests();
      }
    } catch (error) {
      console.error('approveRequestWithConflictCheck error:', error);
      this.notify(error.message || 'Unable to approve request right now.', 'error');
    }
  }

  async fetchRequestDetails(id) {
    if (this.requestDetailsCache.has(id)) {
      return this.requestDetailsCache.get(id);
    }
    try {
      const res = await fetch(`/api/borrowRequests/${id}/details`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
      const dataRaw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(dataRaw.message || 'Failed to load request details.');
      }
      const normalized = this.normalizeRequestRecord(dataRaw);
      // Ensure role fields exist for downstream student/faculty checks
      if (!normalized.role_name && dataRaw.role_name) normalized.role_name = dataRaw.role_name;
      if (!normalized.role && dataRaw.role) normalized.role = dataRaw.role;
      if (!normalized.role && dataRaw.role_id) normalized.role = String(dataRaw.role_id);
      this.requestDetailsCache.set(id, normalized);
      return normalized;
    } catch (error) {
      console.warn('fetchRequestDetails: falling back to cached list data', error);
      const fallback = this.buildDetailsFromList(id);
      if (fallback) {
        this.requestDetailsCache.set(id, fallback);
        return fallback;
      }
      throw error;
    }
  }

  buildDetailsFromList(id) {
    const request = this.allRequests.find(r => r.borrow_request_id === id);
    if (!request) return null;
    const normalized = this.normalizeRequestRecord(request);
    return {
      borrow_request_id: normalized.borrow_request_id,
      room_id: normalized.room_id,
      room_label: normalized.room_label,
      location: normalized.location,
      date_needed: normalized.date_needed,
      time_start: normalized.time_start,
      time_end: normalized.time_end,
      time_of_use: normalized.time_of_use,
      role_name: normalized.role_name || normalized.role || request.role_name || request.role,
      program_id: normalized.program_id,
      program_label: normalized.program_label,
      program: normalized.program,
      year_level: normalized.year_level,
      subject_id: normalized.subject_id,
      subject_label: normalized.subject_label,
      subject: normalized.subject,
      purpose: normalized.purpose,
      equipment: []
    };
  }

  buildConflictPayload(details) {
    const lab_room = this.deriveRoomLabel(details);
    const date_needed = details.date_needed ? String(details.date_needed).slice(0, 10) : '';
    const time_start = details.time_start || details.time_of_use || '';
    const time_end = details.time_end || '';

    const role = (details.role_name || details.role || '').toString().toLowerCase();
    const isStudent = role.includes('student') || role === '3';

    const equipment_ids = [];
    const equipment_quantities = {};
    (details.equipment || []).forEach(item => {
      const eqId = Number(item.equipment_id);
      if (!Number.isInteger(eqId)) return;
      equipment_ids.push(eqId);
      equipment_quantities[eqId] = Number(item.quantity) || 1;
    });

    const payload = { lab_room, date_needed, time_start, time_end };
    if (details.room_id) {
      payload.room_id = Number(details.room_id);
    }
    if (details.borrow_request_id) {
      payload.exclude_request_id = details.borrow_request_id;
    }
    if (equipment_ids.length) {
      payload.equipment_ids = equipment_ids;
      payload.equipment_quantities = equipment_quantities;
    }

    // For student requests, check equipment only (skip schedule conflicts)
    if (isStudent) {
      payload.skip_schedule = true;
      payload.include_requests = false;
      payload.include_pending_requests = false;
    }
    return payload;
  }

  async runConflictCheck(details) {
    const role = (details.role_name || details.role || '').toString().toLowerCase();
    const isStudent = role.includes('student') || role === '3';
    if (isStudent) {
      return { state: 'success', data: { hasConflict: false, conflicts: [], checked: {} } };
    }

    const payload = this.buildConflictPayload(details);
    if (!payload.lab_room || !payload.date_needed || !payload.time_start || !payload.time_end) {
      return { state: 'skipped', reason: 'Missing lab room or schedule details.' };
    }
    try {
      const res = await fetch('/api/conflicts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { state: 'error', message: data.message || `Conflict check failed (HTTP ${res.status})` };
      }
      return { state: 'success', data };
    } catch (err) {
      return { state: 'error', message: err.message || 'Conflict check failed.' };
    }
  }

  composeApproveDialog(details, result) {
    const metaBanner = this.renderMetaBanner(details);
    const contextBlock = this.renderContextBlock(details);
    const equipmentBlock = this.renderEquipmentBlock(details);

    if (!result || result.state === 'error') {
      return {
        title: 'Conflict Check Unavailable',
        message: this.wrapDialogSections(
          `<p class="approve-dialog-lead">Could not verify conflicts.${result?.message ? ` <span class="approve-dialog-note">Reason: ${this.esc(result.message)}</span>` : ''}</p>`,
          metaBanner,
          contextBlock,
          equipmentBlock,
          '<p class="approve-dialog-note">Approve anyway?</p>'
        ),
        options: { type: 'warning', confirmText: 'Approve Anyway' }
      };
    }

    if (result.state === 'skipped') {
      return {
        title: 'Incomplete Schedule Data',
        message: this.wrapDialogSections(
          '<p class="approve-dialog-lead">This request is missing room/date/time information, so conflicts could not be checked.</p>',
          metaBanner,
          contextBlock,
          '<p class="approve-dialog-note">Approve anyway?</p>'
        ),
        options: { type: 'warning', confirmText: 'Approve Anyway' }
      };
    }

    const data = result.data || {};
    if (data.hasConflict) {
      const helper = this.renderConflictHelper(data);
      const count = Array.isArray(data.conflicts) ? data.conflicts.length : 1;
      return {
        title: 'Conflicts Detected',
        message: this.wrapDialogSections(
          `<p class="approve-dialog-lead">${count} conflict${count > 1 ? 's' : ''} detected.</p>`,
          metaBanner,
          contextBlock,
          equipmentBlock,
          helper,
          '<p class="approve-dialog-note">Resolve conflicts before approving.</p>'
        ),
        options: { type: 'danger', confirmText: 'Approve', confirmDisabled: true }
      };
    }

    return {
      title: 'Approve Request',
      message: this.wrapDialogSections(
        '<p class="approve-dialog-lead">No conflicts detected.</p>',
        metaBanner,
        contextBlock,
        equipmentBlock,
        '<p class="approve-dialog-note">Approve this request?</p>'
      ),
      options: { type: 'success', confirmText: 'Approve' }
    };
  }

  wrapDialogSections(...sections) {
    const html = sections.filter(Boolean).join('');
    return `<div class="approve-dialog-content">${html}</div>`;
  }

  renderContextBlock(details) {
    const rows = [];
    const room = this.getRoomDisplay(details);
    if (room && room !== '-') {
      rows.push(`<div class="context-row"><span>Room</span><strong>${this.esc(room)}</strong></div>`);
    }
    if (details.date_needed) {
      rows.push(`<div class="context-row"><span>Date</span><strong>${this.esc(SmartLab.Core.Utils.formatDate(details.date_needed))}</strong></div>`);
    }
    const timeRange = this.fmtTime(details.time_start || details.time_of_use, details.time_end);
    if (timeRange) {
      rows.push(`<div class="context-row"><span>Time</span><strong>${this.esc(timeRange)}</strong></div>`);
    }
    if (!rows.length) return '';
    return `<div class="approve-context-block">${rows.join('')}</div>`;
  }

  renderMetaBanner(details) {
    const lines = [];
    if (details.borrow_request_id) {
      lines.push(`<div class="meta-line"><span>Request ID</span><strong>#${this.esc(details.borrow_request_id)}</strong></div>`);
    }
    const cleanPurpose = this.cleanPurposeText(details.purpose);
    if (cleanPurpose) {
      lines.push(`<div class="meta-line"><span>Purpose</span><strong>${this.esc(cleanPurpose)}</strong></div>`);
    }
    if (!lines.length) return '';
    return `<div class="approve-meta-banner">${lines.join('')}</div>`;
  }

  cleanPurposeText(purpose) {
    if (!purpose) return '';
    return purpose
      .replace(/\s*Requested Lab:\s*[^\n]*/gi, '')
      .replace(/\s*Faculty In Charge:\s*[^\n]*/gi, '')
      .trim();
  }

  renderConflictHelper(result) {
    const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
    const checked = result.checked || {};
    const room = checked.lab_room ? this.esc(checked.lab_room) : 'Selected room';
    const dateStr = checked.date_needed ? this.esc(SmartLab.Core.Utils.formatDate(checked.date_needed)) : 'Selected date';
    const dayStr = checked.day_of_week ? ` (${this.esc(checked.day_of_week)})` : '';
    const timeRange = checked.time_start && checked.time_end ? ` • ${this.esc(SmartLab.Core.Utils.formatTimeRange(checked.time_start, checked.time_end))}` : '';
    const items = conflicts.map(conflict => this.renderConflictItem(conflict)).join('');

    return `
      <div class="conflict-alert">
        <div class="conflict-alert-header">
          <span class="conflict-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div>
            <strong>${conflicts.length} Conflict${conflicts.length !== 1 ? 's' : ''} Detected</strong>
            <span class="conflict-subtitle">for ${room} on ${dateStr}${dayStr}${timeRange}</span>
          </div>
        </div>
        <div class="conflict-list">${items}</div>
        <div class="conflict-help">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Please change the lab room or reschedule this request. Conflicts must be resolved before approving.</span>
        </div>
      </div>`;
  }

  renderConflictItem(conflict) {
    if (!conflict) return '';
    const severity = conflict.severity === 'high' ? 'high' : 'medium';
    const type = conflict.type || 'request';
    const badgeMap = {
      lab_schedule: { label: 'Schedule', cls: 'badge-schedule' },
      equipment: { label: 'Equipment', cls: 'badge-equipment' },
      borrow_request: { label: 'Request', cls: 'badge-request' }
    };
    const badge = badgeMap[type] || badgeMap.borrow_request;
    const detailsHtml = this.renderConflictDetails(type, conflict.details || {});
    return `
      <div class="conflict-item conflict-${severity}">
        <div class="conflict-item-header">
          <span class="conflict-badge ${badge.cls}">${badge.label}</span>
          <span class="conflict-severity-badge severity-${severity}">${severity === 'high' ? 'High' : 'Medium'}</span>
        </div>
        <div class="conflict-item-body">
          <p class="conflict-message">${this.esc(conflict.message || 'Conflict detected')}</p>
          ${detailsHtml}
        </div>
      </div>`;
  }

  renderConflictDetails(type, details) {
    const rows = [];
    if (type === 'lab_schedule') {
      if (details.schedule_id) {
        rows.push(this.renderDetailRow('Schedule ID', `#${details.schedule_id}`));
      }
      if (details.time_start || details.time_end) {
        rows.push(this.renderDetailRow('Time', SmartLab.Core.Utils.formatTimeRange(details.time_start, details.time_end)));
      }
      if (details.subject) rows.push(this.renderDetailRow('Subject', details.subject));
      if (details.faculty_name) rows.push(this.renderDetailRow('Faculty', details.faculty_name));
      if (details.program || details.year_level) {
        const text = `${details.program || ''}${details.year_level ? ` • Year ${details.year_level}` : ''}`.trim();
        if (text) rows.push(this.renderDetailRow('Program', text));
      }
    } else if (type === 'equipment') {
      if (details.equipment_name) rows.push(this.renderDetailRow('Equipment', details.equipment_name));
      if (details.requested_qty) rows.push(this.renderDetailRow('Requested', `${details.requested_qty} unit${details.requested_qty > 1 ? 's' : ''}`));
      if (typeof details.available_on_date === 'number') rows.push(this.renderDetailRow('Available', `${details.available_on_date} unit${details.available_on_date !== 1 ? 's' : ''}`));
      if (details.pending_other) rows.push(this.renderDetailRow('Pending Requests', details.pending_other));
      const conflicting = Array.isArray(details.conflicting_requests) ? details.conflicting_requests : [];
      if (conflicting.length) {
        const summary = conflicting
          .map(item => `#${this.esc(item.borrow_request_id || '?')}${item.status ? ` (${this.esc(item.status)})` : ''}`)
          .join(', ');
        rows.push(this.renderDetailRow('Conflicting Requests', summary));
      }
    } else {
      if (details.borrow_request_id) {
        rows.push(this.renderDetailRow('Request ID', `#${details.borrow_request_id}`));
      }
      if (details.time_start || details.time_end) {
        rows.push(this.renderDetailRow('Time', SmartLab.Core.Utils.formatTimeRange(details.time_start, details.time_end)));
      }
      if (details.status) rows.push(this.renderDetailRow('Status', details.status));
      if (details.requester_name) rows.push(this.renderDetailRow('Requested By', details.requester_name));
      if (details.subject) rows.push(this.renderDetailRow('Subject', details.subject));
    }

    if (!rows.length) return '';
    return `<div class="conflict-details">${rows.join('')}</div>`;
  }

  renderDetailRow(label, value) {
    if (!value) return '';
    return `<div class="conflict-detail-row"><span class="detail-label">${this.esc(label)}:</span><span class="detail-value">${this.esc(value)}</span></div>`;
  }

  ensureConflictStyles() {
    if (this._conflictStylesInjected) return;
    const existing = document.getElementById('admin-conflict-helper-styles');
    if (existing) {
      this._conflictStylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'admin-conflict-helper-styles';
    style.textContent = `
      .confirm-overlay { align-items: center !important; justify-content: center !important; overflow-y: auto; padding: 2rem 1rem; }
      .confirm-dialog { width: min(440px, 92vw); height: min(560px, 90vh); display: flex; flex-direction: column; margin: 0; }
      .confirm-dialog .confirm-message { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin-bottom: 1rem; text-align: left; padding-right: 0.25rem; }
      .confirm-dialog .approve-dialog-content { display: flex; flex-direction: column; gap: 0.85rem; color: #1f2937; }
      .confirm-dialog .approve-meta-banner { background: #fff8e7; border: 1px solid #fcd34d; border-radius: 12px; padding: 0.75rem 0.95rem; display: flex; flex-direction: column; gap: 0.35rem; }
      .confirm-dialog .approve-meta-banner .meta-line { display: flex; justify-content: space-between; font-size: 0.92rem; color: #92400e; }
      .confirm-dialog .approve-meta-banner .meta-line strong { color: #78350f; }
      .confirm-dialog .approve-dialog-lead { margin: 0; font-weight: 600; color: #991b1b; }
      .confirm-dialog .approve-dialog-note { margin: 0; color: #4b5563; font-size: 0.9rem; }
      .confirm-dialog .approve-context-block { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem 1rem; background: #f9fafb; }
      .confirm-dialog .approve-context-block .context-row { display: flex; justify-content: space-between; font-size: 0.9rem; color: #4b5563; margin-bottom: 0.3rem; }
      .confirm-dialog .approve-context-block .context-row:last-child { margin-bottom: 0; }
      .confirm-dialog .approve-context-block .context-row strong { color: #111827; }
      .confirm-dialog .conflict-alert { border: 1px solid #fecaca; background: #fff7f7; border-radius: 14px; padding: 1rem; box-shadow: inset 0 0 0 1px rgba(248,113,113,0.15); }
      .confirm-dialog .conflict-alert-header { display: flex; gap: 0.9rem; align-items: flex-start; margin-bottom: 0.75rem; }
      .confirm-dialog .conflict-alert-header strong { display: block; font-size: 1rem; color: #b91c1c; }
      .confirm-dialog .conflict-subtitle { font-size: 0.85rem; color: #6b7280; display: block; margin-top: 0.15rem; }
      .confirm-dialog .conflict-alert-icon { width: 32px; height: 32px; border-radius: 999px; background: #fee2e2; display: flex; align-items: center; justify-content: center; }
      .confirm-dialog .conflict-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
      .confirm-dialog .conflict-item { border: 1px solid #fee2e2; border-radius: 12px; padding: 0.75rem; background: #fff; }
      .confirm-dialog .conflict-item.conflict-medium { border-color: #fde68a; }
      .confirm-dialog .conflict-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
      .confirm-dialog .conflict-badge { font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.65rem; border-radius: 999px; }
      .confirm-dialog .badge-schedule { background: #dbeafe; color: #1d4ed8; }
      .confirm-dialog .badge-equipment { background: #fef3c7; color: #b45309; }
      .confirm-dialog .badge-request { background: #ede9fe; color: #6d28d9; }
      .confirm-dialog .conflict-severity-badge { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #991b1b; }
      .confirm-dialog .conflict-severity-badge.severity-medium { color: #b45309; }
      .confirm-dialog .conflict-message { margin: 0 0 0.5rem; font-size: 0.9rem; color: #111827; }
      .confirm-dialog .conflict-details { display: flex; flex-direction: column; gap: 0.25rem; }
      .confirm-dialog .conflict-detail-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #4b5563; }
      .confirm-dialog .detail-label { font-weight: 500; }
      .confirm-dialog .detail-value { margin-left: 0.5rem; text-align: right; color: #111827; }
      .confirm-dialog .conflict-help { display: flex; gap: 0.5rem; align-items: center; font-size: 0.8rem; color: #6b7280; border-top: 1px dashed #fecaca; padding-top: 0.6rem; }
    `;
    document.head.appendChild(style);
    this._conflictStylesInjected = true;
  }

  // ── Decline Modal ───────────────────────────────────────
  openDeclineModal(requestId) {
    const request = this.allRequests.find(r => r.borrow_request_id === requestId);
    if (!request) return;

    this.selectedRequest = request;
    this.populateModal(request);

    // Show rejection reason group
    const group = this.$('rejection-reason-group');
    if (group) group.style.display = '';
    const input = this.$('rejection-reason-input');
    if (input) input.value = '';

    // Set modal title
    const title = this.$('modal-title');
    if (title) title.textContent = 'Decline Request';

    // Footer buttons for decline
    const footer = this.$('modal-footer-actions');
    if (footer) {
      footer.innerHTML = `
        <button type="button" class="btn btn-secondary" data-modal="close">Cancel</button>
        <button type="button" class="btn btn-danger" data-modal="confirm-decline">Decline Request</button>`;
    }

    this.openModal();
  }

  // ── Detail Modal ────────────────────────────────────────
  openDetailModal(request) {
    this.selectedRequest = request;
    this.populateModal(request);

    // Hide rejection reason group
    const group = this.$('rejection-reason-group');
    if (group) group.style.display = 'none';

    const title = this.$('modal-title');
    if (title) title.textContent = 'Request Details';

    // Footer buttons based on status
    const footer = this.$('modal-footer-actions');
    if (footer) {
      let buttons = `<button type="button" class="btn btn-secondary" data-modal="close">Close</button>`;
      if (request.status_id === this.STATUS.PENDING) {
        buttons += `
          <button type="button" class="btn btn-danger" data-modal="decline">Decline</button>
          <button type="button" class="btn btn-success" data-modal="approve">Approve</button>`;
      } else if (request.status_id === this.STATUS.APPROVED) {
        buttons += `
          <button type="button" class="btn btn-warning" data-modal="cancel">Cancel</button>
          <button type="button" class="btn btn-primary" data-modal="borrow">Mark Borrowed</button>`;
      } else if (request.status_id === this.STATUS.BORROWED) {
        buttons += `<button type="button" class="btn btn-primary" data-modal="return">Mark Returned</button>`;
      }
      footer.innerHTML = buttons;
    }

    this.openModal();
  }

  populateModal(r) {
    const set = (id, val) => { const el = this.$(id); if (el) el.textContent = val || '-'; };

    set('detail-request-id', `#${r.borrow_request_id}`);
    set('detail-requester', r.full_name || r.requester_gmail || '-');
    set('detail-role', r.role_name || '-');
    set('detail-email', r.requester_gmail || '-');
    set('detail-location', this.getRoomDisplay(r));
    set('detail-subject', this.getSubjectDisplay(r));
    set('detail-date', this.fmtDate(r.date_needed));
    set('detail-time', this.fmtTime(r.time_start || r.time_of_use, r.time_end));
    const programYear = this.formatProgramWithYear(r);
    set('detail-program', programYear || '-');
    const cleanPurpose = (r.purpose || '-').trim();
    set('detail-purpose', cleanPurpose);

    // Avatar initials
    const avatarEl = this.$('detail-avatar');
    if (avatarEl) {
      const name = r.full_name || r.requester_gmail || '?';
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || '?';
    }

    // Status badge
    const statusEl = this.$('detail-status');
    if (statusEl) {
      const txt = this.STATUS_TEXT[r.status_id] || 'Unknown';
      const css = this.STATUS_CSS[r.status_id] || '';
      statusEl.textContent = txt;
      statusEl.className = `status-badge ${css}`;
    }

    // Rejection note (show if declined and has note)
    const noteSection = this.$('detail-note-section');
    if (noteSection) {
      if (r.status_id === this.STATUS.DECLINED && r.note) {
        set('detail-note', r.note);
        noteSection.style.display = '';
      } else {
        noteSection.style.display = 'none';
      }
    }

    // Equipment list
    const eqDiv = this.$('detail-equipment-list');
    if (eqDiv) {
      const eqList = r.equipment_list && r.equipment_list.trim() ? r.equipment_list : '';
      if (!eqList) {
        eqDiv.innerHTML = '<span class="rd-no-equipment">No equipment requested</span>';
      } else {
        const items = eqList.split(', ').map(item => {
          const match = item.match(/^(.+)\((\d+)\)$/);
          if (match) {
            return `<div class="equipment-item"><span class="equipment-name">${this.esc(match[1].trim())}</span><span class="equipment-quantity">&times;${match[2]}</span></div>`;
          }
          return `<div class="equipment-item"><span class="equipment-name">${this.esc(item)}</span></div>`;
        });
        eqDiv.innerHTML = items.join('');
      }
    }

    // Timeline values
    set('detail-created-at', this.fmtDateTime(r.created_at));
    set('detail-approved-at', this.fmtDateTime(r.approved_at));
    set('detail-borrowed-at', this.fmtDateTime(r.borrowed_at));
    set('detail-returned-at', this.fmtDateTime(r.returned_at));
    set('detail-cancelled-at', this.fmtDateTime(r.cancelled_at));
    set('detail-declined-at', this.fmtDateTime(r.declined_at));
  }

  openModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    this.selectedRequest = null;
  }

  // ── Modal Action Handler ────────────────────────────────
  async handleModalAction(e) {
    const btn = e.target.closest('[data-modal]');
    if (!btn) return;
    const action = btn.dataset.modal;

    if (action === 'close') {
      this.closeModal();
      return;
    }

    if (!this.selectedRequest) return;
    const id = this.selectedRequest.borrow_request_id;

    if (action === 'approve') {
      this.closeModal();
      await this.approveRequestWithConflictCheck(id);
      return;
    }

    if (action === 'decline') {
      // Switch to decline mode in the same modal
      this.closeModal();
      this.openDeclineModal(id);
    }

    if (action === 'confirm-decline') {
      const reason = this.$('rejection-reason-input')?.value?.trim() || '';
      if (!reason) {
        this.notify('Please provide a reason for declining.', 'warning');
        this.$('rejection-reason-input')?.focus();
        return;
      }
      const ok = await this.updateStatus(id, this.STATUS.DECLINED, reason);
      if (ok) {
        this.notify('Request declined.', 'success');
        this.closeModal();
        await this.loadRequests();
      }
    }

    if (action === 'borrow') {
      this.closeModal();
      const ok = await SmartLab.Core.UI.confirm('Mark this request as borrowed?', 'Mark as Borrowed', { type: 'info', confirmText: 'Mark Borrowed' });
      if (!ok) return;
      const success = await this.updateStatus(id, this.STATUS.BORROWED);
      if (success) {
        this.notify('Request marked as borrowed!', 'success');
        await this.loadRequests();
      }
      return;
    }

    if (action === 'cancel') {
      this.closeModal();
      const ok = await SmartLab.Core.UI.confirm('Cancel this request?', 'Cancel Request', { type: 'danger', confirmText: 'Yes, Cancel' });
      if (!ok) return;
      const success = await this.updateStatus(id, this.STATUS.CANCELLED);
      if (success) {
        this.notify('Request cancelled.', 'success');
        await this.loadRequests();
      }
      return;
    }

    if (action === 'return') {
      this.closeModal();
      const ok = await SmartLab.Core.UI.confirm('Mark this request as returned?', 'Mark as Returned', { type: 'success', confirmText: 'Mark Returned' });
      if (!ok) return;
      const success = await this.updateStatus(id, this.STATUS.RETURNED);
      if (success) {
        this.notify('Request marked as returned!', 'success');
        await this.loadRequests();
      }
      return;
    }
  }

  // ── API Call ────────────────────────────────────────────
  async updateStatus(id, statusId, rejectionReason = '') {
    try {
      const body = { status_id: statusId };
      if (rejectionReason) body.rejection_reason = rejectionReason;

      const res = await fetch(`/api/borrowRequests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.notify(err.message || 'Failed to update status.', 'error');
        return false;
      }
      return true;
    } catch (err) {
      console.error('updateStatus error:', err);
      this.notify('Server error. Please try again.', 'error');
      return false;
    }
  }
}
