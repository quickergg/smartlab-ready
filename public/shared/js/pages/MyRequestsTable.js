(function () {
    const root = window.SmartLab = window.SmartLab || {};
    root.Core = root.Core || {};
    root.Core.Pages = root.Core.Pages || {};

    class MyRequestsTable {
        constructor(options = {}) {
            this.role = (options.role || 'student').toLowerCase();
            this.tableSelector = options.tableSelector || '#my-requests-tbody';
            this.paginationSelector = options.paginationSelector || '#my-requests-pagination';
            this.fetchUrl = options.fetchUrl;
            this.getAuthHeaders = options.getAuthHeaders || (() => ({}));
            this.getUserId = options.getUserId || (() => Number(sessionStorage.getItem('user_id')));
            this.itemsPerPage = Number(options.itemsPerPage) || 10;
            this.columnCount = Number(options.columnCount) || 8;
            this.emptyCopy = options.emptyCopy || 'No records found.';
            this.loadingCopy = options.loadingCopy || 'Loading...';
            this.errorCopy = options.errorCopy || 'Failed to load requests.';
            this.sessionExpiredCopy = options.sessionExpiredCopy || 'Session expired. Please log in again.';
            this.buildRoomLabel = options.buildRoomLabel || ((row) => row.location || '-');
            this.buildEquipmentLabel = options.buildEquipmentLabel || ((row) => (row.equipment_list && row.equipment_list.trim()) ? row.equipment_list : '-');
            this.buildNoteLabel = options.buildNoteLabel || ((row) => (row.note && String(row.note).trim()) ? String(row.note).trim() : '-');
            this.getStatusClass = options.getStatusClass || ((statusName) => {
                const s = String(statusName || '').toLowerCase();
                if (s.includes('approve')) return 'status-approved';
                if (s.includes('borrow')) return 'status-borrowed';
                if (s.includes('decline')) return 'status-declined';
                if (s.includes('cancel')) return 'status-cancelled';
                if (s.includes('return')) return 'status-returned';
                return 'status-pending';
            });
            this.formatDate = options.formatDate || ((val) => {
                if (window.SmartLab?.Core?.Utils?.formatDate) {
                    return SmartLab.Core.Utils.formatDate(val);
                }
                return val || '-';
            });
            this.formatTimeRange = options.formatTimeRange || ((start, end) => {
                if (window.SmartLab?.Core?.Utils?.formatTimeRange) {
                    return SmartLab.Core.Utils.formatTimeRange(start, end);
                }
                return `${start || '-'} - ${end || '-'}`;
            });
            this.canCancel = options.canCancel || ((row) => {
                const status = String(row?.status_name || '').toLowerCase();
                return row?.borrow_request_id && ['pending', 'approved'].includes(status);
            });
            this.confirmCancelTitle = options.confirmCancelTitle || 'Cancel Request';
            this.confirmCancelMessage = options.confirmCancelMessage || 'Cancel this request? This action cannot be undone.';
            this.cancelSuccessMessage = options.cancelSuccessMessage || 'Request cancelled successfully.';
            this.cancelButtonLabel = options.cancelButtonLabel || 'Cancel';
            this.onCancelRequest = typeof options.onCancelRequest === 'function' ? options.onCancelRequest : null;
            this.showToast = options.showToast || ((msg, type) => window.SmartLab?.Core?.UI?.showToast?.(msg, type));
            this.watchCancelOutcome = options.watchCancelOutcome || (() => Promise.resolve());

            this.state = {
                data: [],
                currentPage: 1
            };
        }

        resolveElement(ref) {
            if (!ref) return null;
            if (ref instanceof HTMLElement) return ref;
            if (typeof ref === 'string') return document.querySelector(ref);
            return null;
        }

        async init() {
            this.tableEl = this.resolveElement(this.tableSelector);
            this.paginationEl = this.resolveElement(this.paginationSelector);

            if (!this.tableEl) {
                console.error('MyRequestsTable: table element not found.');
                return;
            }

            await this.loadData();
        }

        async reload() {
            await this.loadData();
        }

        async loadData() {
            const userId = this.getUserId();
            if (!userId) {
                this.renderMessage(this.sessionExpiredCopy);
                this.togglePagination(false);
                return;
            }

            if (this.tableEl) {
                this.renderMessage(this.loadingCopy);
            }

            const url = typeof this.fetchUrl === 'function' ? this.fetchUrl(userId) : this.fetchUrl;
            if (!url) {
                console.error('MyRequestsTable: fetchUrl not provided.');
                this.renderMessage(this.errorCopy, true);
                this.togglePagination(false);
                return;
            }

            try {
                const res = await fetch(url, { headers: this.getAuthHeaders() });
                const payload = await res.json().catch(() => ([]));
                if (!res.ok) {
                    const message = payload?.message || this.errorCopy;
                    throw new Error(message);
                }

                const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
                this.state.data = rows;
                this.state.currentPage = 1;
                this.renderTable();
            } catch (err) {
                console.error('MyRequestsTable: load failed', err);
                this.renderMessage(err.message || this.errorCopy, true);
                this.togglePagination(false);
            }
        }

        renderMessage(message, isError = false) {
            if (!this.tableEl) return;
            const cls = isError ? ' style="color:red;text-align:center;"' : ' style="text-align:center;"';
            this.tableEl.innerHTML = `<tr><td colspan="${this.columnCount}"${cls}>${this.escapeHtml(message)}</td></tr>`;
        }

        renderTable() {
            if (!this.tableEl) return;
            const rows = Array.isArray(this.state.data) ? this.state.data : [];
            if (!rows.length) {
                this.renderMessage(this.emptyCopy);
                this.togglePagination(false);
                return;
            }

            const startIndex = (this.state.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageItems = rows.slice(startIndex, endIndex);

            this.tableEl.innerHTML = pageItems.map(row => this.buildRow(row)).join('');
            this.bindActionEvents();
            this.renderPagination(rows.length);
        }

        buildRow(row) {
            const createdDate = this.escapeHtml(this.formatDate(row.created_at));
            const room = this.escapeHtml(this.buildRoomLabel(row));
            const equipment = this.escapeHtml(this.buildEquipmentLabel(row));
            const dateNeeded = this.escapeHtml(this.formatDate(row.date_needed));
            const timeRange = this.escapeHtml(this.formatTimeRange(row.time_start || row.time_of_use, row.time_end));
            const note = this.escapeHtml(this.buildNoteLabel(row));
            const statusName = row.status_name || 'Pending';
            const statusCls = this.escapeHtml(this.getStatusClass(statusName));
            const actions = this.buildActions(row);

            return `
                <tr>
                    <td>${createdDate}</td>
                    <td>${room}</td>
                    <td>${equipment}</td>
                    <td>${dateNeeded}</td>
                    <td>${timeRange}</td>
                    <td>${note}</td>
                    <td><span class="pill ${statusCls}">${this.escapeHtml(statusName)}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
        }

        buildActions(row) {
            const requestId = row?.borrow_request_id;
            if (!this.onCancelRequest || !this.canCancel(row) || !requestId) {
                return '<span class="request-action-empty">No actions</span>';
            }

            return `
                <div class="request-actions">
                    <button type="button" class="request-action-btn" data-action="cancel-request" data-request-id="${requestId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        ${this.escapeHtml(this.cancelButtonLabel)}
                    </button>
                </div>
            `;
        }

        renderPagination(totalItems) {
            if (!this.paginationEl) return;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            if (totalPages <= 1) {
                this.paginationEl.innerHTML = '';
                this.paginationEl.style.display = 'none';
                return;
            }

            const start = ((this.state.currentPage - 1) * this.itemsPerPage) + 1;
            const end = Math.min(this.state.currentPage * this.itemsPerPage, totalItems);

            const info = `<div class="pagination-info">Showing ${start} to ${end} of ${totalItems} requests</div>`;
            const controls = this.buildPaginationControls(totalPages);

            this.paginationEl.innerHTML = info + controls;
            this.paginationEl.style.display = '';
            this.bindPaginationEvents();
        }

        buildPaginationControls(totalPages) {
            const currentPage = this.state.currentPage;
            let html = '<div class="pagination-controls">';

            html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
            </button>`;

            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                    html += '<span class="pagination-btn" disabled>...</span>';
                }
            }

            html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
            </button>`;

            html += '</div>';
            return html;
        }

        bindPaginationEvents() {
            if (!this.paginationEl) return;
            this.paginationEl.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = Number(btn.dataset.page);
                    if (!page || page === this.state.currentPage || page < 1) return;
                    this.state.currentPage = page;
                    this.renderTable();
                });
            });
        }

        bindActionEvents() {
            if (!this.tableEl) return;
            this.tableEl.querySelectorAll('button[data-action="cancel-request"]').forEach(btn => {
                if (btn._cancelHandlerAttached) return;
                btn._cancelHandlerAttached = true;
                btn.addEventListener('click', () => {
                    const requestId = Number(btn.dataset.requestId);
                    if (!requestId) return;
                    this.handleCancel(requestId, btn);
                });
            });
        }

        async handleCancel(requestId, buttonEl) {
            if (!this.onCancelRequest) return;
            const confirmFn = window.SmartLab?.Core?.UI?.confirm;
            const ok = confirmFn
                ? await confirmFn(this.confirmCancelMessage, this.confirmCancelTitle, { type: 'warning', confirmText: 'Yes, Cancel' })
                : window.confirm(this.confirmCancelMessage);
            if (!ok) return;

            buttonEl.disabled = true;
            buttonEl.classList.add('is-loading');

            try {
                await this.onCancelRequest(requestId);
                this.showToast?.(this.cancelSuccessMessage, 'success');
                await this.reload();
            } catch (err) {
                console.error('MyRequestsTable: cancel failed', err);
                const message = err?.message || 'Failed to cancel request. Please try again.';
                this.showToast?.(message, 'error');
            } finally {
                buttonEl.disabled = false;
                buttonEl.classList.remove('is-loading');
            }
        }

        togglePagination(show) {
            if (!this.paginationEl) return;
            this.paginationEl.style.display = show ? '' : 'none';
            if (!show) {
                this.paginationEl.innerHTML = '';
            }
        }

        escapeHtml(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }
    }

    root.Core.Pages.MyRequestsTable = MyRequestsTable;
})();
