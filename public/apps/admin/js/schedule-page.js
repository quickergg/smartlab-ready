/* =========================================
   SmartLab Admin - Lab Schedule Page (Shared ScheduleViewer wrapper)
========================================= */

(function () {
    class AdminSchedulePage {
        constructor() {
            this.viewer = null;
        }

        async init() {
            if (!window.SmartLab?.Core?.Components?.ScheduleViewer) {
                console.error('ScheduleViewer component not found.');
                return;
            }

            this.viewer = new SmartLab.Core.Components.ScheduleViewer({
                permissions: { canAdd: true, canEdit: true, canDelete: true },
                callbacks: {
                    onAdd: () => this.showAddScheduleModal(),
                    onEdit: (schedule) => this.showEditScheduleModal(schedule),
                    onDelete: (schedule) => this.deleteSchedule(schedule),
                    onInfo: (schedule) => this.showScheduleInfoModal(schedule)
                }
            });

            // Keep legacy references working (ModalManager conflict checks, etc.)
            window.scheduleManager = this.viewer;

            await this.viewer.init();
        }

        async showAddScheduleModal() {
            try {
                await ModalManager.show('add-schedule', {
                    onSuccess: () => this.viewer.reload()
                });
            } catch (error) {
                console.error('AdminSchedulePage: Error opening add schedule modal', error);
                this.showToast('Failed to open add schedule modal', 'error');
            }
        }

        async showEditScheduleModal(schedule) {
            if (!schedule?.schedule_id) return;
            try {
                await ModalManager.show('edit-schedule', {
                    scheduleId: schedule.schedule_id,
                    onSuccess: () => this.viewer.reload()
                });
            } catch (error) {
                console.error('AdminSchedulePage: Error opening edit schedule modal', error);
                this.showToast('Failed to open edit schedule modal', 'error');
            }
        }

        async deleteSchedule(schedule) {
            if (!schedule?.schedule_id) return;
            const ok = await SmartLab.Core.UI.confirm(
                'Are you sure you want to delete this schedule? This action cannot be undone.',
                'Delete Schedule',
                { type: 'danger', confirmText: 'Delete' }
            );
            if (!ok) return;

            try {
                const res = await fetch(`/api/labSchedule/${schedule.schedule_id}`, {
                    method: 'DELETE',
                    headers: SmartLab.Core.Auth.getAuthHeaders()
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to delete schedule');
                }
                this.showToast('Schedule deleted successfully', 'success');
                await this.viewer.reload();
            } catch (error) {
                console.error('AdminSchedulePage: Error deleting schedule', error);
                this.showToast(error.message || 'Failed to delete schedule', 'error');
            }
        }

        showToast(message, type = 'info') {
            window.SmartLab?.Core?.UI?.showToast?.(message, type);
        }

        showScheduleInfoModal(schedule) {
            if (!schedule) return;
            document.querySelector('.sd-modal-overlay')?.remove();

            const esc = (v) => String(v ?? '')
                .replace(/&/g,'&amp;')
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;');
            const initials = (schedule.faculty_name || schedule.full_name || '?')
                .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            const overlay = document.createElement('div');
            overlay.className = 'sd-modal-overlay';
            overlay.innerHTML = `
                <div class="sd-modal">
                    <div class="sd-header">
                        <div class="sd-header-left">
                            <span class="sd-day-badge">${esc(schedule.day_of_week || SmartLab.Core.Utils.formatDate(schedule.schedule_date) || '-')}</span>
                        </div>
                        <button class="sd-close" title="Close">&times;</button>
                    </div>
                    <div class="sd-body">
                        <h3 class="sd-title">Schedule Details</h3>

                        <div class="sd-requester-card">
                            <div class="sd-avatar">${initials}</div>
                            <div class="sd-requester-info">
                                <span class="sd-requester-name">${esc(schedule.faculty_name || schedule.full_name || '-')}</span>
                                <span class="sd-requester-meta">Faculty</span>
                            </div>
                        </div>

                        <div class="sd-grid">
                            <div class="sd-field">
                                <span class="sd-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    Lab Room
                                </span>
                                <span class="sd-value">${esc(schedule.lab_room || '-')}</span>
                            </div>
                            <div class="sd-field">
                                <span class="sd-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                    Subject
                                </span>
                                <span class="sd-value">${esc(schedule.subject || '-')}</span>
                            </div>
                            <div class="sd-field">
                                <span class="sd-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    Day
                                </span>
                                <span class="sd-value">${esc(schedule.day_of_week || SmartLab.Core.Utils.formatDate(schedule.schedule_date) || '-')}</span>
                            </div>
                            <div class="sd-field">
                                <span class="sd-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                                    Time
                                </span>
                                <span class="sd-value">${SmartLab.Core.Utils.formatTimeRange(schedule.time_start, schedule.time_end)}</span>
                            </div>
                            <div class="sd-field">
                                <span class="sd-label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                    Program &amp; Year
                                </span>
                                <span class="sd-value">${esc(schedule.program_code || '-')}${schedule.year_level ? ' - Year ' + schedule.year_level : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="sd-footer">
                        <button class="sd-close-btn">Close</button>
                    </div>
                </div>`;

            document.querySelector('.schedule-page')?.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('active'));

            const removeModal = () => overlay.remove();
            overlay.querySelector('.sd-close')?.addEventListener('click', removeModal);
            overlay.querySelector('.sd-close-btn')?.addEventListener('click', removeModal);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) removeModal(); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    removeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            });
        }
    }

    function initAdminSchedulePage() {
        if (!document.querySelector('.schedule-page')) return;
        window.adminSchedulePage = new AdminSchedulePage();
        window.adminSchedulePage.init();
    }

    window.initAdminSchedulePage = initAdminSchedulePage;

    document.addEventListener('DOMContentLoaded', initAdminSchedulePage);
    if (document.readyState !== 'loading') {
        initAdminSchedulePage();
    }
})();
