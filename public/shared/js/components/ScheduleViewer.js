/**
 * ScheduleViewer – shared schedule explorer for Admin, Faculty, Student.
 * Handles fetching, filtering, view switching, and optional admin actions.
 */
(function () {
    const root = window.SmartLab = window.SmartLab || {};
    root.Core = root.Core || {};
    root.Core.Components = root.Core.Components || {};

    class ScheduleViewer {
        constructor(options = {}) {
            const defaultSelectors = {
                root: '.schedule-page',
                addButton: 'add-schedule-btn',
                searchInput: 'schedule-search',
                labFilter: 'lab-filter',
                dayFilter: 'day-filter',
                facultyFilter: 'faculty-filter',
                statusFilter: 'status-filter',
                sortSelect: 'schedule-sort',
                clearFilters: 'schedule-clear-filters-btn',
                activeFilters: 'schedule-active-filters',
                resultsCount: 'schedule-results-count',
                tableBody: 'schedule-table-body',
                pagination: 'schedule-pagination',
                calendarGrid: 'calendar-grid',
                calendarLabel: 'cal-month-label',
                viewTabs: '.schedule-page .view-tab[data-view]'
            };

            this.options = {
                role: (sessionStorage.getItem('role') || '').toLowerCase(),
                selectors: Object.assign({}, defaultSelectors, options.selectors || {}),
                permissions: Object.assign({
                    canAdd: false,
                    canEdit: false,
                    canDelete: false
                }, options.permissions || {}),
                callbacks: Object.assign({
                    onAdd: null,
                    onEdit: null,
                    onDelete: null,
                    onInfo: null
                }, options.callbacks || {}),
                enableCalendar: options.enableCalendar !== false,
                enableChart: options.enableChart !== false,
                useAcademicContextFilter: options.useAcademicContextFilter !== false
            };

            this.state = {
                allSchedules: [],
                filteredSchedules: [],
                currentView: 'table',
                pagination: { currentPage: 1, itemsPerPage: 10 },
                calendarDate: new Date(),
                searchTimer: null,
                ganttChartInstance: null,
                labColorMap: {},
                labColors: [
                    '#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
                    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                ],
                labRooms: []
            };
        }

        async init() {
            this.cacheDom();
            await this.initAcademicContext();
            this.bindEvents();
            await this.loadSchedules();
        }

        cacheDom() {
            const sel = this.options.selectors;
            this.dom = {
                root: document.querySelector(sel.root),
                addButton: document.getElementById(sel.addButton),
                searchInput: document.getElementById(sel.searchInput),
                labFilter: document.getElementById(sel.labFilter),
                dayFilter: document.getElementById(sel.dayFilter),
                facultyFilter: document.getElementById(sel.facultyFilter),
                statusFilter: document.getElementById(sel.statusFilter),
                sortSelect: document.getElementById(sel.sortSelect),
                clearFilters: document.getElementById(sel.clearFilters),
                activeFilters: document.getElementById(sel.activeFilters),
                resultsCount: document.getElementById(sel.resultsCount),
                tableBody: document.getElementById(sel.tableBody),
                pagination: document.getElementById(sel.pagination),
                calendarGrid: document.getElementById(sel.calendarGrid),
                calendarLabel: document.getElementById(sel.calendarLabel),
                viewTabs: document.querySelectorAll(sel.viewTabs)
            };
        }

        async initAcademicContext() {
            if (!this.options.useAcademicContextFilter || typeof window.AcademicContextFilter === 'undefined') {
                this.acFilter = null;
                this.academicContext = null;
                return;
            }

            this.acFilter = new AcademicContextFilter({
                containerId: 'academic-context-filter',
                onChange: () => this.reload()
            });
            await this.acFilter.init();
            this.academicContext = this.acFilter.getSelected();
        }

        bindEvents() {
            this.bindAddButton();
            this.dom.viewTabs?.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const view = e.currentTarget.dataset.view;
                    if (view) this.switchView(view);
                });
            });

            const onFilterChange = () => {
                this.state.pagination.currentPage = 1;
                this.applyFilters();
            };
            [this.dom.labFilter, this.dom.dayFilter, this.dom.facultyFilter, this.dom.statusFilter, this.dom.sortSelect]
                .forEach(el => el?.addEventListener('change', onFilterChange));

            if (this.dom.searchInput) {
                this.dom.searchInput.addEventListener('input', () => {
                    clearTimeout(this.state.searchTimer);
                    this.state.searchTimer = setTimeout(onFilterChange, 300);
                });
            }

            this.dom.clearFilters?.addEventListener('click', () => this.clearFilters());
            this.dom.activeFilters?.addEventListener('click', (e) => {
                const btn = e.target.closest('.filter-tag-remove');
                if (!btn) return;
                this.clearSingleFilter(btn.dataset.clear);
            });

            document.getElementById('cal-prev-month')?.addEventListener('click', () => {
                this.state.calendarDate.setMonth(this.state.calendarDate.getMonth() - 1);
                this.renderCalendar();
            });
            document.getElementById('cal-next-month')?.addEventListener('click', () => {
                this.state.calendarDate.setMonth(this.state.calendarDate.getMonth() + 1);
                this.renderCalendar();
            });
            document.getElementById('cal-today-btn')?.addEventListener('click', () => {
                this.state.calendarDate = new Date();
                this.renderCalendar();
            });
        }

        bindInfoEvents() {
            if (typeof this.options.callbacks.onInfo !== 'function') return;
            this.dom.tableBody.querySelectorAll('tr[data-schedule-id]').forEach(row => {
                if (row._infoHandlerAttached) return;
                row._infoHandlerAttached = true;
                row.addEventListener('click', (e) => {
                    if (e.target.closest('[data-action]')) return;
                    const id = row.dataset.scheduleId;
                    if (!id) return;
                    const schedule = this.state.allSchedules.find(s => String(s.schedule_id) === id);
                    if (schedule) {
                        this.options.callbacks.onInfo(schedule, this);
                    }
                });
            });
        }

        bindAddButton() {
            const btn = this.dom.addButton;
            if (!btn) return;
            if (this.options.permissions.canAdd && typeof this.options.callbacks.onAdd === 'function') {
                btn.style.display = 'flex';
                if (!btn.dataset.bound) {
                    btn.addEventListener('click', () => this.options.callbacks.onAdd(this));
                    btn.dataset.bound = 'true';
                }
            } else {
                btn.style.display = 'none';
            }
        }

        async loadSchedules() {
            try {
                const qs = this.acFilter ? this.acFilter.toQueryString() : '';
                const res = await fetch('/api/labSchedule' + (qs ? `?${qs}` : ''), {
                    headers: SmartLab.Core.Auth.getAuthHeaders()
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                this.state.allSchedules = Array.isArray(data) ? data : [];
                await this.loadLabRooms();
                this.populateLabFilter();
                this.populateSelect(this.dom.facultyFilter, this.state.allSchedules.map(s => s.faculty_name));
                this.applyFilters();
            } catch (err) {
                console.error('ScheduleViewer: load error', err);
                SmartLab.Core.UI?.showToast?.('Unable to load schedules', 'error');
            }
        }

        async loadLabRooms() {
            try {
                const res = await fetch('/api/academic-directory/rooms', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load rooms');
                const rooms = await res.json();
                this.state.labRooms = Array.isArray(rooms) ? rooms.filter(r => this.isComputerLabRoom(r)) : [];
            } catch (err) {
                console.warn('ScheduleViewer: lab room load failed', err);
                this.state.labRooms = [];
            }
        }

        isComputerLabRoom(room = {}) {
            if (room?.is_computer_lab !== undefined && room?.is_computer_lab !== null) {
                return Number(room.is_computer_lab) === 1 || room.is_computer_lab === true;
            }
            const label = `${room.room_name || ''} ${room.room_number || ''}`.toLowerCase();
            return label.includes('computer laboratory') || label.includes('computer lab');
        }

        looksLikeLabLabel(label) {
            if (!label) return false;
            const normalized = String(label).toLowerCase();
            return normalized.includes('computer laboratory') || normalized.includes('computer lab');
        }

        normalizeLabLabel(label) {
            return String(label ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
        }

        getLabLabels() {
            const labels = new Set();
            (this.state.labRooms || []).forEach(room => {
                const label = this.buildRoomLabel(room);
                if (label) labels.add(label);
            });

            if (!labels.size) {
                this.state.allSchedules
                    .map(s => s.lab_room)
                    .filter(label => this.looksLikeLabLabel(label))
                    .forEach(label => labels.add(label));
            }

            return [...labels].sort((a, b) => a.localeCompare(b));
        }

        buildRoomLabel(room = {}) {
            const number = room.room_number?.trim();
            const name = room.room_name?.trim();
            if (number && name) return `${number} • ${name}`;
            return number || name || '';
        }

        escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        async reload() {
            await this.loadSchedules();
        }

        populateLabFilter() {
            if (!this.dom.labFilter) return;
            const current = this.dom.labFilter.value;
            const defaultLabel = this.dom.labFilter.options?.[0]?.text || 'All Labs';
            const labs = this.getLabLabels();

            this.dom.labFilter.innerHTML = `<option value="">${defaultLabel}</option>` +
                labs.map(lab => `<option value="${this.escapeHtml(lab)}">${this.escapeHtml(lab)}</option>`).join('');
            this.dom.labFilter.value = current;
        }

        populateSelect(selectEl, values = []) {
            if (!selectEl) return;
            const current = selectEl.value;
            const defaultLabel = selectEl.options?.[0]?.text || 'All';
            selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
            [...new Set(values.filter(Boolean))].sort().forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                selectEl.appendChild(option);
            });
            selectEl.value = current;
        }

        applyFilters() {
            const labVal = (this.dom.labFilter?.value || '').trim();
            const dayVal = (this.dom.dayFilter?.value || '').trim().toUpperCase();
            const facultyVal = (this.dom.facultyFilter?.value || '').trim();
            const statusVal = (this.dom.statusFilter?.value || '').trim();
            const searchVal = (this.dom.searchInput?.value || '').trim().toLowerCase();
            const sortVal = this.dom.sortSelect?.value || 'day-time';

            this.state.filteredSchedules = this.state.allSchedules.filter((s) => {
                if (labVal && (s.lab_room || '') !== labVal) return false;
                if (dayVal && (s.day_of_week || '').toUpperCase() !== dayVal) return false;
                if (facultyVal && (s.faculty_name || '') !== facultyVal) return false;
                if (statusVal) {
                    const isOneTime = !!s.schedule_date;
                    if (statusVal === 'recurring' && isOneTime) return false;
                    if (statusVal === 'upcoming' && (!isOneTime || s.is_expired)) return false;
                    if (statusVal === 'expired' && (!isOneTime || !s.is_expired)) return false;
                }
                if (searchVal) {
                    const haystack = [s.lab_room, s.faculty_name, s.subject, s.program]
                        .filter(Boolean).join(' ').toLowerCase();
                    if (!haystack.includes(searchVal)) return false;
                }
                return true;
            });

            const DAY_ORDER = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };
            this.state.filteredSchedules.sort((a, b) => {
                switch (sortVal) {
                    case 'lab-asc':
                        return (a.lab_room || '').localeCompare(b.lab_room || '');
                    case 'faculty-asc':
                        return (a.faculty_name || '').localeCompare(b.faculty_name || '');
                    case 'subject-asc':
                        return (a.subject || '').localeCompare(b.subject || '');
                    case 'day-time':
                    default: {
                        const dA = DAY_ORDER[(a.day_of_week || '').toUpperCase()] || 99;
                        const dB = DAY_ORDER[(b.day_of_week || '').toUpperCase()] || 99;
                        if (dA !== dB) return dA - dB;
                        return (a.time_start || '').localeCompare(b.time_start || '');
                    }
                }
            });

            this.updateStats();
            this.updateResultsCount();
            this.renderActiveFilters();
            this.render();
        }

        render() {
            if (this.state.currentView === 'table') this.renderTable();
            else if (this.state.currentView === 'calendar' && this.options.enableCalendar) this.renderCalendar();
            else if (this.state.currentView === 'chart' && this.options.enableChart) this.renderChart();
        }

        renderActiveFilters() {
            if (!this.dom.activeFilters) return;
            const tags = [];
            const icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            const push = (label, value, key) => tags.push(`<span class="filter-tag"><span class="filter-tag-label">${label}:</span> ${value} <button class="filter-tag-remove" data-clear="${key}">${icon}</button></span>`);

            if (this.dom.labFilter?.value) push('Lab', this.dom.labFilter.value, 'lab');
            if (this.dom.dayFilter?.value) {
                const label = this.dom.dayFilter.options[this.dom.dayFilter.selectedIndex]?.text || this.dom.dayFilter.value;
                push('Day', label, 'day');
            }
            if (this.dom.facultyFilter?.value) push('Faculty', this.dom.facultyFilter.value, 'faculty');
            if (this.dom.statusFilter?.value) push('Status', this.dom.statusFilter.options[this.dom.statusFilter.selectedIndex]?.text || this.dom.statusFilter.value, 'status');
            if (this.dom.searchInput?.value) push('Search', `"${this.dom.searchInput.value.trim()}"`, 'search');
            if (this.dom.sortSelect && this.dom.sortSelect.value !== 'day-time') {
                const label = this.dom.sortSelect.options[this.dom.sortSelect.selectedIndex]?.text || this.dom.sortSelect.value;
                push('Sort', label, 'sort');
            }
            this.dom.activeFilters.innerHTML = tags.join('');
        }

        updateStats() {
            const set = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            set('total-schedules-count', this.state.allSchedules.length);
            set('active-labs-count', [...new Set(this.state.allSchedules.map(s => s.lab_room).filter(Boolean))].length);
            set('total-faculty-count', [...new Set(this.state.allSchedules.map(s => s.faculty_name).filter(Boolean))].length);
            set('total-subjects-count', [...new Set(this.state.allSchedules.map(s => s.subject).filter(Boolean))].length);
        }

        updateResultsCount() {
            if (!this.dom.resultsCount) return;
            const total = this.state.allSchedules.length;
            const shown = this.state.filteredSchedules.length;
            this.dom.resultsCount.textContent = shown === total
                ? `${total} schedule${total !== 1 ? 's' : ''}`
                : `${shown} of ${total} schedule${total !== 1 ? 's' : ''}`;
        }

        renderTable() {
            if (!this.dom.tableBody) return;
            const { currentPage, itemsPerPage } = this.state.pagination;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const pageItems = this.state.filteredSchedules.slice(startIndex, startIndex + itemsPerPage);

            if (!pageItems.length) {
                this.dom.tableBody.innerHTML = `<tr><td colspan="${this.hasActions() ? 9 : 8}" style="text-align:center;padding:2rem;">No schedules found</td></tr>`;
                this.renderPagination(0);
                return;
            }

            this.dom.tableBody.innerHTML = pageItems.map((s) => this.tableRowHtml(s)).join('');
            this.bindActionButtons();
            this.bindInfoEvents();
            this.renderPagination(this.state.filteredSchedules.length);
        }

        tableRowHtml(schedule) {
            let dayLabel = schedule.schedule_date
                ? SmartLab.Core.Utils.formatDate(schedule.schedule_date)
                : (schedule.day_of_week || '—');
            const statusBadge = this.getScheduleStatusPills(schedule);
            if (statusBadge) {
                dayLabel = `${dayLabel} ${statusBadge}`;
            }
            const cells = `
                <td>${schedule.lab_room || '—'}</td>
                <td>${schedule.faculty_name || '—'}</td>
                <td>${schedule.program || '—'}</td>
                <td>${schedule.year_level || '—'}</td>
                <td>${schedule.subject || '—'}</td>
                <td>${dayLabel}</td>
                <td>${SmartLab.Core.Utils.formatTime(schedule.time_start)}</td>
                <td>${SmartLab.Core.Utils.formatTime(schedule.time_end)}</td>`;

            if (!this.hasActions()) return `<tr>${cells}</tr>`;

            const actions = [];
            if (this.options.permissions.canEdit && typeof this.options.callbacks.onEdit === 'function') {
                actions.push(`<button class="btn btn-icon edit-action" data-action="edit" data-id="${schedule.schedule_id}" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5l3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>`);
            }
            if (this.options.permissions.canDelete && typeof this.options.callbacks.onDelete === 'function') {
                actions.push(`<button class="btn btn-icon delete-action" data-action="delete" data-id="${schedule.schedule_id}" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>`);
            }
            const actionCell = `<td class="actions-cell"><div class="action-buttons">${actions.join('')}</div></td>`;
            const idAttr = schedule.schedule_id !== undefined && schedule.schedule_id !== null
                ? ` data-schedule-id="${schedule.schedule_id}"`
                : '';
            return `<tr${idAttr}>${cells}${actionCell}</tr>`;
        }

        hasActions() {
            return this.options.permissions.canEdit || this.options.permissions.canDelete;
        }

        bindActionButtons() {
            if (!this.hasActions()) return;
            this.dom.tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const schedule = this.state.allSchedules.find(s => s.schedule_id === id);
                    this.options.callbacks.onEdit?.(schedule, this);
                });
            });
            this.dom.tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const schedule = this.state.allSchedules.find(s => s.schedule_id === id);
                    this.options.callbacks.onDelete?.(schedule, this);
                });
            });
        }

        renderPagination(total) {
            if (!this.dom.pagination) return;
            const { itemsPerPage, currentPage } = this.state.pagination;
            const totalPages = Math.ceil(total / itemsPerPage);
            if (totalPages <= 1) {
                this.dom.pagination.innerHTML = '';
                return;
            }
            const start = ((currentPage - 1) * itemsPerPage) + 1;
            const end = Math.min(currentPage * itemsPerPage, total);
            let controls = '<div class="pagination-controls">';
            controls += this.paginationButton('prev', currentPage - 1, currentPage === 1);
            for (let i = 1; i <= totalPages; i++) {
                const show = i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1;
                if (show) {
                    controls += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (Math.abs(i - currentPage) === 2) {
                    controls += '<span class="pagination-btn" disabled>...</span>';
                }
            }
            controls += this.paginationButton('next', currentPage + 1, currentPage === totalPages);
            controls += '</div>';

            this.dom.pagination.innerHTML = `<div class="pagination-info">Showing ${start} to ${end} of ${total} schedules</div>${controls}`;
            this.dom.pagination.querySelectorAll('[data-page]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = Number(btn.dataset.page);
                    if (page && page !== this.state.pagination.currentPage) {
                        this.state.pagination.currentPage = page;
                        this.renderTable();
                    }
                });
            });
        }

        paginationButton(type, targetPage, disabled) {
            const icon = type === 'prev'
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>';
            return `<button class="pagination-btn" ${disabled ? 'disabled' : ''} data-page="${targetPage}">${icon}</button>`;
        }

        switchView(view) {
            if (view === this.state.currentView) return;
            this.state.currentView = view;
            this.dom.viewTabs?.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));

            const tableView = document.getElementById('schedule-table-view');
            const calendarView = document.getElementById('schedule-calendar-view');
            const pagination = this.dom.pagination;
            const chartContainer = document.getElementById('chart-placeholder');

            tableView?.classList.add('hidden');
            calendarView?.classList.add('hidden');
            if (pagination) pagination.style.display = view === 'table' ? 'flex' : 'none';
            if (chartContainer) chartContainer.style.display = view === 'chart' ? 'block' : 'none';

            if (view === 'table') {
                tableView?.classList.remove('hidden');
                if (chartContainer && view !== 'chart') {
                    chartContainer.style.display = 'none';
                }
            } else if (view === 'calendar' && this.options.enableCalendar) {
                calendarView?.classList.remove('hidden');
            }
            this.render();
        }

        renderCalendar() {
            if (!this.options.enableCalendar || !this.dom.calendarGrid) return;
            const year = this.state.calendarDate.getFullYear();
            const month = this.state.calendarDate.getMonth();
            const today = new Date();
            if (this.dom.calendarLabel) {
                this.dom.calendarLabel.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
            }

            this.buildLabColorMap();
            const JS_DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const recurringByDay = {};
            const oneTimeByDate = {};
            this.state.filteredSchedules.forEach((s) => {
                if (s.schedule_date) {
                    const key = String(s.schedule_date).slice(0, 10);
                    (oneTimeByDate[key] = oneTimeByDate[key] || []).push(s);
                } else {
                    const dayKey = (s.day_of_week || '').toUpperCase();
                    (recurringByDay[dayKey] = recurringByDay[dayKey] || []).push(s);
                }
            });

            Object.values(recurringByDay).forEach(list => list.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')));
            Object.values(oneTimeByDate).forEach(list => list.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')));

            const getSchedulesForDate = (dateObj) => {
                const dayName = JS_DAY_NAMES[dateObj.getDay()];
                const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                return [...(recurringByDay[dayName] || []), ...(oneTimeByDate[key] || [])];
            };

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const prevMonthDays = new Date(year, month, 0).getDate();
            const cells = [];
            for (let i = firstDay - 1; i >= 0; i--) cells.push(this.calendarCell(prevMonthDays - i, true, false, []));
            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, month, day);
                const isToday = dateObj.toDateString() === today.toDateString();
                cells.push(this.calendarCell(day, false, isToday, getSchedulesForDate(dateObj)));
            }
            while (cells.length % 7 !== 0) cells.push(this.calendarCell(cells.length % 7 + 1, true, false, []));
            this.dom.calendarGrid.innerHTML = cells.join('');
            this.dom.calendarGrid.onclick = (e) => {
                const cell = e.target.closest('.cal-day-cell:not(.outside)');
                if (!cell) return;
                const day = Number(cell.dataset.day);
                if (!day) return;
                const date = new Date(year, month, day);
                const schedules = getSchedulesForDate(date);
                this.showDayModal(date, schedules);
            };
        }

        calendarCell(dayNum, isOutside, isToday, schedules) {
            const maxPills = 3;
            const classes = ['cal-day-cell'];
            if (isOutside) classes.push('outside');
            if (isToday) classes.push('today');
            let inner = `<div class="cal-day-number">${dayNum}</div>`;
            if (!isOutside && schedules.length) {
                inner += '<div class="cal-schedule-dots">';
                schedules.slice(0, maxPills).forEach((s) => {
                    const color = this.state.labColorMap[s.lab_room] || '#6b7280';
                    inner += `<div class="cal-schedule-pill" style="background:${color}" title="${this.escape(s.subject || '')}">${this.escape(s.subject || s.lab_room || 'Class')}</div>`;
                });
                if (schedules.length > maxPills) {
                    inner += `<div class="cal-more-label">+${schedules.length - maxPills} more</div>`;
                }
                inner += '</div>';
            }
            return `<div class="${classes.join(' ')}"${isOutside ? '' : ` data-day="${dayNum}"`}>${inner}</div>`;
        }

        showDayModal(date, schedules) {
            const existing = document.getElementById('cal-day-modal-overlay');
            existing?.remove();
            const overlay = document.createElement('div');
            overlay.id = 'cal-day-modal-overlay';
            overlay.className = 'cal-day-modal-overlay';
            const title = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
            let body = '';
            if (!schedules.length) {
                body = '<div class="cal-no-schedules">No schedules on this day.</div>';
            } else {
                body = schedules.map((s) => {
                    const color = this.state.labColorMap[s.lab_room] || '#6b7280';
                    const badge = s.schedule_date
                        ? '<span style="display:inline-block;padding:2px 8px;font-size:0.72rem;font-weight:600;border-radius:999px;background:#fef3c7;color:#92400e;">One-time</span>'
                        : '<span style="display:inline-block;padding:2px 8px;font-size:0.72rem;font-weight:600;border-radius:999px;background:#dbeafe;color:#1e3a8a;">Recurring</span>';
                    return `<div class="cal-sched-card" style="border-left-color:${color}">
                        <div class="cal-sched-subject">${this.escape(s.subject || 'Untitled')} ${badge}</div>
                        <div class="cal-sched-meta">
                            <span>🕐 ${SmartLab.Core.Utils.formatTimeRange(s.time_start, s.time_end)}</span>
                            <span>📍 ${this.escape(s.lab_room || '—')}</span>
                            <span>👤 ${this.escape(s.faculty_name || '—')}</span>
                        </div>
                    </div>`;
                }).join('');
            }
            overlay.innerHTML = `
                <div class="cal-day-modal">
                    <div class="cal-day-modal-header">
                        <h4>${this.escape(title)} <span class="count">(${schedules.length} schedule${schedules.length !== 1 ? 's' : ''})</span></h4>
                        <button class="cal-day-modal-close" title="Close">&times;</button>
                    </div>
                    <div class="cal-day-modal-body">${body}</div>
                </div>`;
            this.dom.root?.appendChild(overlay);
            overlay.querySelector('.cal-day-modal-close')?.addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        }

        buildLabColorMap() {
            this.state.labColorMap = {};
            [...new Set(this.state.allSchedules.map(s => s.lab_room).filter(Boolean))]
                .sort()
                .forEach((lab, idx) => {
                    this.state.labColorMap[lab] = this.state.labColors[idx % this.state.labColors.length];
                });
        }

        renderChart() {
            const tableView = document.getElementById('schedule-table-view');
            const calendarView = document.getElementById('schedule-calendar-view');
            tableView?.classList.add('hidden');
            calendarView?.classList.add('hidden');

            let container = document.getElementById('chart-placeholder');
            if (!container) {
                container = document.createElement('div');
                container.id = 'chart-placeholder';
                container.dataset.component = 'GanttChart';
                this.dom.root?.querySelector('.cardBody')?.appendChild(container);
            }
            container.style.display = 'block';

            const dataset = this.state.filteredSchedules.length ? this.state.filteredSchedules : this.state.allSchedules;
            const labLabels = this.getLabLabels();
            const chartLabs = labLabels.length ? labLabels : (dataset[0]?.lab_room ? [dataset[0].lab_room] : []);
            const defaultLab = chartLabs[0] || this.options.defaultLab || 'Lab 1';
            const labAliasMap = chartLabs.reduce((map, label) => {
                map[this.normalizeLabLabel(label)] = label;
                return map;
            }, {});
            const chartDataset = dataset.map(item => {
                const normalized = this.normalizeLabLabel(item.lab_room);
                if (labAliasMap[normalized]) {
                    return { ...item, lab_room: labAliasMap[normalized] };
                }
                return item;
            });

            if (!this.state.ganttChartInstance) {
                this.state.ganttChartInstance = SmartLab.Core.Components.create('GanttChart', container, {
                    schedules: chartDataset,
                    labs: chartLabs,
                    defaultLab,
                    colorKey: [
                        (s) => s.faculty_id && String(s.faculty_id),
                        (s) => s.faculty_name || s.full_name
                    ],
                    onScheduleClick: (schedule) => {
                        if (typeof this.options.callbacks.onInfo === 'function') {
                            this.options.callbacks.onInfo(schedule, this);
                        } else {
                            this.options.callbacks.onEdit?.(schedule, this);
                        }
                    }
                });
                this.state.ganttChartInstance?.init?.();
            } else {
                this.state.ganttChartInstance.updateLabs(chartLabs);
                this.state.ganttChartInstance.updateSchedules(chartDataset);
                this.state.ganttChartInstance.setLab?.(defaultLab);
            }
        }

        clearFilters() {
            if (this.dom.labFilter) this.dom.labFilter.value = '';
            if (this.dom.dayFilter) this.dom.dayFilter.value = '';
            if (this.dom.facultyFilter) this.dom.facultyFilter.value = '';
            if (this.dom.statusFilter) this.dom.statusFilter.value = '';
            if (this.dom.sortSelect) this.dom.sortSelect.value = 'day-time';
            if (this.dom.searchInput) this.dom.searchInput.value = '';
            this.state.pagination.currentPage = 1;
            this.applyFilters();
        }

        clearSingleFilter(target) {
            switch (target) {
                case 'lab': if (this.dom.labFilter) this.dom.labFilter.value = ''; break;
                case 'day': if (this.dom.dayFilter) this.dom.dayFilter.value = ''; break;
                case 'faculty': if (this.dom.facultyFilter) this.dom.facultyFilter.value = ''; break;
                case 'status': if (this.dom.statusFilter) this.dom.statusFilter.value = ''; break;
                case 'search': if (this.dom.searchInput) this.dom.searchInput.value = ''; break;
                case 'sort': if (this.dom.sortSelect) this.dom.sortSelect.value = 'day-time'; break;
            }
            this.state.pagination.currentPage = 1;
            this.applyFilters();
        }

        // ===== Admin helpers exposed for ModalManager / callbacks =====
        checkScheduleConflict(candidate) {
            return this.state.allSchedules.find((existing) => {
                if (existing.lab_room !== candidate.lab_room) return false;
                if (existing.day_of_week !== candidate.day_of_week) return false;
                if (this.academicContext) {
                    if (existing.academic_year_id !== this.academicContext.academic_year_id) return false;
                    if (existing.term_id !== this.academicContext.term_id) return false;
                }
                const existingStart = this.timeToMinutes(existing.time_start);
                const existingEnd = this.timeToMinutes(existing.time_end);
                const newStart = this.timeToMinutes(candidate.time_start);
                const newEnd = this.timeToMinutes(candidate.time_end);
                return newStart < existingEnd && newEnd > existingStart;
            });
        }

        checkEditScheduleConflict(candidate, excludeId) {
            return this.state.allSchedules.find(existing => {
                if (existing.schedule_id === excludeId) return false;
                return this.checkScheduleConflict({ ...candidate });
            });
        }

        getScheduleStatusPills(schedule) {
            const pills = [];
            const isOneTime = !!schedule.schedule_date;
            const isExpired = !!schedule.is_expired;
            const isTodayOneTime = isOneTime && this.isSameDate(schedule.schedule_date, new Date());
            const isTodayRecurring = !isOneTime && this.isTodayDay(schedule.day_of_week);

            if (isOneTime) {
                if (isExpired) {
                    pills.push('<span class="schedule-status schedule-status--expired">Expired</span>');
                } else {
                    pills.push('<span class="schedule-status schedule-status--upcoming">Upcoming</span>');
                }
                if (!isExpired && isTodayOneTime) {
                    pills.push('<span class="schedule-status schedule-status--today">Today</span>');
                }
            } else if (isTodayRecurring) {
                pills.push('<span class="schedule-status schedule-status--today">Today</span>');
            }

            return pills.join('');
        }

        isSameDate(dateA, dateB) {
            if (!dateA || !dateB) return false;
            const dA = new Date(dateA);
            return dA.getFullYear() === dateB.getFullYear()
                && dA.getMonth() === dateB.getMonth()
                && dA.getDate() === dateB.getDate();
        }

        isTodayDay(day) {
            if (!day) return false;
            const today = new Date().toLocaleString('en-US', { weekday: 'long', timeZone: 'Asia/Manila' }).toUpperCase();
            return today === String(day).toUpperCase();
        }

        timeToMinutes(timeStr) {
            if (!timeStr) return 0;
            const time = String(timeStr);
            if (!time.includes(' ')) {
                const [h, m] = time.substring(0, 5).split(':').map(Number);
                return (h * 60) + (m || 0);
            }
            const [clock, period] = time.split(' ');
            let [hours, minutes] = clock.split(':').map(Number);
            if (period?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
            if (period?.toLowerCase() === 'am' && hours === 12) hours = 0;
            return (hours * 60) + (minutes || 0);
        }

        escape(value) {
            return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    }

    root.Core.Components.ScheduleViewer = ScheduleViewer;
})();
