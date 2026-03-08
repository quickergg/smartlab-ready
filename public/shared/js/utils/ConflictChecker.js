/* =========================================
   SmartLab – Conflict Detection Utility
   Checks lab room + date + time against
   existing schedules and borrow requests.
========================================= */

class ConflictChecker {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.debounceTimer = null;
        this.lastCheck = null;
        this.isChecking = false;
    }

    // =========================================
    // Public API
    // =========================================

    /**
     * Check for conflicts with the given parameters.
     * Calls the backend API and renders results in the container.
     * @param {Object} params - { lab_room, date_needed, time_start, time_end }
     * @returns {Promise<Object>} - { hasConflict, conflicts }
     */
    async check(params) {
        const { lab_room, room_id, date_needed, time_start, time_end, equipment_ids, equipment_quantities, include_pending_requests, include_requests, exclude_schedule_id } = params;

        // Don't check if required fields are missing
        if (!lab_room || !date_needed || !time_start || !time_end) {
            this.clear();
            return { hasConflict: false, conflicts: [] };
        }

        // Don't check if time_end <= time_start
        if (time_end <= time_start) {
            this.clear();
            return { hasConflict: false, conflicts: [] };
        }

        // Skip duplicate check (include equipment in key)
        const eqKey = (equipment_ids || []).sort().join(',') + '|' + JSON.stringify(equipment_quantities || {});
        const exKey = exclude_schedule_id ? `|EX-${exclude_schedule_id}` : '';
        const checkKey = `${lab_room}|${date_needed}|${time_start}|${time_end}|${eqKey}|${include_pending_requests !== false}${exKey}`;
        if (this.lastCheck === checkKey) {
            return this._lastResult || { hasConflict: false, conflicts: [] };
        }

        this.lastCheck = checkKey;
        this.isChecking = true;
        this.renderLoading();

        try {
            const body = { lab_room, date_needed, time_start, time_end };
            if (room_id) {
                body.room_id = room_id;
            }
            if (exclude_schedule_id) {
                body.exclude_schedule_id = exclude_schedule_id;
            }
            if (typeof include_pending_requests !== 'undefined') {
                body.include_pending_requests = include_pending_requests;
            }
            if (typeof include_requests !== 'undefined') {
                body.include_requests = include_requests;
            }
            if (equipment_ids && equipment_ids.length > 0) {
                body.equipment_ids = equipment_ids;
                body.equipment_quantities = equipment_quantities || {};
            }

            const res = await fetch('/api/conflicts/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Conflict check failed');
            }

            const data = await res.json();
            this._lastResult = data;
            this.render(data);
            return data;

        } catch (err) {
            console.error('ConflictChecker: Error:', err);
            this.renderError(err.message);
            return { hasConflict: false, conflicts: [], error: err.message };
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Debounced check — waits 400ms after last call before executing.
     * Ideal for binding to input change events.
     */
    checkDebounced(params) {
        return new Promise((resolve) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const result = await this.check(params);
                resolve(result);
            }, 400);
        });
    }

    /**
     * Clear the conflict display and reset state.
     */
    clear() {
        this.lastCheck = null;
        this._lastResult = null;
        if (this.container) {
            this.container.innerHTML = '';
            this.container.style.display = 'none';
        }
    }

    // =========================================
    // Rendering
    // =========================================

    renderLoading() {
        if (!this.container) return;
        this.container.style.display = 'block';
        this.container.innerHTML = `
            <div class="conflict-loading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" class="conflict-spinner">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span>Checking for conflicts...</span>
            </div>
        `;
    }

    render(data) {
        if (!this.container) return;

        if (!data.hasConflict) {
            this.container.style.display = 'block';
            this.container.innerHTML = `
                <div class="conflict-clear" style="display:flex;align-items:center;gap:8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span style="font-size:0.9rem;color:#065f46;">No conflicts found for <strong>${this.escapeHtml(data.checked.lab_room)}</strong> on ${SmartLab.Core.Utils.formatDate(data.checked.date_needed)} (${data.checked.day_of_week}) ${SmartLab.Core.Utils.formatTimeRange(data.checked.time_start, data.checked.time_end)}</span>
                </div>
            `;
            return;
        }

        // Has conflicts
        const conflictCount = data.conflicts.length;
        let html = `
            <div class="conflict-alert">
                <div class="conflict-alert-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <strong>${conflictCount} Conflict${conflictCount > 1 ? 's' : ''} Detected</strong>
                    <span class="conflict-subtitle">for ${this.escapeHtml(data.checked.lab_room)} on ${this.escapeHtml(data.checked.date_needed)} (${data.checked.day_of_week})</span>
                </div>
                <div class="conflict-list">
        `;

        data.conflicts.forEach((conflict, i) => {
            const d = conflict.details;
            const cType = conflict.type;
            const severityClass = conflict.severity === 'high' ? 'conflict-high' : 'conflict-medium';

            // Determine badge label and class
            let badgeLabel, badgeClass;
            if (cType === 'lab_schedule') { badgeLabel = 'Schedule'; badgeClass = 'badge-schedule'; }
            else if (cType === 'equipment') { badgeLabel = 'Equipment'; badgeClass = 'badge-equipment'; }
            else { badgeLabel = 'Request'; badgeClass = 'badge-request'; }

            html += `
                <div class="conflict-item ${severityClass}">
                    <div class="conflict-item-header">
                        <span class="conflict-badge ${badgeClass}">${badgeLabel}</span>
                        <span class="conflict-severity-badge severity-${conflict.severity}">${conflict.severity === 'high' ? 'High' : 'Medium'}</span>
                    </div>
                    <div class="conflict-item-body">
                        <p class="conflict-message">${this.escapeHtml(conflict.message)}</p>
                        <div class="conflict-details">
            `;

            if (cType === 'lab_schedule') {
                html += `
                            <div class="conflict-detail-row">
                                <span class="detail-label">Time:</span>
                                <span class="detail-value">${SmartLab.Core.Utils.formatTimeRange(d.time_start, d.time_end)}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Subject:</span>
                                <span class="detail-value">${this.escapeHtml(d.subject || '-')}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Faculty:</span>
                                <span class="detail-value">${this.escapeHtml(d.faculty_name || '-')}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Program:</span>
                                <span class="detail-value">${this.escapeHtml(d.program_code || '-')}${d.year_level ? ` - ${this.escapeHtml(String(d.year_level))}` : ''}</span>
                            </div>
                `;
            } else if (cType === 'equipment') {
                html += `
                            <div class="conflict-detail-row">
                                <span class="detail-label">Equipment:</span>
                                <span class="detail-value">${this.escapeHtml(d.equipment_name || '-')}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Requested:</span>
                                <span class="detail-value">${d.requested_qty} unit${d.requested_qty > 1 ? 's' : ''}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Available on date:</span>
                                <span class="detail-value" style="font-weight:600;color:${d.available_on_date === 0 ? '#dc2626' : '#d97706'};">${d.available_on_date} unit${d.available_on_date !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Physical stock:</span>
                                <span class="detail-value">${d.physical_stock}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Approved reservations:</span>
                                <span class="detail-value">${d.reserved_approved}</span>
                            </div>
                            ${d.pending_other > 0 ? `
                            <div class="conflict-detail-row">
                                <span class="detail-label">Pending requests:</span>
                                <span class="detail-value" style="color:#d97706;">${d.pending_other}</span>
                            </div>` : ''}
                `;
            } else {
                html += `
                            <div class="conflict-detail-row">
                                <span class="detail-label">Time:</span>
                                <span class="detail-value">${SmartLab.Core.Utils.formatTimeRange(d.time_start, d.time_end)}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value conflict-status-${(d.status || '').toLowerCase()}">${this.escapeHtml(d.status || '-')}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Requested by:</span>
                                <span class="detail-value">${this.escapeHtml(d.requester_name || '-')}</span>
                            </div>
                            <div class="conflict-detail-row">
                                <span class="detail-label">Subject:</span>
                                <span class="detail-value">${this.escapeHtml(d.subject || '-')}</span>
                            </div>
                `;
            }

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div class="conflict-help">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>Please change the lab room or reschedule this request. Conflicts must be resolved before you can submit.</span>
                </div>
            </div>
        `;

        this.container.style.display = 'block';
        this.container.innerHTML = html;
    }

    renderError(message) {
        if (!this.container) return;
        this.container.style.display = 'block';
        this.container.innerHTML = `
            <div class="conflict-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>Could not check for conflicts: ${this.escapeHtml(message)}</span>
            </div>
        `;
    }

    // =========================================
    // Helpers
    // =========================================

    escapeHtml(val) {
        return String(val ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
}
