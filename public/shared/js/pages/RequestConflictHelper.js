/**
 * Shared helper wrapping ConflictChecker bindings for borrow request forms.
 */
(function () {
    const root = window.SmartLab = window.SmartLab || {};
    root.Core = root.Core || {};
    root.Core.Pages = root.Core.Pages || {};

    class RequestConflictHelper {
        constructor(options = {}) {
            this.containerId = options.containerId || 'conflict-display';
            this.role = (options.role || 'student').toLowerCase();
            this.resolveRoom = options.resolveRoom || (() => ({ label: '', id: null }));
            this.getSelectedEquipment = options.getSelectedEquipment || (() => ({ ids: [], quantities: {} }));
            this.onBlockingChange = options.onBlockingChange || (() => { });
            this.shouldCheck = options.shouldCheck || (() => true);
            this.includePending = options.includePending ?? true;
            this.includeRequests = options.includeRequests ?? false;
            this.watchFields = Array.isArray(options.watchFields) ? options.watchFields : [];
            this._checkToken = 0;
        }

        init() {
            if (typeof ConflictChecker === 'undefined') {
                console.warn('RequestConflictHelper: ConflictChecker not loaded.');
                return;
            }
            this.checker = new ConflictChecker(this.containerId);
            this.cacheInputs();
            this.bindEvents();
        }

        cacheInputs() {
            this.dateInput = document.getElementById('dateNeeded');
            this.timeStart = document.getElementById('timeStart');
            this.timeEnd = document.getElementById('timeEnd');
            this.equipmentContainer = document.getElementById('equipment-container');
        }

        bindEvents() {
            const trigger = () => this.runCheck();
            [this.dateInput, this.timeStart, this.timeEnd].forEach(el => el?.addEventListener('change', trigger));

            if (this.equipmentContainer) {
                this.equipmentContainer.addEventListener('change', (e) => {
                    if (e.target.name === 'equipment_ids[]' || e.target.name === 'requested_quantities[]') {
                        trigger();
                    }
                });
                this.equipmentContainer.addEventListener('input', (e) => {
                    if (e.target.name === 'requested_quantities[]') {
                        trigger();
                    }
                });
            }

            this.watchFields.forEach((entry) => {
                let el = entry;
                let events = ['change'];

                if (entry && typeof entry === 'object' && !('nodeType' in entry) && !('tagName' in entry) && ('element' in entry || typeof entry.element === 'function')) {
                    if (typeof entry.element === 'string') {
                        el = document.getElementById(entry.element);
                    } else if (typeof entry.element === 'function') {
                        el = entry.element();
                    } else {
                        el = entry.element;
                    }
                    events = Array.isArray(entry.events) && entry.events.length ? entry.events : ['change'];
                } else if (typeof entry === 'string') {
                    el = document.getElementById(entry);
                } else if (typeof entry === 'function') {
                    el = entry();
                }

                if (el && typeof el.addEventListener === 'function') {
                    events.forEach(evt => el.addEventListener(evt, trigger));
                }
            });
        }

        async runCheck() {
            if (!this.checker || (typeof this.shouldCheck === 'function' && !this.shouldCheck())) {
                this.clear();
                return;
            }

            const { label: labRoomLabel, id: roomId } = this.resolveRoom() || {};
            const date = this.dateInput?.value || '';
            const start = this.timeStart?.value || '';
            const end = this.timeEnd?.value || '';

            if (!labRoomLabel || !date || !start || !end || end <= start) {
                this.clear();
                return;
            }

            const { ids: equipment_ids, quantities: equipment_quantities } = this.getSelectedEquipment();
            const checkToken = ++this._checkToken;
            this.onBlockingChange(true, 'Checking for conflicts...');

            try {
                const result = await this.checker.checkDebounced({
                    lab_room: labRoomLabel,
                    room_id: roomId,
                    date_needed: date,
                    time_start: start,
                    time_end: end,
                    equipment_ids,
                    equipment_quantities,
                    include_pending_requests: this.includePending,
                    include_requests: this.includeRequests
                });

                if (checkToken !== this._checkToken) return;

                if (!result || result.error) {
                    this.onBlockingChange(false);
                    return;
                }

                if (result.hasConflict) {
                    const count = Array.isArray(result.conflicts) ? result.conflicts.length : 1;
                    const reason = count > 1
                        ? `${count} conflicts detected. Adjust schedule before submitting.`
                        : 'A conflict is detected. Please adjust the schedule before submitting.';
                    this.onBlockingChange(true, reason);
                } else {
                    this.onBlockingChange(false);
                }
            } catch (err) {
                console.error('RequestConflictHelper: check failed', err);
                this.onBlockingChange(false);
            }
        }

        clear() {
            this.checker?.clear();
            this.onBlockingChange(false);
        }

        reset() {
            this._checkToken++;
            this.clear();
        }
    }

    root.Core.Pages.RequestConflictHelper = RequestConflictHelper;
})();
