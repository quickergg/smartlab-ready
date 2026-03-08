(function () {
    const root = window.SmartLab = window.SmartLab || {};
    root.Core = root.Core || {};
    root.Core.Pages = root.Core.Pages || {};

    class BorrowRequestController {
        constructor(options = {}) {
            this.role = (options.role || 'student').toLowerCase();
            this.formId = options.formId || (this.role === 'faculty' ? 'facultyRequestForm' : 'studentRequestForm');
            this.requestLeadDays = typeof options.requestLeadDays === 'number' ? options.requestLeadDays : 2;
            this.hooks = options.hooks || {};
            this.state = {
                equipmentListenerBound: false,
                labSyncBound: false,
                timeValidationDefaults: {
                    start: 'Select a start time between 7:30 AM and 9:00 PM.',
                    end: 'Select an end time at least 30 minutes after the start.'
                }
            };
        }

        cacheDOM() {
            this.form = document.getElementById(this.formId);
            if (!this.form) {
                console.warn(`BorrowRequestController: form #${this.formId} not found.`);
                return false;
            }
            this.subjectSelect = document.getElementById('subject-select');
            this.programSelect = document.getElementById('program-select');
            this.yearSelect = document.getElementById('year-select');
            this.locationSelect = document.getElementById('location');
            this.labSelect = document.getElementById('labSelect');
            this.labCheckbox = document.getElementById('labChk');
            this.dateInput = document.getElementById('dateNeeded');
            this.timeStart = document.getElementById('timeStart');
            this.timeEnd = document.getElementById('timeEnd');
            this.equipmentContainer = document.getElementById('equipment-container');
            this.equipmentAvailabilityContainer = this.form?.querySelector('.equipment-availability-label');
            this.equipmentAvailabilityLabel = document.getElementById('equipment-availability-text');
            this.facultySelect = document.getElementById('facultyIdSelect');
            this.newRequestBtn = document.getElementById('newRequestBtn');
            this.cancelBtn = document.getElementById('cancelBtn');
            return true;
        }

        async init() {
            if (!this.cacheDOM()) return;

            await this.loadDirectoryOptions();
            await this.invokeHook('onDirectoryReady', this);

            await this.loadEquipmentForForm(this.dateInput?.value);

            this.setupDateEquipmentRefresh();
            this.populateTimeSelects();
            this.setupDateConstraints();
            this.setupTimeValidationCards();
            this.setupNewCancelHandlers();

            await this.invokeHook('onAfterInit', this);
        }

        async loadDirectoryOptions() {
            await Promise.all([
                this.loadSubjectOptions(),
                this.loadProgramOptions(),
                this.loadRoomOptions(),
                this.loadFacultyOptions()
            ]);
        }

        async loadSubjectOptions() {
            if (!this.subjectSelect) return;
            const previousValue = this.subjectSelect.value;
            const wasDisabled = this.subjectSelect.disabled;
            this.subjectSelect.disabled = true;
            this.subjectSelect.innerHTML = '<option value="">Loading subjects...</option>';

            try {
                const res = await fetch('/api/academic-directory/subjects', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load subjects');
                const subjects = await res.json();

                if (!Array.isArray(subjects) || !subjects.length) {
                    this.subjectSelect.innerHTML = '<option value="">No subjects available</option>';
                    return;
                }

                this.subjectSelect.innerHTML = '<option value="">Select Subject</option>';
                subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.subject_id ? String(subject.subject_id) : '';
                    option.textContent = subject.subject_code
                        ? `${subject.subject_code} — ${subject.subject_name}`
                        : (subject.subject_name || 'Unnamed Subject');
                    option.dataset.subjectName = subject.subject_name || '';
                    option.dataset.subjectCode = subject.subject_code || '';
                    option.dataset.subjectLabel = option.textContent;
                    this.subjectSelect.appendChild(option);
                });

                if (previousValue) {
                    this.subjectSelect.value = previousValue;
                }
            } catch (err) {
                console.error('BorrowRequestController: Failed to load subjects', err);
                this.subjectSelect.innerHTML = '<option value="">Unable to load subjects</option>';
            } finally {
                this.subjectSelect.disabled = wasDisabled;
            }
        }

        async loadProgramOptions() {
            if (!this.programSelect) return;
            const previousValue = this.programSelect.value;
            const wasDisabled = this.programSelect.disabled;
            this.programSelect.disabled = true;
            this.programSelect.innerHTML = '<option value="">Loading programs...</option>';

            try {
                const res = await fetch('/api/academic-directory/programs', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load programs');
                const programs = await res.json();

                if (!Array.isArray(programs) || !programs.length) {
                    this.programSelect.innerHTML = '<option value="">No programs available</option>';
                    return;
                }

                this.programSelect.innerHTML = '<option value="">Select Program</option>';
                programs.forEach(program => {
                    const option = document.createElement('option');
                    option.value = program.program_id ? String(program.program_id) : '';
                    option.textContent = program.program_code
                        ? `${program.program_code} — ${program.program_name}`
                        : (program.program_name || 'Unnamed Program');
                    option.dataset.programName = program.program_name || '';
                    option.dataset.programCode = program.program_code || '';
                    option.dataset.programLabel = option.textContent;
                    this.programSelect.appendChild(option);
                });

                if (previousValue) {
                    this.programSelect.value = previousValue;
                }
            } catch (err) {
                console.error('BorrowRequestController: Failed to load programs', err);
                this.programSelect.innerHTML = '<option value="">Unable to load programs</option>';
            } finally {
                this.programSelect.disabled = wasDisabled;
            }
        }

        async loadRoomOptions() {
            if (!this.locationSelect && !this.labSelect) return;

            const previousLocation = this.locationSelect ? this.locationSelect.value : '';

            if (this.labSelect) {
                this.labSelect.disabled = true;
                this.labSelect.innerHTML = '<option value="">Loading lab rooms...</option>';
            }
            if (this.locationSelect) {
                this.locationSelect.disabled = true;
                this.locationSelect.innerHTML = '<option value="">Loading rooms...</option>';
            }

            try {
                const res = await fetch('/api/academic-directory/rooms', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load rooms');
                this.rooms = await res.json();

                if (!Array.isArray(this.rooms)) {
                    this.rooms = [];
                }

                if (this.labSelect) {
                    this.populateLabOptions();
                }

                if (this.locationSelect) {
                    this.renderLocationOptions(previousLocation);
                    this.locationSelect.disabled = false;
                }
            } catch (err) {
                console.error('BorrowRequestController: Failed to load rooms', err);
                if (this.labSelect) {
                    this.labSelect.innerHTML = '<option value="">Unable to load lab rooms</option>';
                    this.labSelect.disabled = false;
                }
                if (this.locationSelect) {
                    this.locationSelect.innerHTML = '<option value="">Unable to load rooms</option>';
                    this.locationSelect.disabled = false;
                }
            }
        }

        populateLabOptions() {
            if (!this.labSelect || !Array.isArray(this.rooms)) return;
            this.labSelect.innerHTML = '<option value="">Select Laboratory</option>';

            const labRooms = this.rooms.filter(room => this.isLabRoom(room));

            labRooms.forEach(room => {
                if (!room || !room.room_id) return;
                const { displayLabel, locationValue } = this.buildRoomDisplay(room);
                const opt = document.createElement('option');
                opt.value = String(room.room_id);
                opt.textContent = displayLabel;
                opt.dataset.roomId = String(room.room_id);
                opt.dataset.locationValue = locationValue;
                opt.dataset.roomLabel = displayLabel;
                this.labSelect.appendChild(opt);
            });

            if (!labRooms.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No computer laboratories found';
                opt.disabled = true;
                this.labSelect.appendChild(opt);
            }

            this.labSelect.disabled = false;
            this.bindLabSelectSync();
            this.syncLabSelectionToLocation();
        }

        renderLocationOptions(previousValue = '') {
            if (!this.locationSelect || !Array.isArray(this.rooms)) return;
            const valueToRestore = previousValue || this.locationSelect.value;
            this.locationSelect.innerHTML = '<option value="">Select Location</option>';

            this.rooms.forEach(room => {
                const { displayLabel, locationValue } = this.buildRoomDisplay(room);
                const option = document.createElement('option');
                option.value = room.room_id ? String(room.room_id) : '';
                option.textContent = displayLabel;
                option.dataset.roomId = room.room_id || '';
                option.dataset.locationValue = locationValue;
                option.dataset.roomLabel = displayLabel;
                this.locationSelect.appendChild(option);
            });

            if (valueToRestore) {
                const hasValue = Array.from(this.locationSelect.options || []).some(opt => opt.value === valueToRestore);
                if (hasValue) {
                    this.locationSelect.value = valueToRestore;
                }
            }
        }

        buildRoomDisplay(room = {}) {
            const name = room.room_name?.trim();
            const number = room.room_number?.trim();
            const building = room.building_name?.trim();
            const parts = [];
            if (number) parts.push(number);
            if (name && name !== number) parts.push(name);
            if (building) parts.push(building);
            const displayLabel = parts.join(' • ') || number || name || `Room ${room.room_id}`;
            const locationValue = number || name || displayLabel;
            return { displayLabel, locationValue };
        }

        isLabRoom(room = {}) {
            if (room?.is_computer_lab !== undefined && room?.is_computer_lab !== null) {
                return Number(room.is_computer_lab) === 1 || room.is_computer_lab === true;
            }
            return this.isComputerLaboratory(room);
        }

        isComputerLaboratory(room = {}) {
            const label = `${room.room_name || ''} ${room.room_number || ''}`.toLowerCase();
            return label.includes('computer laboratory') || label.includes('computer lab');
        }

        bindLabSelectSync() {
            if (!this.labSelect || !this.locationSelect || this.state.labSyncBound) return;
            this.labSelect.addEventListener('change', () => this.syncLabSelectionToLocation());
            this.state.labSyncBound = true;
        }

        syncLabSelectionToLocation() {
            if (!this.labSelect || !this.locationSelect) return;
            const selected = this.labSelect.selectedOptions?.[0];
            if (!selected || !selected.value) return;

            const targetValue = selected.value;
            const locationOptions = Array.from(this.locationSelect.options || []);
            const hasMatch = locationOptions.some(opt => opt.value === targetValue);
            if (!hasMatch) return;

            const previousValue = this.locationSelect.value;
            this.locationSelect.value = targetValue;
            if (previousValue !== targetValue) {
                this.locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        async loadFacultyOptions() {
            if (!this.facultySelect) return;
            try {
                const res = await fetch('/api/faculty-list', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed');
                const faculty = await res.json();

                this.facultySelect.innerHTML = '<option value="">-- Select Faculty --</option>';
                faculty.forEach(fac => {
                    const opt = document.createElement('option');
                    opt.value = fac.faculty_id;
                    opt.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
                    this.facultySelect.appendChild(opt);
                });

                if (this.role === 'faculty') {
                    const currentUserId = Number(sessionStorage.getItem('user_id'));
                    const currentFaculty = faculty.find(f => f.faculty_id === currentUserId);
                    if (currentFaculty) {
                        this.facultySelect.value = currentFaculty.faculty_id;
                        this.facultySelect.disabled = true;
                        const label = this.facultySelect.previousElementSibling;
                        if (label && label.tagName === 'LABEL') {
                            label.textContent = 'Faculty in charge (You)';
                            label.style.color = '#10b981';
                            label.style.fontWeight = 'bold';
                        }
                    }
                }
            } catch (err) {
                console.error('BorrowRequestController: Faculty list load failed', err);
            }
        }

        async loadEquipmentForForm(date) {
            if (!this.equipmentContainer) return;

            try {
                let url = '/api/equipment';
                let isDateBased = false;
                if (date) {
                    url = `/api/equipment/availability?date=${encodeURIComponent(date)}`;
                    isDateBased = true;
                }

                this.updateEquipmentAvailabilityLabel('loading', { date, isDateBased });
                this.equipmentContainer.innerHTML = '<div style="padding:10px;text-align:center;color:#6b7280;">Loading equipment...</div>';

                const res = await fetch(url, { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load equipment');
                const equipment = await res.json();

                if (!equipment || !equipment.length) {
                    this.equipmentContainer.innerHTML = '<div style="padding:10px;color:#666;">No equipment available.</div>';
                    this.updateEquipmentAvailabilityLabel('empty', { date, isDateBased });
                    await this.invokeHook('onEquipmentLoad', { date, isDateBased });
                    return;
                }

                this.equipmentContainer.innerHTML = equipment.map(item => this.buildEquipmentItem(item, isDateBased)).join('');

                this.ensureEquipmentListeners();
                this.updateEquipmentAvailabilityLabel('ready', { date, isDateBased });
                await this.invokeHook('onEquipmentLoad', { date, isDateBased });
            } catch (err) {
                console.error('BorrowRequestController: Equipment load failed', err);
                this.equipmentContainer.innerHTML = '<div style="color:red;padding:10px;">Failed to load equipment.</div>';
                this.updateEquipmentAvailabilityLabel('error', { date, isDateBased: Boolean(date) });
            }
        }

        buildEquipmentItem(item, isDateBased) {
            const availQty = isDateBased ? (item.available_on_date ?? item.available_qty ?? 0) : (item.available_qty ?? 0);
            const reservedQty = item.reserved_qty || 0;
            const pendingQty = item.pending_qty || 0;
            const disabled = availQty <= 0;

            let availInfo = '';
            if (isDateBased && (reservedQty > 0 || pendingQty > 0)) {
                const parts = [];
                if (reservedQty > 0) parts.push(`${reservedQty} approved`);
                if (pendingQty > 0) parts.push(`${pendingQty} pending`);
                availInfo = `<span style="font-size:11px;color:#6b7280;margin-left:6px;">(${parts.join(', ')} on this date)</span>`;
            }

            const unavailableLabel = isDateBased ? 'Unavailable on this date' : 'Out of Stock';

            return `
                <div class="equipment-item ${disabled ? 'disabled' : ''}" style="margin-bottom:8px;padding:10px;border:1px solid #ddd;border-radius:6px;display:flex;align-items:center;justify-content:space-between;${disabled ? 'background:#f9f9f9;opacity:0.6;' : ''}">
                    <div style="display:flex;align-items:center;flex:1;flex-wrap:wrap;">
                        <input type="checkbox" name="equipment_ids[]" value="${item.equipment_id}"
                               data-equipment-id="${item.equipment_id}" ${disabled ? 'disabled' : ''}
                               style="margin-right:10px;" />
                        <strong>${this.escapeHtml(item.equipment_name)}</strong>
                        ${disabled ? `<span style="margin-left:8px;color:#dc2626;font-size:12px;font-weight:600;">(${unavailableLabel})</span>` : ''}
                        ${availInfo}
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="display:flex;align-items:center;gap:4px;">
                            <label style="font-size:12px;color:#666;">${isDateBased ? 'Avail:' : 'Stock:'}</label>
                            <input type="number" value="${availQty}" disabled
                                   style="width:55px;padding:2px 4px;background:${disabled ? '#fee2e2' : '#f0fdf4'};border:1px solid ${disabled ? '#fca5a5' : '#bbf7d0'};font-size:12px;border-radius:4px;font-weight:600;color:${disabled ? '#dc2626' : '#166534'};" />
                        </div>
                        <div style="display:flex;align-items:center;gap:4px;">
                            <label style="font-size:12px;color:#666;">Qty:</label>
                            <input type="number" id="requested-${item.equipment_id}"
                                   name="requested_quantities[]" min="1" max="${Math.max(availQty, 1)}"
                                   placeholder="0" disabled
                                   style="width:55px;padding:2px 4px;border:1px solid #ddd;font-size:12px;border-radius:4px;" />
                        </div>
                    </div>
                </div>
            `;
        }

        ensureEquipmentListeners() {
            if (!this.equipmentContainer || this.state.equipmentListenerBound) return;
            this.equipmentContainer.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.name === 'equipment_ids[]') {
                    const eqId = e.target.dataset.equipmentId;
                    const qtyInput = document.getElementById(`requested-${eqId}`);
                    if (qtyInput) {
                        qtyInput.disabled = !e.target.checked;
                        qtyInput.value = e.target.checked ? '1' : '';
                    }
                }
                if (e.target.name === 'equipment_ids[]' || e.target.name === 'requested_quantities[]') {
                    this.invokeHook('onEquipmentChange', { event: e });
                }
            });
            this.equipmentContainer.addEventListener('input', (e) => {
                if (e.target.name === 'requested_quantities[]') {
                    this.invokeHook('onEquipmentChange', { event: e });
                }
            });
            this.state.equipmentListenerBound = true;
        }

        formatDateValue(value) {
            if (!value) return '';
            if (window.SmartLab?.Core?.Utils?.formatDate) {
                return SmartLab.Core.Utils.formatDate(value);
            }
            return value;
        }

        updateEquipmentAvailabilityLabel(status = 'idle', options = {}) {
            if (!this.equipmentAvailabilityLabel) return;
            const label = this.equipmentAvailabilityLabel;
            const container = this.equipmentAvailabilityContainer;
            const formattedDate = options.date ? this.formatDateValue(options.date) : '';
            const hasDate = Boolean(formattedDate);
            const scopedPhrase = hasDate ? ` for ${formattedDate}` : '';
            let text = 'Available equipment';

            switch (status) {
                case 'loading':
                    text = hasDate
                        ? `Checking available equipment for ${formattedDate}...`
                        : 'Loading available equipment...';
                    break;
                case 'ready':
                    text = options.isDateBased && hasDate
                        ? `Available equipment for ${formattedDate}`
                        : 'Available equipment (showing general availability)';
                    break;
                case 'empty':
                    text = options.isDateBased && hasDate
                        ? `No equipment available for ${formattedDate}`
                        : 'No equipment available at the moment.';
                    break;
                case 'error':
                    text = `Unable to load equipment${scopedPhrase}. Please try again.`;
                    break;
                default:
                    text = hasDate
                        ? `Available equipment for ${formattedDate}`
                        : 'Available equipment (select a date to see daily availability)';
            }

            label.textContent = text;
            if (container) {
                container.dataset.state = status;
            } else {
                label.dataset.state = status;
            }
        }

        setupDateEquipmentRefresh() {
            if (!this.dateInput) return;
            this.dateInput.addEventListener('change', async () => {
                const date = this.dateInput.value;
                await this.loadEquipmentForForm(date || undefined);
                await this.invokeHook('onDateChange', { date });
            });
        }

        populateTimeSelects() {
            if (!this.timeStart || !this.timeEnd) return;
            const selects = [this.timeStart, this.timeEnd];
            const slots = (window.FormValidator?.getHalfHourSlots?.())
                ? FormValidator.getHalfHourSlots()
                : ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

            selects.forEach(select => {
                const placeholder = select.dataset.placeholder || 'Select time';
                const priorValue = select.value;
                select.innerHTML = `<option value="">${placeholder}</option>`;
                slots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = SmartLab.Core.Utils.formatTime(slot);
                    select.appendChild(option);
                });
                if (priorValue && slots.includes(priorValue)) {
                    select.value = priorValue;
                }
            });
        }

        setupTimeValidationCards() {
            if (!this.timeStart || !this.timeEnd) return;
            if (this.state.timeValidationBound) return;

            const refresh = () => {
                this.validateTimeSlots(this.timeStart.value || '', this.timeEnd.value || '', { emitToast: false, allowIncomplete: true });
                this.invokeHook('onTimeChange', { start: this.timeStart.value, end: this.timeEnd.value });
            };

            ['input', 'change'].forEach(evt => {
                this.timeStart.addEventListener(evt, refresh);
                this.timeEnd.addEventListener(evt, refresh);
            });

            this.form?.addEventListener('reset', () => setTimeout(refresh, 0));
            refresh();
            this.state.timeValidationBound = true;
        }

        setupDateConstraints() {
            if (!this.dateInput) return;
            const updateMin = () => {
                const leadDays = Number(this.requestLeadDays) || 0;
                const minDate = new Date();
                minDate.setHours(0, 0, 0, 0);
                minDate.setDate(minDate.getDate() + leadDays);
                const formatted = SmartLab.Core.Utils.formatDateInput?.(minDate)
                    || `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`;
                this.dateInput.min = formatted;

                if (!this.dateInput.value) {
                    this.dateInput.value = formatted;
                    this.dateInput.dispatchEvent(new Event('change'));
                    return;
                }

                if (this.dateInput.value && this.dateInput.value < formatted) {
                    this.dateInput.value = formatted;
                    this.dateInput.dispatchEvent(new Event('change'));
                }
            };

            updateMin();
            this.dateInput.addEventListener('focus', updateMin);
        }

        setupNewCancelHandlers() {
            if (!this.newRequestBtn || !this.cancelBtn) return;
            if (this.state.newCancelBound) return;

            this.newRequestBtn.addEventListener('click', async () => {
                const ok = await SmartLab.Core.UI.confirm('Start a new request? Current form data will be cleared.', 'New Request', { type: 'info', confirmText: 'Start New' });
                if (ok) {
                    await this.resetForm();
                }
            });

            this.cancelBtn.addEventListener('click', async () => {
                const ok = await SmartLab.Core.UI.confirm('Cancel this request? All entered data will be lost.', 'Cancel Request', { type: 'warning', confirmText: 'Yes, Cancel' });
                if (ok) {
                    await this.resetForm();
                }
            });

            this.state.newCancelBound = true;
        }

        async resetForm() {
            this.form?.reset();
            if (this.labCheckbox && this.labCheckbox.checked) {
                this.labCheckbox.dispatchEvent(new Event('change'));
            }
            await this.invokeHook('onReset', this);
            const dateVal = this.dateInput?.value;
            await this.loadEquipmentForForm(dateVal);
        }

        validateTimeSlots(start, end, options = {}) {
            const { emitToast = true, allowIncomplete = false } = options;
            const startCard = this.form?.querySelector('[data-time-card="start"]');
            const endCard = this.form?.querySelector('[data-time-card="end"]');
            const defaults = this.state.timeValidationDefaults;

            const slots = (window.FormValidator?.getHalfHourSlots?.())
                ? FormValidator.getHalfHourSlots()
                : ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

            const setState = (card, state, text) => {
                if (!card) return;
                card.classList.remove('conflict-loading', 'conflict-clear', 'conflict-error');
                card.classList.add(`conflict-${state}`);
                const message = card.querySelector('.time-validation-message');
                if (message && text) message.textContent = text;
            };

            const notify = (msg) => {
                if (emitToast) {
                    this.toast(msg, 'warning');
                }
            };

            let isValid = true;
            let startSlotValid = false;
            let endSlotValid = false;

            if (!start) {
                setState(startCard, 'loading', defaults.start);
                isValid = false;
                if (!allowIncomplete) notify('Please select a start time.');
            } else if (!slots.includes(start)) {
                setState(startCard, 'error', 'Time Start must be between 7:30 AM and 9:00 PM in 30-minute increments.');
                notify('Time Start must be between 7:30 AM and 9:00 PM in 30-minute increments.');
                isValid = false;
            } else {
                startSlotValid = true;
                setState(startCard, 'clear', `Starts at ${SmartLab.Core.Utils.formatTime(start)}.`);
            }

            if (!end) {
                setState(endCard, 'loading', defaults.end);
                isValid = false;
                if (!allowIncomplete) notify('Please select an end time.');
            } else if (!slots.includes(end)) {
                setState(endCard, 'error', 'Time End must be between 7:30 AM and 9:00 PM in 30-minute increments.');
                notify('Time End must be between 7:30 AM and 9:00 PM in 30-minute increments.');
                isValid = false;
            } else {
                endSlotValid = true;
                setState(endCard, 'clear', `Ends at ${SmartLab.Core.Utils.formatTime(end)}.`);
            }

            if (startSlotValid && endSlotValid) {
                const startIdx = slots.indexOf(start);
                const endIdx = slots.indexOf(end);

                if (endIdx <= startIdx) {
                    setState(endCard, 'error', 'Time End must be after Time Start.');
                    notify('Time End must be after Time Start.');
                    return false;
                }

                if (endIdx - startIdx < 1) {
                    setState(endCard, 'error', 'Time End must be at least 30 minutes after Time Start.');
                    notify('Time End must be at least 30 minutes after Time Start.');
                    return false;
                }

                const durationMinutes = (endIdx - startIdx) * 30;
                const durationLabel = this.formatDuration(durationMinutes);
                setState(startCard, 'clear', `Starts at ${SmartLab.Core.Utils.formatTime(start)}.`);
                setState(endCard, 'clear', `Ends at ${SmartLab.Core.Utils.formatTime(end)} • ${durationLabel}`);
                return true;
            }

            return isValid;
        }

        formatDuration(minutes) {
            if (!minutes) return '0 min';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const parts = [];
            if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
            if (mins) parts.push(`${mins} min`);
            return parts.join(' ');
        }

        toast(message, type = 'info') {
            if (window.SmartLab?.Core?.UI?.showToast) {
                window.SmartLab.Core.UI.showToast(message, type);
            }
        }

        escapeHtml(val) {
            return String(val ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        async invokeHook(name, ...args) {
            const fn = this.hooks?.[name];
            if (typeof fn === 'function') {
                try {
                    return await fn(this, ...args);
                } catch (err) {
                    console.error(`BorrowRequestController: hook ${name} failed`, err);
                }
            }
        }
    }

    root.Core.Pages.BorrowRequestController = BorrowRequestController;
})();
