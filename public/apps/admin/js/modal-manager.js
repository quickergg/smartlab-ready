/* =========================================
   SmartLab Admin - Centralized Modal Manager
   Handles all modal operations with dynamic content
   
   ========================================
   DEVELOPMENT GUIDE - HOW TO ADD NEW MODALS
   ========================================
   
   To add a new modal type (e.g., 'equipment-modal'):
   
   1. ADD TO getModalContent() SWITCH (Line ~152):
      ```javascript
      case 'equipment-modal':
          return this.getEquipmentModalContent(data);
      ```
   
   2. CREATE CONTENT TEMPLATE METHOD (Section 2):
      ```javascript
      getEquipmentModalContent(data) {
          return `
              <div class="modal-header">
                  <h4>Equipment Details</h4>
                  <button class="modal-close">&times;</button>
              </div>
              <div class="modal-body">
                  <!-- Your HTML here -->
              </div>
          `;
      }
      ```
   
   3. ADD TO initializeModal() SWITCH (Line ~157):
      ```javascript
      case 'equipment-modal':
          this.initializeEquipmentModal(data);
          break;
      ```
   
   4. CREATE INITIALIZATION METHOD (Section 3):
      ```javascript
      initializeEquipmentModal(data) {
          // Setup event listeners, load data, etc.
          const form = document.getElementById('equipment-form');
          if (form) {
              form.addEventListener('submit', (e) => this.handleEquipmentSubmit(e, data));
          }
      }
      ```
   
   5. CREATE HANDLER METHOD (if form-based, Section 4/5):
      ```javascript
      async handleEquipmentSubmit(e, data) {
          e.preventDefault();
          // Handle form submission
          // API calls, validation, etc.
      }
      ```
   
   6. USAGE:
      ```javascript
      ModalManager.show('equipment-modal', {
          equipmentId: 123,
          onSuccess: () => console.log('Equipment saved!')
      });
      ```
   
   ========================================
   FILE STRUCTURE
   ========================================
   
   1. CORE MODAL MANAGER METHODS (Lines 28-178)
      - Basic modal operations (show, hide, init)
      - Event setup and management
   
   2. MODAL CONTENT TEMPLATES (Lines 180-433)
      - HTML templates for each modal type
      - get[ModalName]ModalContent() methods
   
   3. MODAL INITIALIZATION LOGIC (Lines 435-561)
      - initialize[ModalName]Modal() methods
      - Event listener setup for each modal
   
   4. USER MANAGEMENT MODALS (Lines 563-916)
      - User-specific functionality
      - Form handling for add/edit users
   
   5. GENERIC MODALS (Lines 918-922)
      - Confirm, Alert, Form modals
      - Callback-based interactions
   
   6. UTILITY FUNCTIONS (Lines 924-997)
      - Helper methods (showToast, etc.)
   
   7. STATIC METHODS & INITIALIZATION (Lines 999-1034)
      - Static convenience methods
      - Auto-initialization logic
   
   8. GLOBAL INITIALIZATION (Lines 1036-1065)
      - DOM ready handlers
      - SPA compatibility
   
   ========================================
   EXISTING MODAL TYPES
   ========================================
   
   - 'add-user': Add new user form
   - 'edit-user': Edit existing user form  
   - 'confirm': Confirmation dialog with onConfirm callback
   - 'alert': Alert dialog with onOk callback
   - 'form': Generic form modal with onSubmit callback
   
   ========================================
   BEST PRACTICES
   ========================================
   
   1. Use consistent naming: get[Name]Content(), initialize[Name](), handle[Name]Submit()
   2. Always include error handling and user feedback
   3. Use the isSubmitting flag to prevent duplicate submissions
   4. Include proper cleanup in event listeners
   5. Add console logging for debugging
   6. Use semantic HTML and proper form structure
   7. Include validation and loading states
   
   ========================================
   DEPENDENCIES
   ========================================
   
   - DOM elements: #modal-container, #modal-content
   - CSS classes: .modal-container, .modal-content, .modal-header, .modal-body
   - AdminApp.showToast() for notifications (fallback provided)
   - Fetch API for HTTP requests
   
========================================= */

class ModalManager {
    constructor() {
        this.modalContainer = null;
        this.modalContent = null;
        this.currentModal = null;
        this.isSubmitting = false; // Prevent multiple submissions
        this.departmentsCache = null;
        this.programsCache = null;
        this.roomsCache = null;
        this.subjectsCache = null;
    }

    // =========================================
    // 1. CORE MODAL MANAGER METHODS
    // =========================================

    init() {
        this.modalContainer = document.getElementById('modal-container');
        this.modalContent = document.getElementById('modal-content');
        this.currentModal = null;
        this.currentData = null;
        
        // Check if modal elements exist
        if (!this.modalContainer || !this.modalContent) {
            console.error('ModalManager: Modal elements not found in DOM');
            return false;
        }
        
        // Initialize event listeners
        this.setupEventListeners();
        return true;
    }

    setupEventListeners() {
        // Close modal on backdrop click
        this.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.modalContainer) {
                this.hide();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Show a modal of specific type with data
     * @param {string} type - Modal type ('user', 'confirm', 'alert', 'form')
     * @param {object} data - Data to pass to the modal
     */
    async show(type, data = {}) {
        // Ensure modal is initialized
        if (!this.modalContainer || !this.modalContent) {
            console.error('ModalManager: Modal not initialized. Call init() first.');
            // Try to initialize
            if (!this.init()) {
                throw new Error('Modal elements not found in DOM');
            }
        }
        
        this.currentModal = type;
        this.currentData = data;

        try {
            // Load modal content based on type
            const content = await this.getModalContent(type, data);
            
            // Set modal content
            this.modalContent.innerHTML = content;
            
            // Show modal
            this.modalContainer.classList.add('active');
            this.isVisible = true;
            
            // Initialize modal-specific functionality
            this.initializeModal(type, data);
            
        } catch (error) {
            console.error(`ModalManager: Failed to show ${type} modal:`, error);
            this.showToast(`Failed to open modal: ${error.message}`, 'error');
        }
    }

    /**
     * Format helpers for dropdown labels
     */
    formatRoomLabel(room = {}) {
        const number = (room.room_number || '').trim();
        const name = (room.room_name || '').trim();
        const building = (room.building_name || '').trim();
        const parts = [];
        if (number) parts.push(number);
        if (name && name !== number) parts.push(name);
        if (building) parts.push(building);
        return parts.join(' • ') || number || name || 'Unnamed Room';
    }

    isComputerLabRoom(room = {}) {
        if (room?.is_computer_lab !== undefined && room?.is_computer_lab !== null) {
            return Number(room.is_computer_lab) === 1 || room.is_computer_lab === true;
        }
        const label = `${room.room_name || ''} ${room.room_number || ''}`.toLowerCase();
        return label.includes('computer laboratory') || label.includes('computer lab');
    }

    formatSubjectLabel(subject = {}) {
        const code = (subject.subject_code || '').trim();
        const name = (subject.subject_name || '').trim();
        if (code && name) return `${code} — ${name}`;
        return name || code || 'Unnamed Subject';
    }

    formatProgramLabel(program = {}) {
        const code = (program.program_code || '').trim();
        const name = (program.program_name || '').trim();
        if (code && name) return `${code} — ${name}`;
        return name || code || 'Unnamed Program';
    }

    ensureOptionExists(select, value, label, dataset = {}) {
        if (!select || value === undefined || value === null || value === '') return;
        const target = String(value);
        const exists = Array.from(select.options || []).some(opt => opt.value === target);
        if (exists) return;
        const option = document.createElement('option');
        option.value = target;
        option.textContent = label || `ID ${target}`;
        Object.entries(dataset || {}).forEach(([key, val]) => {
            option.dataset[key] = val ?? '';
        });
        option.dataset.injected = 'true';
        select.appendChild(option);
    }

    getSelectedOptionMeta(selectId) {
        const select = document.getElementById(selectId);
        const option = select?.selectedOptions?.[0];
        if (!option) return { value: '', label: '', dataset: {} };
        return {
            value: option.value,
            label: (option.dataset?.roomLabel || option.dataset?.subjectLabel || option.textContent || '').trim(),
            dataset: { ...option.dataset }
        };
    }

    populateTimeDropdowns(root = document) {
        const scope = root || document;
        const selects = scope.querySelectorAll?.('[data-time-select]');
        if (!selects?.length) return;

        const slots = window.FormValidator?.getHalfHourSlots?.();
        const fallbackSlots = ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];
        const options = Array.isArray(slots) && slots.length ? slots : fallbackSlots;

        selects.forEach(select => {
            const placeholder = select.dataset.placeholder || 'Select time';
            const previousValue = select.value;
            select.innerHTML = `<option value="">${placeholder}</option>`;

            options.forEach(slot => {
                const option = document.createElement('option');
                option.value = slot;
                option.textContent = SmartLab.Core.Utils?.formatTime?.(slot) || slot;
                select.appendChild(option);
            });

            if (previousValue && options.includes(previousValue)) {
                select.value = previousValue;
            }
        });
    }

    registerScheduleConflictWatcher(form, mode = 'add', scheduleId = null) {
        if (!form || !window.scheduleManager) return;
        const scheduleManager = window.scheduleManager;
        const fields = {
            room: () => this.getSelectedOptionMeta('schedule-lab'),
            day: () => form.querySelector('#schedule-day')?.value || '',
            start: () => form.querySelector('#schedule-time-start')?.value || '',
            end: () => form.querySelector('#schedule-time-end')?.value || '',
            faculty: () => form.querySelector('#schedule-faculty')?.value || '',
            subject: () => this.getSelectedOptionMeta('schedule-subject'),
            program: () => this.getSelectedOptionMeta('schedule-program'),
            yearLevel: () => form.querySelector('#schedule-year-level')?.value || ''
        };

        const timeCards = form.querySelectorAll('.time-validation-card');
        const setCardState = (state) => {
            timeCards.forEach(card => {
                card.dataset.state = state || '';
            });
        };

        const fallbackSlots = ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];
        const slots = window.FormValidator?.getHalfHourSlots?.();
        const slotList = Array.isArray(slots) && slots.length ? slots : fallbackSlots;
        const isValidSlot = (value) => {
            if (!value) return false;
            return slotList.includes(value);
        };

        const getSlotIndex = (value) => {
            return slotList.indexOf(value);
        };

        const formatTimeLabel = (value) => {
            if (!value) return '';
            return SmartLab.Core?.Utils?.formatTime?.(`${value}:00`) || SmartLab.Core?.Utils?.formatTime?.(value) || value;
        };

        const formatDuration = (minutes) => {
            if (!minutes || minutes < 0) return '';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const parts = [];
            if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
            if (mins) parts.push(`${mins} min`);
            return parts.join(' ');
        };

        const setCardContent = (card, { title, message, state }) => {
            if (!card) return;
            const titleEl = card.querySelector('.time-validation-title');
            const msgEl = card.querySelector('.time-validation-message');
            if (titleEl && title) titleEl.textContent = title;
            if (msgEl && message) msgEl.textContent = message;
            card.dataset.state = state || '';

            // Inline styling to mirror faculty request states
            const styles = {
                ok: { bg: '#ecfdf3', border: '#bbf7d0', text: '#166534' },
                conflict: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
                invalid: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
                neutral: { bg: '#f9fafb', border: '#e5e7eb', text: '#111827' }
            };
            const palette = styles[state] || styles.neutral;
            card.style.background = palette.bg;
            card.style.borderColor = palette.border;
            if (msgEl) msgEl.style.color = palette.text;
            if (titleEl) titleEl.style.color = palette.text;
        };

        const setSelectState = (state) => {
            const startSel = form.querySelector('#schedule-time-start');
            const endSel = form.querySelector('#schedule-time-end');
            const setStyle = (el, s) => {
                if (!el) return;
                if (s === 'invalid' || s === 'conflict') {
                    el.style.borderColor = '#ef4444';
                    el.style.boxShadow = '0 0 0 1px #ef4444 inset';
                } else if (s === 'ok') {
                    el.style.borderColor = '#10b981';
                    el.style.boxShadow = '0 0 0 1px #10b981 inset';
                } else {
                    el.style.borderColor = '';
                    el.style.boxShadow = '';
                }
            };
            setStyle(startSel, state.start);
            setStyle(endSel, state.end);
        };

        const runCheck = () => {
            const roomMeta = fields.room();
            const subjectMeta = fields.subject();
            const programMeta = fields.program();
            const day = fields.day();
            const start = fields.start();
            const end = fields.end();
            const facultyId = fields.faculty();

            const startCard = form.querySelector('.time-validation-card[data-time-card="start"]');
            const endCard = form.querySelector('.time-validation-card[data-time-card="end"]');
            const startLabel = formatTimeLabel(start);
            const endLabel = formatTimeLabel(end);

            // Validate times are in slot list and enforce 30-minute gap (mirrors faculty validateTimeSlots)
            const startValid = isValidSlot(start);
            const endValid = isValidSlot(end);
            const startIdx = getSlotIndex(start);
            const endIdx = getSlotIndex(end);
            const hasGap = startIdx !== -1 && endIdx !== -1 ? endIdx - startIdx >= 1 : (end > start);

            let validationPassed = true;

            if (!start) {
                setCardContent(startCard, { title: 'Start Time', message: 'Select a start time between 7:30 AM and 9:00 PM.', state: 'neutral' });
                setSelectState({ start: null, end: null });
                validationPassed = false;
            } else if (!startValid) {
                setCardContent(startCard, { title: 'Start Time', message: 'Time Start must be between 7:30 AM and 9:00 PM in 30-minute increments.', state: 'invalid' });
                setSelectState({ start: 'invalid', end: null });
                validationPassed = false;
            } else {
                setCardContent(startCard, { title: 'Start Time', message: `Starts at ${startLabel || 'selected time'}.`, state: 'ok' });
                setSelectState({ start: 'ok', end: null });
            }

            if (!end) {
                setCardContent(endCard, { title: 'End Time', message: 'Select an end time at least 30 minutes after the start.', state: 'neutral' });
                setSelectState({ start: validationPassed ? 'ok' : null, end: null });
                validationPassed = false;
            } else if (!endValid) {
                setCardContent(endCard, { title: 'End Time', message: 'Time End must be between 7:30 AM and 9:00 PM in 30-minute increments.', state: 'invalid' });
                setSelectState({ start: startValid ? 'ok' : null, end: 'invalid' });
                validationPassed = false;
            }

            if (!startValid || !endValid || !start || !end) {
                return;
            }

            if (startIdx !== -1 && endIdx !== -1 && endIdx <= startIdx) {
                setCardContent(endCard, { title: 'End Time', message: 'Time End must be after Time Start.', state: 'invalid' });
                setSelectState({ start: 'ok', end: 'invalid' });
                return;
            }

            if (!hasGap) {
                setCardContent(endCard, { title: 'End Time', message: 'Time End must be at least 30 minutes after Time Start.', state: 'invalid' });
                setSelectState({ start: 'ok', end: 'invalid' });
                return;
            }

            const durationMinutes = startIdx !== -1 && endIdx !== -1 ? (endIdx - startIdx) * 30 : null;
            const durationLabel = durationMinutes ? formatDuration(durationMinutes) : '';
            setCardContent(startCard, { title: 'Start Time', message: `Starts at ${startLabel || 'selected time'}.`, state: 'ok' });
            setCardContent(endCard, { title: 'End Time', message: `Ends at ${endLabel || 'selected time'}${durationLabel ? ` • ${durationLabel}` : ''}`, state: 'ok' });
            setSelectState({ start: 'ok', end: 'ok' });

            const payload = {
                lab_room: roomMeta.label || 'Selected Laboratory',
                faculty_id: Number(facultyId) || 0,
                program: programMeta.label || null,
                year_level: fields.yearLevel() ? Number(fields.yearLevel()) || null : null,
                subject: subjectMeta.label || 'Subject',
                day_of_week: day,
                time_start: `${start}:00`,
                time_end: `${end}:00`
            };

            this.runModalConflictCheck({ day, start, end, roomMeta, scheduleId });

            const conflict = (roomMeta.value && day && facultyId)
                ? (mode === 'edit'
                    ? scheduleManager.checkEditScheduleConflict(payload, scheduleId)
                    : scheduleManager.checkScheduleConflict(payload))
                : null;

            if (conflict) {
                const durationMinutes = startIdx !== -1 && endIdx !== -1 ? (endIdx - startIdx) * 30 : null;
                const durationLabel = durationMinutes ? formatDuration(durationMinutes) : '';
                setCardContent(endCard, { title: 'End Time', message: `Ends at ${endLabel || 'selected time'}${durationLabel ? ` • ${durationLabel}` : ''} (conflict detected)`, state: 'conflict' });
                setSelectState({ start: 'ok', end: 'conflict' });
                this.setSubmitDisabled(true, 'A conflict is detected. Resolve before submitting.');
            } else {
                // Only clear local block; async conflict checker may still block later
                this.setSubmitDisabled(false);
            }
        };

        const fieldsToWatch = ['#schedule-lab', '#schedule-day', '#schedule-time-start', '#schedule-time-end', '#schedule-faculty', '#schedule-subject', '#schedule-program', '#schedule-year-level'];
        fieldsToWatch.forEach(sel => {
            const el = form.querySelector(sel);
            if (el) {
                ['change', 'input'].forEach(evt => el.addEventListener(evt, runCheck));
            }
        });

        runCheck();
        return runCheck;
    }

    // Compute the next calendar date for the given day-of-week (MONDAY, TUESDAY, ...)
    getNextDateForDay(day) {
        if (!day) return null;
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const targetIdx = days.indexOf(String(day).toUpperCase());
        if (targetIdx === -1) return null;
        const nowPh = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const diff = ((targetIdx - nowPh.getDay()) + 7) % 7 || 7; // always next occurrence
        const target = new Date(nowPh);
        target.setDate(nowPh.getDate() + diff);
        return target.toISOString().slice(0, 10);
    }

    async ensureConflictCheckerLoaded() {
        if (typeof ConflictChecker !== 'undefined') return true;
        if (this._conflictLoaderPromise) return this._conflictLoaderPromise;
        this._conflictLoaderPromise = new Promise((resolve) => {
            const existing = document.querySelector('script[data-conflict-checker="1"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(true), { once: true });
                existing.addEventListener('error', () => resolve(false), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = '/shared/js/utils/ConflictChecker.js';
            script.async = true;
            script.dataset.conflictChecker = '1';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
        return this._conflictLoaderPromise;
    }

    setSubmitDisabled(blocked, reason = '') {
        const form = document.getElementById('modal-form');
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        submitBtn.disabled = !!blocked;
        if (blocked && reason) {
            submitBtn.title = reason;
        } else {
            submitBtn.removeAttribute('title');
        }
    }

    async runModalConflictCheck({ day, start, end, roomMeta, scheduleId }) {
        const ready = await this.ensureConflictCheckerLoaded();
        if (!ready || typeof ConflictChecker === 'undefined') return;
        const containerId = 'schedule-conflict-display';
        const containerEl = document.getElementById(containerId);
        if (!containerEl) return;
        if (!this.scheduleConflictChecker || this.scheduleConflictChecker.container !== containerEl) {
            this.scheduleConflictChecker = new ConflictChecker(containerId);
        }

        const labSelect = document.getElementById('schedule-lab');
        const selectedLab = labSelect?.selectedOptions?.[0] || null;
        const labLabel = roomMeta?.label
            || selectedLab?.dataset?.roomLabel
            || selectedLab?.dataset?.locationValue
            || selectedLab?.textContent?.trim()
            || '';
        const roomId = selectedLab?.value ? Number(selectedLab.value) || null : null;
        const dateNeeded = this.getNextDateForDay(day);

        if (!labLabel || !dateNeeded || !start || !end) {
            this.scheduleConflictChecker.clear();
            this.setSubmitDisabled(false);
            return;
        }

        this.scheduleConflictChecker.checkDebounced({
            lab_room: labLabel,
            room_id: roomId,
            date_needed: dateNeeded,
            time_start: `${start}:00`,
            time_end: `${end}:00`,
            exclude_schedule_id: scheduleId || null,
            include_pending_requests: false,
            include_requests: false
        }).then((result) => {
            if (!result || result.error) {
                this.setSubmitDisabled(false);
                return;
            }
            if (result.hasConflict) {
                const count = Array.isArray(result.conflicts) ? result.conflicts.length : 1;
                const reason = count > 1
                    ? `${count} conflicts detected. Resolve before submitting.`
                    : 'A conflict is detected. Resolve before submitting.';
                this.setSubmitDisabled(true, reason);
            } else {
                this.setSubmitDisabled(false);
            }
        }).catch(() => {
            this.setSubmitDisabled(false);
        });
    }

    /**
     * Load programs from Academic Directory for dropdowns
     */
    async loadProgramOptions(selectId = 'user-program', placeholder = 'Select Program') {
        try {
            if (!Array.isArray(this.programsCache)) {
                const response = await fetch('/api/academic-directory/programs', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.programsCache = await response.json();
            }

            const select = document.getElementById(selectId);
            if (!select) return;

            const previousValue = select.value;
            if (!this.programsCache.length) {
                select.innerHTML = '<option value="" disabled>No programs available</option>';
                select.value = '';
                select.disabled = true;
                return;
            }

            select.disabled = false;
            select.innerHTML = `<option value="">${placeholder}</option>`;
            this.programsCache.forEach(program => {
                const option = document.createElement('option');
                option.value = String(program.program_id);
                option.textContent = this.formatProgramLabel(program);
                option.dataset.programCode = program.program_code || '';
                option.dataset.programName = program.program_name || '';
                select.appendChild(option);
            });

            if (previousValue) {
                select.value = previousValue;
            }
        } catch (error) {
            console.error('ModalManager: Failed to load programs:', error);
            this.showToast('Unable to load programs list', 'error');
        }
    }

    /**
     * Load rooms for schedule modal dropdowns
     */
    async loadRoomOptions(selectId = 'schedule-lab') {
        const select = document.getElementById(selectId);
        if (!select) return;

        const previousValue = select.value;
        select.disabled = true;
        select.innerHTML = '<option value="">Loading lab rooms...</option>';

        try {
            if (!Array.isArray(this.roomsCache)) {
                const response = await fetch('/api/academic-directory/rooms', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.roomsCache = await response.json();
            }

            if (!this.roomsCache?.length) {
                select.innerHTML = '<option value="">No laboratories available</option>';
                return;
            }

            const labRooms = this.roomsCache.filter(room => this.isComputerLabRoom(room));

            if (!labRooms.length) {
                select.innerHTML = '<option value="">No computer laboratories available</option>';
                return;
            }

            select.innerHTML = '<option value="">Select Laboratory</option>';
            labRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = String(room.room_id);
                option.textContent = this.formatRoomLabel(room);
                option.dataset.roomLabel = option.textContent;
                option.dataset.roomName = room.room_name || '';
                option.dataset.roomNumber = room.room_number || '';
                select.appendChild(option);
            });

            if (previousValue && Array.from(select.options || []).some(opt => opt.value === previousValue)) {
                select.value = previousValue;
            }

            select.disabled = false;
        } catch (error) {
            console.error('ModalManager: Failed to load rooms:', error);
            select.innerHTML = '<option value="">Unable to load laboratories</option>';
            select.disabled = false;
            this.showToast('Unable to load laboratory list', 'error');
        }
    }

    /**
     * Load subjects for schedule modal dropdowns
     */
    async loadSubjectOptions(selectId = 'schedule-subject') {
        const select = document.getElementById(selectId);
        if (!select) return;

        const previousValue = select.value;
        select.disabled = true;
        select.innerHTML = '<option value="">Loading subjects...</option>';

        try {
            if (!Array.isArray(this.subjectsCache)) {
                const response = await fetch('/api/academic-directory/subjects', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.subjectsCache = await response.json();
            }

            if (!this.subjectsCache?.length) {
                select.innerHTML = '<option value="">No subjects available</option>';
                return;
            }

            select.innerHTML = '<option value="">Select Subject</option>';
            this.subjectsCache.forEach(subject => {
                const option = document.createElement('option');
                option.value = String(subject.subject_id);
                option.textContent = this.formatSubjectLabel(subject);
                option.dataset.subjectCode = subject.subject_code || '';
                option.dataset.subjectName = subject.subject_name || '';
                option.dataset.subjectLabel = option.textContent;
                select.appendChild(option);
            });

            if (previousValue && Array.from(select.options || []).some(opt => opt.value === previousValue)) {
                select.value = previousValue;
            }

            select.disabled = false;
        } catch (error) {
            console.error('ModalManager: Failed to load subjects:', error);
            select.innerHTML = '<option value="">Unable to load subjects</option>';
            select.disabled = false;
            this.showToast('Unable to load subject list', 'error');
        }
    }

    /**
     * Load departments from Academic Directory for dropdowns
     */
    async loadDepartmentOptions(selectId = 'user-department') {
        try {
            if (!Array.isArray(this.departmentsCache)) {
                const response = await fetch('/api/academic-directory/departments', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.departmentsCache = await response.json();
            }

            const select = document.getElementById(selectId);
            if (!select) return;

            const previousValue = select.value;
            if (!this.departmentsCache.length) {
                select.innerHTML = '<option value="" disabled>No departments available</option>';
                select.value = '';
                return;
            }

            select.innerHTML = '<option value="">Select Department</option>';
            this.departmentsCache.forEach(dept => {
                select.innerHTML += `<option value="${dept.department_id}">${dept.department_name}</option>`;
            });

            if (previousValue) {
                select.value = previousValue;
            }
        } catch (error) {
            console.error('ModalManager: Failed to load departments:', error);
            this.showToast('Unable to load departments list', 'error');
        }
    }

    getAddDepartmentModalContent() {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add Department</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="department-code">Department Code</label>
                    <input type="text" id="department-code" class="form-input" placeholder="e.g., CITE" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="department-name">Department Name</label>
                    <input type="text" id="department-name" class="form-input" placeholder="e.g., College of Information Technology Education" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Department</button>
                </div>
            </form>
        `;
    }

    getEditDepartmentModalContent(data) {
        const department = data?.department || {};
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Department</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="department-id" value="${department.department_id || ''}">
                <div class="form-group">
                    <label for="department-code">Department Code</label>
                    <input type="text" id="department-code" class="form-input" value="${this.escapeAttr(department.department_code || '')}" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="department-name">Department Name</label>
                    <input type="text" id="department-name" class="form-input" value="${this.escapeAttr(department.department_name || '')}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
    }

    initializeAddDepartmentModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._addDepartmentHandler) {
            form.removeEventListener('submit', this._addDepartmentHandler);
        }
        this._addDepartmentHandler = (e) => this.handleDepartmentSubmit(e, data, 'add');
        form.addEventListener('submit', this._addDepartmentHandler);
    }

    initializeEditDepartmentModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._editDepartmentHandler) {
            form.removeEventListener('submit', this._editDepartmentHandler);
        }
        this._editDepartmentHandler = (e) => this.handleDepartmentSubmit(e, data, 'edit');
        form.addEventListener('submit', this._editDepartmentHandler);
    }

    async handleDepartmentSubmit(e, data, mode = 'add') {
        e.preventDefault();
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || (mode === 'add' ? 'Add Department' : 'Save Changes');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'add' ? 'Saving...' : 'Updating...';
        }

        try {
            const codeInput = document.getElementById('department-code');
            const nameInput = document.getElementById('department-name');
            const code = codeInput?.value.trim().toUpperCase();
            const name = nameInput?.value.trim();

            if (!code || !name) {
                this.showToast('Department code and name are required.', 'warning');
                this.resetSubmitButton(submitBtn, originalText);
                this.isSubmitting = false;
                return;
            }

            const payload = { department_code: code, department_name: name };
            const headers = { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
            let response;
            if (mode === 'add') {
                response = await fetch('/api/academic-directory/departments', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                const id = document.getElementById('department-id')?.value || data?.department?.department_id;
                if (!id) throw new Error('Missing department identifier.');
                response = await fetch(`/api/academic-directory/departments/${id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Request failed.');
            }

            this.showToast(`Department ${mode === 'add' ? 'added' : 'updated'} successfully.`, 'success');
            this.hide();
            data?.onSuccess?.();
        } catch (error) {
            console.error('ModalManager: Department submit error:', error);
            this.showToast(error.message || 'Failed to save department.', 'error');
            this.resetSubmitButton(submitBtn, originalText);
        } finally {
            this.isSubmitting = false;
        }
    }

    getAddSubjectModalContent() {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add Subject</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="subject-code">Subject Code</label>
                    <input type="text" id="subject-code" class="form-input" placeholder="e.g., IT 101" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="subject-name">Subject Name</label>
                    <input type="text" id="subject-name" class="form-input" placeholder="e.g., Introduction to Computing" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Subject</button>
                </div>
            </form>
        `;
    }

    getEditSubjectModalContent(data) {
        const subject = data?.subject || {};
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Subject</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="subject-id" value="${subject.subject_id || ''}">
                <div class="form-group">
                    <label for="subject-code">Subject Code</label>
                    <input type="text" id="subject-code" class="form-input" value="${this.escapeAttr(subject.subject_code || '')}" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="subject-name">Subject Name</label>
                    <input type="text" id="subject-name" class="form-input" value="${this.escapeAttr(subject.subject_name || '')}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
    }

    initializeAddSubjectModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._addSubjectHandler) {
            form.removeEventListener('submit', this._addSubjectHandler);
        }
        this._addSubjectHandler = (e) => this.handleSubjectSubmit(e, data, 'add');
        form.addEventListener('submit', this._addSubjectHandler);
    }

    initializeEditSubjectModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._editSubjectHandler) {
            form.removeEventListener('submit', this._editSubjectHandler);
        }
        this._editSubjectHandler = (e) => this.handleSubjectSubmit(e, data, 'edit');
        form.addEventListener('submit', this._editSubjectHandler);
    }

    async handleSubjectSubmit(e, data, mode = 'add') {
        e.preventDefault();
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || (mode === 'add' ? 'Add Subject' : 'Save Changes');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'add' ? 'Saving...' : 'Updating...';
        }

        try {
            const codeInput = document.getElementById('subject-code');
            const nameInput = document.getElementById('subject-name');
            const code = codeInput?.value.trim().toUpperCase();
            const name = nameInput?.value.trim();

            if (!code || !name) {
                this.showToast('Subject code and name are required.', 'warning');
                this.resetSubmitButton(submitBtn, originalText);
                this.isSubmitting = false;
                return;
            }

            const payload = { subject_code: code, subject_name: name };
            const headers = { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
            let response;
            if (mode === 'add') {
                response = await fetch('/api/academic-directory/subjects', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                const id = document.getElementById('subject-id')?.value || data?.subject?.subject_id;
                if (!id) throw new Error('Missing subject identifier.');
                response = await fetch(`/api/academic-directory/subjects/${id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Request failed.');
            }

            this.showToast(`Subject ${mode === 'add' ? 'added' : 'updated'} successfully.`, 'success');
            this.hide();
            data?.onSuccess?.();
        } catch (error) {
            console.error('ModalManager: Subject submit error:', error);
            this.showToast(error.message || 'Failed to save subject.', 'error');
            this.resetSubmitButton(submitBtn, originalText);
        } finally {
            this.isSubmitting = false;
        }
    }

    getAddProgramModalContent() {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add Program</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="program-code">Program Code</label>
                    <input type="text" id="program-code" class="form-input" placeholder="e.g., BSIT" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="program-name">Program Name</label>
                    <input type="text" id="program-name" class="form-input" placeholder="e.g., Bachelor of Science in Information Technology" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Program</button>
                </div>
            </form>
        `;
    }

    getEditProgramModalContent(data) {
        const program = data?.program || {};
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Program</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="program-id" value="${program.program_id || ''}">
                <div class="form-group">
                    <label for="program-code">Program Code</label>
                    <input type="text" id="program-code" class="form-input" value="${this.escapeAttr(program.program_code || '')}" maxlength="20" required>
                </div>
                <div class="form-group">
                    <label for="program-name">Program Name</label>
                    <input type="text" id="program-name" class="form-input" value="${this.escapeAttr(program.program_name || '')}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
    }

    initializeAddProgramModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._addProgramHandler) {
            form.removeEventListener('submit', this._addProgramHandler);
        }
        this._addProgramHandler = (e) => this.handleProgramSubmit(e, data, 'add');
        form.addEventListener('submit', this._addProgramHandler);
    }

    initializeEditProgramModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._editProgramHandler) {
            form.removeEventListener('submit', this._editProgramHandler);
        }
        this._editProgramHandler = (e) => this.handleProgramSubmit(e, data, 'edit');
        form.addEventListener('submit', this._editProgramHandler);
    }

    async handleProgramSubmit(e, data, mode = 'add') {
        e.preventDefault();
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || (mode === 'add' ? 'Add Program' : 'Save Changes');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'add' ? 'Saving...' : 'Updating...';
        }

        try {
            const codeInput = document.getElementById('program-code');
            const nameInput = document.getElementById('program-name');
            const code = codeInput?.value.trim().toUpperCase();
            const name = nameInput?.value.trim();

            if (!code || !name) {
                this.showToast('Program code and name are required.', 'warning');
                this.resetSubmitButton(submitBtn, originalText);
                this.isSubmitting = false;
                return;
            }

            const payload = { program_code: code, program_name: name };
            const headers = { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
            let response;
            if (mode === 'add') {
                response = await fetch('/api/academic-directory/programs', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                const id = document.getElementById('program-id')?.value || data?.program?.program_id;
                if (!id) throw new Error('Missing program identifier.');
                response = await fetch(`/api/academic-directory/programs/${id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Request failed.');
            }

            this.showToast(`Program ${mode === 'add' ? 'added' : 'updated'} successfully.`, 'success');
            this.hide();
            data?.onSuccess?.();
        } catch (error) {
            console.error('ModalManager: Program submit error:', error);
            this.showToast(error.message || 'Failed to save program.', 'error');
            this.resetSubmitButton(submitBtn, originalText);
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * Hide modal
     */
    hide() {
        if (this.isVisible && this.modalContainer) {
            this.modalContainer.classList.remove('active');
            this.isVisible = false;
            this.currentModal = null;
            this.currentData = null;
            
            // Reset submission flag when modal is hidden
            this.isSubmitting = false;
            
            // Clear modal content
            if (this.modalContent) {
                this.modalContent.innerHTML = '';
            }
            
        }
    }

    /**
     * Get modal content based on type
     * @param {string} type - Modal type
     * @param {object} data - Modal data
     * @returns {string} HTML content
     */
    async getModalContent(type, data) {
        switch (type) {
            case 'add-user':
                return this.getAddUserModalContent(data);
            case 'edit-user':
                return this.getEditUserModalContent(data);
            case 'add-schedule':
                return this.getAddScheduleModalContent(data);
            case 'edit-schedule':
                return this.getEditScheduleModalContent(data);
            case 'add-equipment':
                return this.getAddEquipmentModalContent(data);
            case 'edit-equipment':
                return this.getEditEquipmentModalContent(data);
            case 'add-room':
                return this.getAddRoomModalContent(data);
            case 'edit-room':
                return this.getEditRoomModalContent(data);
            case 'add-program':
                return this.getAddProgramModalContent(data);
            case 'edit-program':
                return this.getEditProgramModalContent(data);
            case 'add-subject':
                return this.getAddSubjectModalContent(data);
            case 'edit-subject':
                return this.getEditSubjectModalContent(data);
            case 'add-department':
                return this.getAddDepartmentModalContent(data);
            case 'edit-department':
                return this.getEditDepartmentModalContent(data);
            case 'add-building':
                return this.getAddBuildingModalContent(data);
            case 'edit-building':
                return this.getEditBuildingModalContent(data);
            case 'confirm':
                return this.getConfirmModalContent(data);
            case 'alert':
                return this.getAlertModalContent(data);
            case 'form':
                return this.getFormModalContent(data);
            default:
                throw new Error(`Unknown modal type: ${type}`);
        }
    }

    /**
     * Initialize modal-specific functionality
     */
    initializeModal(type, data) {
        switch (type) {
            case 'add-user':
                this.initializeAddUserModal(data);
                break;
            case 'edit-user':
                this.initializeEditUserModal(data);
                break;
            case 'add-schedule':
                this.initializeAddScheduleModal(data);
                break;
            case 'edit-schedule':
                this.initializeEditScheduleModal(data);
                break;
            case 'add-equipment':
                this.initializeAddEquipmentModal(data);
                break;
            case 'edit-equipment':
                this.initializeEditEquipmentModal(data);
                break;
            case 'add-room':
                this.initializeAddRoomModal(data);
                break;
            case 'edit-room':
                this.initializeEditRoomModal(data);
                break;
            case 'add-program':
                this.initializeAddProgramModal(data);
                break;
            case 'edit-program':
                this.initializeEditProgramModal(data);
                break;
            case 'add-subject':
                this.initializeAddSubjectModal(data);
                break;
            case 'edit-subject':
                this.initializeEditSubjectModal(data);
                break;
            case 'add-department':
                this.initializeAddDepartmentModal(data);
                break;
            case 'edit-department':
                this.initializeEditDepartmentModal(data);
                break;
            case 'add-building':
                this.initializeAddBuildingModal(data);
                break;
            case 'edit-building':
                this.initializeEditBuildingModal(data);
                break;
            case 'confirm':
                this.initializeConfirmModal(data);
                break;
            case 'alert':
                this.initializeAlertModal(data);
                break;
            case 'form':
                this.initializeFormModal(data);
                break;
        }

        // Initialize common modal events
        this.initializeCommonEvents();
    }

    // =========================================
    // 2. MODAL CONTENT TEMPLATES (HTML)
    // =========================================

    /**
     * Add User modal content
     */
    getAddUserModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add New User</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="user-full-name">Full Name</label>
                    <input type="text" id="user-full-name" name="full-name" class="form-input" placeholder="Enter full name (e.g., Juan Dela Cruz)" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="user-email">Email</label>
                    <input type="email" id="user-email" name="email" class="form-input" placeholder="Enter email address" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="user-password">Password</label>
                    <input type="password" id="user-password" name="password" class="form-input" placeholder="Enter password" autocomplete="new-password" required>
                    <small class="form-help">Password is required for new users</small>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="user-role">Role</label>
                        <select id="user-role" name="role" class="form-select" required>
                            <option value="">Select Role</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="user-status">Status</label>
                        <select id="user-status" name="status" class="form-select" required>
                            <option value="">Select Status</option>
                        </select>
                    </div>
                </div>
                
                <!-- Student-specific fields -->
                <div id="student-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="user-program">Program</label>
                            <select id="user-program" name="program_id" class="form-select">
                                <option value="">Loading programs...</option>
                            </select>
                            <small class="form-help">Programs come from the Academic Directory</small>
                        </div>
                        <div class="form-group">
                            <label for="user-year">Year Level</label>
                            <select id="user-year" name="year" class="form-select">
                                <option value="">Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                                <option value="5">5th Year</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Faculty-specific fields -->
                <div id="faculty-fields" style="display: none;">
                    <div class="form-group">
                        <label for="user-department">Department</label>
                        <select id="user-department" name="department_id" class="form-select">
                            <option value="">Loading departments...</option>
                        </select>
                        <small class="form-help">Departments come from the Academic Directory</small>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add User</button>
                </div>
            </form>
        `;
    }

    /**
     * Edit User modal content
     */
    getEditUserModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit User</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="user-full-name">Full Name</label>
                    <input type="text" id="user-full-name" name="full-name" class="form-input" placeholder="Enter full name (e.g., Juan Dela Cruz)" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="user-email">Email</label>
                    <input type="email" id="user-email" name="email" class="form-input" placeholder="Enter email address" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="user-password">Password</label>
                    <input type="password" id="user-password" name="password" class="form-input" placeholder="Leave blank to keep current password" autocomplete="new-password">
                    <small class="form-help">Leave blank to keep current password</small>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="user-role">Role</label>
                        <select id="user-role" name="role" class="form-select" required>
                            <option value="">Select Role</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="user-status">Status</label>
                        <select id="user-status" name="status" class="form-select" required>
                            <option value="">Select Status</option>
                        </select>
                    </div>
                </div>
                
                <!-- Student-specific fields -->
                <div id="student-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="user-program">Program</label>
                            <select id="user-program" name="program_id" class="form-select">
                                <option value="">Loading programs...</option>
                            </select>
                            <small class="form-help">Programs come from the Academic Directory</small>
                        </div>
                        <div class="form-group">
                            <label for="user-year">Year Level</label>
                            <select id="user-year" name="year" class="form-select">
                                <option value="">Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                                <option value="5">5th Year</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Faculty-specific fields -->
                <div id="faculty-fields" style="display: none;">
                    <div class="form-group">
                        <label for="user-department">Department</label>
                        <select id="user-department" name="department" class="form-select">
                            <option value="">Select Department</option>
                            <option value="Computer Science">Computer Science</option>
                            <option value="Information Technology">Information Technology</option>
                            <option value="Engineering">Engineering</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Physics">Physics</option>
                            <option value="Chemistry">Chemistry</option>
                            <option value="Biology">Biology</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update User</button>
                </div>
            </form>
        `;
    }

    /**
     * Confirmation modal content
     * @param {Object} data
     * @param {string} [data.type] - 'warning'|'danger'|'info'|'success'
     * @param {string} [data.confirmText] - Custom confirm button text
     * @param {string} [data.cancelText] - Custom cancel button text
     */
    getConfirmModalContent(data) {
        const type = data.type || 'warning';
        const confirmText = data.confirmText || 'Confirm';
        const cancelText = data.cancelText || 'Cancel';

        const icons = {
            warning: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            danger:  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            info:    `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
            success: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        };

        const iconColors = {
            warning: { bg: '#fef3e2', color: '#d97706' },
            danger:  { bg: '#fee2e2', color: '#dc2626' },
            info:    { bg: '#dbeafe', color: '#2563eb' },
            success: { bg: '#d1fae5', color: '#059669' }
        };

        const btnColors = {
            warning: 'background:#800000;color:#fff;',
            danger:  'background:#dc2626;color:#fff;',
            info:    'background:#3b82f6;color:#fff;',
            success: 'background:#10b981;color:#fff;'
        };

        const ic = iconColors[type] || iconColors.warning;

        return `
            <div class="modal-header">
                <h4 id="modal-title">${data.title || 'Confirm Action'}</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <div class="modal-body" style="text-align:center;padding:1.5rem 2rem;">
                <div style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;background:${ic.bg};color:${ic.color};">
                    ${icons[type] || icons.warning}
                </div>
                <p style="color:#4b5563;font-size:0.95rem;line-height:1.5;margin:0 0 1.5rem;">${data.message || 'Are you sure you want to proceed?'}</p>
                <div class="form-actions" style="justify-content:center;">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
                    <button type="button" class="btn" id="modal-confirm" style="${btnColors[type] || btnColors.warning}">${confirmText}</button>
                </div>
            </div>
        `;
    }

    /**
     * Alert modal content
     */
    getAlertModalContent(data) {
        const alertClass = data.type || 'info';
        return `
            <div class="modal-header">
                <h4 id="modal-title">${data.title || 'Alert'}</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="alert alert-${alertClass}">
                    <p>${data.message || 'Alert message'}</p>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary" id="modal-ok">OK</button>
                </div>
            </div>
        `;
    }

    /**
     * Generic form modal content
     */
    getFormModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">${data.title || 'Form'}</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body">
                ${data.formContent || '<p>No form content provided</p>'}
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">${data.submitText || 'Submit'}</button>
                </div>
            </form>
        `;
    }

    /**
     * Add Schedule modal content
     */
    getAddScheduleModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add New Schedule</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-lab">Laboratory</label>
                        <select id="schedule-lab" name="room_id" class="form-select" required>
                            <option value="">Loading labs...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-day">Day</label>
                        <select id="schedule-day" name="day" class="form-select" required>
                            <option value="">Select Day</option>
                            <option value="MONDAY">Monday</option>
                            <option value="TUESDAY">Tuesday</option>
                            <option value="WEDNESDAY">Wednesday</option>
                            <option value="THURSDAY">Thursday</option>
                            <option value="FRIDAY">Friday</option>
                            <option value="SATURDAY">Saturday</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-time-start">Time Start</label>
                        <select id="schedule-time-start" name="time-start" class="form-select" required data-time-select data-placeholder="Select start time">
                            <option value="">Loading slots...</option>
                        </select>
                        <small class="form-error" data-error="schedule-time-start"></small>
                        <div class="time-validation-card" data-time-card="start" style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;background:#f9fafb;font-size:0.78rem;">
                            <div class="time-validation-icon" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                            </div>
                            <div style="font-size:0.78rem;line-height:1.3;">
                                <div class="time-validation-title" style="font-size:0.8rem;font-weight:600;">Start Time</div>
                                <div class="time-validation-message" style="font-size:0.74rem;">Select a start time between 7:30 AM and 9:00 PM.</div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="schedule-time-end">Time End</label>
                        <select id="schedule-time-end" name="time-end" class="form-select" required data-time-select data-placeholder="Select end time">
                            <option value="">Loading slots...</option>
                        </select>
                        <small class="form-error" data-error="schedule-time-end"></small>
                        <div class="time-validation-card" data-time-card="end" style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;background:#f9fafb;font-size:0.78rem;">
                            <div class="time-validation-icon" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                            </div>
                            <div style="font-size:0.78rem;line-height:1.3;">
                                <div class="time-validation-title" style="font-size:0.8rem;font-weight:600;">End Time</div>
                                <div class="time-validation-message" style="font-size:0.74rem;">Select an end time at least 30 minutes after the start.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="schedule-conflict-display" class="conflict-container" style="display:none;"></div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-faculty">Faculty</label>
                        <select id="schedule-faculty" name="faculty" class="form-select" required>
                            <option value="">Select Faculty</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-subject">Subject</label>
                        <select id="schedule-subject" name="subject_id" class="form-select" required>
                            <option value="">Loading subjects...</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-program">Program</label>
                        <select id="schedule-program" name="program_id" class="form-select">
                            <option value="">Loading programs...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-year-level">Year Level</label>
                        <select id="schedule-year-level" name="year-level" class="form-select">
                            <option value="">Select Year</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                            <option value="5">5th Year</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Schedule</button>
                </div>
            </form>
        `;
    }

    /**
     * Edit Schedule modal content
     */
    getEditScheduleModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Schedule</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="schedule-id" name="schedule-id" value="${data.scheduleId || ''}">
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-lab">Laboratory</label>
                        <select id="schedule-lab" name="room_id" class="form-select" required>
                            <option value="">Loading labs...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-day">Day</label>
                        <select id="schedule-day" name="day" class="form-select" required>
                            <option value="">Select Day</option>
                            <option value="MONDAY">Monday</option>
                            <option value="TUESDAY">Tuesday</option>
                            <option value="WEDNESDAY">Wednesday</option>
                            <option value="THURSDAY">Thursday</option>
                            <option value="FRIDAY">Friday</option>
                            <option value="SATURDAY">Saturday</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-time-start">Time Start</label>
                        <select id="schedule-time-start" name="time-start" class="form-select" required data-time-select data-placeholder="Select start time">
                            <option value="">Loading slots...</option>
                        </select>
                        <small class="form-error" data-error="schedule-time-start"></small>
                        <div class="time-validation-card" data-time-card="start" style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;background:#f9fafb;font-size:0.78rem;">
                            <div class="time-validation-icon" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                            </div>
                            <div style="font-size:0.78rem;line-height:1.3;">
                                <div class="time-validation-title" style="font-size:0.8rem;font-weight:600;">Start Time</div>
                                <div class="time-validation-message" style="font-size:0.74rem;">Select a start time between 7:30 AM and 9:00 PM.</div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="schedule-time-end">Time End</label>
                        <select id="schedule-time-end" name="time-end" class="form-select" required data-time-select data-placeholder="Select end time">
                            <option value="">Loading slots...</option>
                        </select>
                        <small class="form-error" data-error="schedule-time-end"></small>
                        <div class="time-validation-card" data-time-card="end" style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;background:#f9fafb;font-size:0.78rem;">
                            <div class="time-validation-icon" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                            </div>
                            <div style="font-size:0.78rem;line-height:1.3;">
                                <div class="time-validation-title" style="font-size:0.8rem;font-weight:600;">End Time</div>
                                <div class="time-validation-message" style="font-size:0.74rem;">Select an end time at least 30 minutes after the start.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="schedule-conflict-display" class="conflict-container" style="display:none;"></div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-faculty">Faculty</label>
                        <select id="schedule-faculty" name="faculty" class="form-select" required>
                            <option value="">Select Faculty</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-subject">Subject</label>
                        <select id="schedule-subject" name="subject_id" class="form-select" required>
                            <option value="">Loading subjects...</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="schedule-program">Program</label>
                        <select id="schedule-program" name="program_id" class="form-select">
                            <option value="">Loading programs...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-year-level">Year Level</label>
                        <select id="schedule-year-level" name="year-level" class="form-select">
                            <option value="">Select Year</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                            <option value="5">5th Year</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Schedule</button>
                </div>
            </form>
        `;
    }

    // =========================================
    // 3. MODAL INITIALIZATION LOGIC
    // =========================================

    /**
     * Initialize add user modal
     */
    async initializeAddUserModal(data) {
        // Load roles and statuses
        await this.loadRolesAndStatuses();

        // Load dropdown data
        await this.loadProgramOptions();
        await this.loadDepartmentOptions();
        
        // Setup role change handler
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) {
            // Remove existing listeners to prevent duplicates
            roleSelect.removeEventListener('change', this.toggleRoleFields);
            roleSelect.addEventListener('change', () => this.toggleRoleFields());
        }

        // Setup form submission only (remove duplicate button handler)
        const form = document.getElementById('modal-form');
        if (form) {
            // Remove existing listeners to prevent duplicates
            const newHandler = (e) => this.handleAddUserSubmit(e, data);
            form.removeEventListener('submit', this._addUserHandler);
            this._addUserHandler = newHandler;
            form.addEventListener('submit', newHandler);
        }
    }

    /**
     * Initialize edit user modal
     */
    async initializeEditUserModal(data) {
        // Load roles and statuses
        await this.loadRolesAndStatuses();
        
        // Load dropdown data
        await this.loadProgramOptions();
        await this.loadDepartmentOptions();

        // Load user data
        await this.loadUserData(data.userId);
        
        // Setup role change handler
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) {
            // Remove existing listeners to prevent duplicates
            roleSelect.removeEventListener('change', this.toggleRoleFields);
            roleSelect.addEventListener('change', () => this.toggleRoleFields());
        }

        // Setup form submission only (remove duplicate button handler)
        const form = document.getElementById('modal-form');
        if (form) {
            // Remove existing listeners to prevent duplicates
            const newHandler = (e) => this.handleEditUserSubmit(e, data);
            form.removeEventListener('submit', this._editUserHandler);
            this._editUserHandler = newHandler;
            form.addEventListener('submit', newHandler);
        }
    }

    /**
     * Initialize add schedule modal
     */
    async initializeAddScheduleModal(data) {
        await Promise.all([
            this.loadFacultyDropdown(),
            this.loadRoomOptions('schedule-lab'),
            this.loadSubjectOptions('schedule-subject'),
            this.loadProgramOptions('schedule-program', 'Select Program')
        ]);
        this.populateTimeDropdowns(this.modalContent);
        const addForm = document.getElementById('modal-form');
        const runCheck = this.registerScheduleConflictWatcher(addForm, 'add');
        if (typeof runCheck === 'function') {
            setTimeout(runCheck, 0);
            setTimeout(runCheck, 200);
        }
        
        // Setup form submission
        if (addForm) {
            // Remove existing listeners to prevent duplicates
            const newHandler = (e) => this.handleAddScheduleSubmit(e, data);
            addForm.removeEventListener('submit', this._addScheduleHandler);
            this._addScheduleHandler = newHandler;
            addForm.addEventListener('submit', newHandler);
        }
    }

    /**
     * Initialize edit schedule modal
     */
    async initializeEditScheduleModal(data) {
        await Promise.all([
            this.loadFacultyDropdown(),
            this.loadRoomOptions('schedule-lab'),
            this.loadSubjectOptions('schedule-subject'),
            this.loadProgramOptions('schedule-program', 'Select Program')
        ]);
        this.populateTimeDropdowns(this.modalContent);
        await this.loadScheduleData(data.scheduleId);
        const editForm = document.getElementById('modal-form');
        const runCheck = this.registerScheduleConflictWatcher(editForm, 'edit', data.scheduleId);
        if (typeof runCheck === 'function') {
            setTimeout(runCheck, 0);
            setTimeout(runCheck, 200);
        }
        
        // Setup form submission
        if (editForm) {
            // Remove existing listeners to prevent duplicates
            const newHandler = (e) => this.handleEditScheduleSubmit(e, data);
            editForm.removeEventListener('submit', this._editScheduleHandler);
            this._editScheduleHandler = newHandler;
            editForm.addEventListener('submit', newHandler);
        }
    }

    /**
     * Initialize confirmation modal
     */
    initializeConfirmModal(data) {
        const confirmBtn = document.getElementById('modal-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (data.onConfirm) {
                    data.onConfirm();
                }
                this.hide();
            });
        }
    }

    /**
     * Initialize alert modal
     */
    initializeAlertModal(data) {
        const okBtn = document.getElementById('modal-ok');
        if (okBtn) {
            okBtn.addEventListener('click', () => {
                if (data.onOk) {
                    data.onOk();
                }
                this.hide();
            });
        }
    }

    /**
     * Initialize form modal
     */
    initializeFormModal(data) {
        const form = document.getElementById('modal-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (data.onSubmit) {
                    data.onSubmit(new FormData(form));
                }
                this.hide();
            });
        }
    }

    /**
     * Initialize common modal events
     */
    initializeCommonEvents() {
        // Close button
        const closeBtn = document.getElementById('modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Cancel button
        const cancelBtn = document.getElementById('modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }
    }

    // =========================================
    // 4. USER MANAGEMENT MODALS (Add/Edit)
    // =========================================

    /**
     * Load roles and statuses for user modal
     */
    async loadRolesAndStatuses() {
        try {
            // Load roles
            const rolesResponse = await fetch('/api/users-role', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            const roles = await rolesResponse.json();
            const roleSelect = document.getElementById('user-role');
            
            if (roleSelect) {
                roleSelect.innerHTML = '<option value="">Select Role</option>';
                roles.forEach(role => {
                    roleSelect.innerHTML += `<option value="${role.role_id}">${role.role_name}</option>`;
                });
            }

            // Load statuses
            const statusResponse = await fetch('/api/users-status', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            const statuses = await statusResponse.json();
            const statusSelect = document.getElementById('user-status');
            
            if (statusSelect) {
                statusSelect.innerHTML = '<option value="">Select Status</option>';
                statuses.forEach(status => {
                    statusSelect.innerHTML += `<option value="${status.status_id}">${status.status_name}</option>`;
                });
            }
        } catch (error) {
            console.error('ModalManager: Failed to load roles/statuses:', error);
        }
    }

    /**
     * Load user data for editing
     */
    async loadUserData(userId) {
        try {
            const response = await fetch(`/api/users/${userId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            const user = await response.json();

            // Populate form fields
            document.getElementById('user-full-name').value = user.full_name || '';
            document.getElementById('user-email').value = user.gmail || '';
            document.getElementById('user-role').value = user.role_id || '';
            document.getElementById('user-status').value = user.status_id || '';

            // Show role-specific fields
            this.toggleRoleFields();

            // Populate role-specific fields
            const roleName = (user.role_name || '').toLowerCase();

            if (roleName === 'student') {
                const programField = document.getElementById('user-program');
                if (programField) {
                    const programValue = user.program_id ? String(user.program_id) : '';
                    if (programValue) {
                        const hasOption = Array.from(programField.options).some(opt => opt.value === programValue);
                        if (!hasOption) {
                            const fallbackOption = document.createElement('option');
                            fallbackOption.value = programValue;
                            fallbackOption.textContent = user.program_name || user.program_code || '(Unavailable Program)';
                            programField.appendChild(fallbackOption);
                        }
                        programField.value = programValue;
                    } else {
                        programField.value = '';
                    }
                }
                const yearField = document.getElementById('user-year');
                if (yearField) {
                    yearField.value = user.year_level || '';
                }
            } else if (roleName === 'faculty') {
                const deptField = document.getElementById('user-department');
                if (deptField) {
                    deptField.value = user.department_id ? String(user.department_id) : '';
                }
            }

        } catch (error) {
            console.error('ModalManager: Failed to load user data:', error);
            this.showToast('Failed to load user data', 'error');
        }
    }

    /**
     * Toggle role-specific fields
     */
    toggleRoleFields() {
        const roleSelect = document.getElementById('user-role');
        const selectedOption = roleSelect.options[roleSelect.selectedIndex];
        const roleName = selectedOption ? selectedOption.text.toLowerCase() : '';

        // Hide all role-specific fields first
        const studentFields = document.getElementById('student-fields');
        const facultyFields = document.getElementById('faculty-fields');

        if (studentFields) studentFields.style.display = 'none';
        if (facultyFields) facultyFields.style.display = 'none';

        // Show relevant fields based on role
        if (roleName === 'student') {
            if (studentFields) studentFields.style.display = 'block';
            this.loadProgramOptions();
        } else if (roleName === 'faculty') {
            if (facultyFields) facultyFields.style.display = 'block';
        }
    }

    /**
     * Handle add user form submission
     */
    async handleAddUserSubmit(e, data) {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (this.isSubmitting) {
            return;
        }
        
        this.isSubmitting = true;
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
        }
        const formData = new FormData(form);

        try {
            // Collect form data
            const fullName = formData.get('full-name') || document.getElementById('user-full-name').value;
            const email = formData.get('email') || document.getElementById('user-email').value;
            const password = formData.get('password') || document.getElementById('user-password').value;
            const roleId = formData.get('role') || document.getElementById('user-role').value;
            const statusId = formData.get('status') || document.getElementById('user-status').value;

            // Validate required fields (all required for add)
            if (!fullName || !email || !password || !roleId || !statusId) {
                this.showToast('Please fill in all required fields', 'warning');
                this.resetSubmitButton(submitBtn, 'Add User');
                this.isSubmitting = false;
                return;
            }

            // Prepare payload
            const payload = {
                gmail: email,
                role_id: parseInt(roleId),
                full_name: fullName,
                password: password  // Backend expects 'password', not 'password_hash'
            };

            // Add role-specific fields
            const roleOptionAdd = form.querySelector('#user-role option:checked');
            const roleNameAdd = roleOptionAdd ? roleOptionAdd.text.toLowerCase() : '';
            if (roleNameAdd === 'student') {
                const programField = document.getElementById('user-program');
                const programValue = programField ? programField.value : '';
                const programId = parseInt(programValue, 10);
                if (!programValue || Number.isNaN(programId) || programId <= 0) {
                    this.showToast('Please select a program for student accounts', 'warning');
                    this.resetSubmitButton(submitBtn, 'Add User');
                    this.isSubmitting = false;
                    return;
                }

                const yearField = document.getElementById('user-year');
                const yearValue = yearField ? parseInt(yearField.value, 10) : NaN;
                if (!Number.isInteger(yearValue) || yearValue <= 0) {
                    this.showToast('Please select a valid year level for student accounts', 'warning');
                    this.resetSubmitButton(submitBtn, 'Add User');
                    this.isSubmitting = false;
                    return;
                }

                payload.program_id = programId;
                payload.year = yearValue;
            } else if (roleNameAdd === 'faculty') {
                const deptField = document.getElementById('user-department');
                const deptValue = deptField ? deptField.value : '';
                const departmentId = parseInt(deptValue, 10);
                if (!deptValue || Number.isNaN(departmentId) || departmentId <= 0) {
                    this.showToast('Please select a department for faculty members', 'warning');
                    this.resetSubmitButton(submitBtn, 'Add User');
                    this.isSubmitting = false;
                    return;
                }
                payload.department_id = departmentId;
            }

            // Make API call
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...SmartLab.Core.Auth.getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create user');
            }

            const result = await response.json();
            
            // Enhanced success notification
            const successMessage = result.message || `User "${fullName}" created successfully!`;
            this.showToast(successMessage, 'success');
            
            // Brief success feedback on button
            if (submitBtn) {
                submitBtn.textContent = '✅ Added!';
                submitBtn.style.backgroundColor = '#10b981';
            }

            // Hide modal and refresh users
            this.hide();
            
            // Trigger users refresh if callback exists
            if (data.onSuccess) {
                data.onSuccess();
            }

        } catch (error) {
            console.error('ModalManager: Error creating user:', error);
            this.showToast(error.message || 'Failed to create user', 'error');
            this.resetSubmitButton(submitBtn, 'Add User');
        } finally {
            // Reset submission flag
            this.isSubmitting = false;
        }
    }

    /**
     * Reset submit button state
     */
    resetSubmitButton(button, originalText) {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    /**
     * Handle edit user form submission
     */
    async handleEditUserSubmit(e, data) {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (this.isSubmitting) {
            return;
        }
        
        this.isSubmitting = true;
        
        const form = e.target;
        const formData = new FormData(form);
        const userId = data.userId;

        try {
            // Collect form data
            const fullName = formData.get('full-name') || document.getElementById('user-full-name').value;
            const email = formData.get('email') || document.getElementById('user-email').value;
            const password = formData.get('password') || document.getElementById('user-password').value;
            const roleId = formData.get('role') || document.getElementById('user-role').value;
            const statusId = formData.get('status') || document.getElementById('user-status').value;

            // Validate required fields (password optional for edit)
            if (!fullName || !email || !roleId || !statusId) {
                this.showToast('Please fill in all required fields', 'warning');
                this.isSubmitting = false;
                return;
            }

            // Prepare payload
            const payload = {
                gmail: email,
                role_id: parseInt(roleId),
                full_name: fullName,
                status_id: parseInt(statusId)
            };

            // Add password only if provided
            if (password) {
                payload.password_hash = password;  // Update endpoint expects 'password_hash'
            }

            // Add role-specific fields
            const roleOptionEdit = form.querySelector('#user-role option:checked');
            const roleNameEdit = roleOptionEdit ? roleOptionEdit.text.toLowerCase() : '';
            if (roleNameEdit === 'student') {
                const programField = document.getElementById('user-program');
                const programValue = programField ? programField.value : '';
                const programId = parseInt(programValue, 10);
                if (!programValue || Number.isNaN(programId) || programId <= 0) {
                    this.showToast('Please select a program for student accounts', 'warning');
                    this.isSubmitting = false;
                    return;
                }

                const yearField = document.getElementById('user-year');
                const yearValue = yearField ? parseInt(yearField.value, 10) : NaN;
                if (!Number.isInteger(yearValue) || yearValue <= 0) {
                    this.showToast('Please select a valid year level for student accounts', 'warning');
                    this.isSubmitting = false;
                    return;
                }

                payload.program_id = programId;
                payload.year_level = yearValue;
            } else if (roleNameEdit === 'faculty') {
                const deptField = document.getElementById('user-department');
                const deptValue = deptField ? deptField.value : '';
                const departmentId = parseInt(deptValue, 10);
                if (!deptValue || Number.isNaN(departmentId) || departmentId <= 0) {
                    this.showToast('Please select a department for faculty members', 'warning');
                    this.isSubmitting = false;
                    return;
                }
                payload.department_id = departmentId;
            }

            // Make API call
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...SmartLab.Core.Auth.getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update user');
            }

            const result = await response.json();
            
            // Enhanced success notification
            const successMessage = result.message || `User "${fullName}" updated successfully!`;
            this.showToast(successMessage, 'success');
            
            // Brief success feedback on button
            const editSubmitBtn = document.querySelector('button[type="submit"]');
            if (editSubmitBtn) {
                editSubmitBtn.textContent = '✅ Updated!';
                editSubmitBtn.style.backgroundColor = '#10b981';
            }

            // Hide modal and refresh users
            this.hide();
            
            // Trigger users refresh if callback exists
            if (data.onSuccess) {
                data.onSuccess();
            }

        } catch (error) {
            console.error('ModalManager: Error updating user:', error);
            this.showToast(error.message || 'Failed to update user', 'error');
        } finally {
            // Reset submission flag
            this.isSubmitting = false;
        }
    }

    // =========================================
    // 5. SCHEDULE MANAGEMENT MODALS (Add/Edit)
    // =========================================

    /**
     * Load faculty dropdown for schedule modals
     */
    async loadFacultyDropdown() {
        try {
            const response = await fetch('/api/faculty-list', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const faculty = await response.json();

            const facultySelect = document.getElementById('schedule-faculty');
            if (facultySelect) {
                facultySelect.innerHTML = '<option value="">Select Faculty</option>';
                
                faculty.forEach(fac => {
                    const option = document.createElement('option');
                    option.value = fac.faculty_id;
                    option.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
                    facultySelect.appendChild(option);
                });
                
            }
        } catch (error) {
            console.error('ModalManager: Failed to load faculty dropdown:', error);
            this.showToast('Unable to load faculty list', 'error');
        }
    }

    /**
     * Load schedule data for editing
     */
    async loadScheduleData(scheduleId) {
        try {
            const response = await fetch(`/api/labSchedule/${scheduleId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const schedule = await response.json();

            // Populate form fields
            const roomSelect = document.getElementById('schedule-lab');
            const programSelect = document.getElementById('schedule-program');
            const subjectSelect = document.getElementById('schedule-subject');

            if (roomSelect) {
                const roomId = schedule.room_id ? String(schedule.room_id) : '';
                if (roomId && schedule.lab_room) {
                    this.ensureOptionExists(roomSelect, roomId, schedule.lab_room, { roomLabel: schedule.lab_room });
                }
                roomSelect.value = roomId;
            }
            document.getElementById('schedule-day').value = schedule.day_of_week || '';
            document.getElementById('schedule-time-start').value = this.formatTimeForInput(schedule.time_start);
            document.getElementById('schedule-time-end').value = this.formatTimeForInput(schedule.time_end);
            document.getElementById('schedule-faculty').value = schedule.faculty_id || '';
            if (subjectSelect) {
                const subjectId = schedule.subject_id ? String(schedule.subject_id) : '';
                const subjectLabel = schedule.subject || schedule.subject_name || schedule.subject_code || 'Subject';
                if (subjectId && subjectLabel) {
                    this.ensureOptionExists(subjectSelect, subjectId, subjectLabel, { subjectLabel });
                }
                subjectSelect.value = subjectId;
            }
            if (programSelect) {
                const programId = schedule.program_id ? String(schedule.program_id) : '';
                const programLabel = schedule.program || schedule.program_name || schedule.program_code || '';
                if (programId && programLabel) {
                    this.ensureOptionExists(programSelect, programId, programLabel);
                }
                programSelect.value = programId;
            }
            document.getElementById('schedule-year-level').value = schedule.year_level || '';

        } catch (error) {
            console.error('ModalManager: Failed to load schedule data:', error);
            this.showToast('Failed to load schedule data', 'error');
        }
    }

    /**
     * Format time for input field (HH:MM)
     */
    formatTimeForInput(time) {
        if (!time) return '';
        
        // Handle both HH:MM:SS and HH:MM formats
        const timeStr = String(time);
        return timeStr.length > 5 ? timeStr.substring(0, 5) : timeStr;
    }

    /**
     * Handle add schedule form submission
     */
    async handleAddScheduleSubmit(e, data) {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (this.isSubmitting) {
            return;
        }
        
        this.isSubmitting = true;
        
        // Prevent multiple submissions
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
        }
        
        const form = e.target;
        const formData = new FormData(form);

        try {
            // Collect form data
            const roomIdValue = formData.get('room_id');
            const day = formData.get('day');
            const timeStart = formData.get('time-start') + ':00';  // Add seconds for backend
            const timeEnd = formData.get('time-end') + ':00';      // Add seconds for backend
            const facultyId = formData.get('faculty');
            const subjectIdValue = formData.get('subject_id');
            const programIdValue = formData.get('program_id');
            const yearLevel = formData.get('year-level');


            // Validate required fields
            if (!roomIdValue || !day || !timeStart || !timeEnd || !facultyId || !subjectIdValue) {
                this.showToast('Please fill in all required fields', 'warning');
                this.resetSubmitButton(submitBtn, 'Add Schedule');
                this.isSubmitting = false;
                return;
            }

            const roomId = parseInt(roomIdValue, 10);
            const facultyIdInt = parseInt(facultyId, 10);
            const subjectId = parseInt(subjectIdValue, 10);
            const programId = programIdValue ? parseInt(programIdValue, 10) : null;
            const yearLevelInt = yearLevel ? parseInt(yearLevel, 10) : null;

            if (!Number.isInteger(roomId) || roomId <= 0 || !Number.isInteger(facultyIdInt) || !Number.isInteger(subjectId)) {
                this.showToast('Invalid field selection detected. Please review your entries.', 'warning');
                this.resetSubmitButton(submitBtn, 'Add Schedule');
                this.isSubmitting = false;
                return;
            }

            // Validate time
            if (timeEnd <= timeStart) {
                this.showToast('End time must be after start time', 'warning');
                this.resetSubmitButton(submitBtn, 'Add Schedule');
                this.isSubmitting = false;
                return;
            }

            // Get current user ID for created_by
            const createdBy = sessionStorage.getItem('user_id');
            if (!createdBy) {
                this.showToast('You must be logged in to create schedules', 'error');
                this.resetSubmitButton(submitBtn, 'Add Schedule');
                this.isSubmitting = false;
                return;
            }

            // Check for conflicts using ScheduleManager
            const scheduleManager = window.scheduleManager;
            if (scheduleManager) {
                const roomMeta = this.getSelectedOptionMeta('schedule-lab');
                const programMeta = this.getSelectedOptionMeta('schedule-program');
                const subjectMeta = this.getSelectedOptionMeta('schedule-subject');
                const newSchedule = {
                    lab_room: roomMeta.label || 'Selected Laboratory',
                    faculty_id: facultyIdInt,
                    program: programMeta.label || null,
                    year_level: yearLevelInt,
                    subject: subjectMeta.label || 'Subject',
                    day_of_week: day,
                    time_start: timeStart,
                    time_end: timeEnd
                };

                const conflict = scheduleManager.checkScheduleConflict(newSchedule);
                if (conflict) {
                    this.showToast('Schedule conflicts with existing schedule! Please choose a different time or lab.', 'warning');
                    this.resetSubmitButton(submitBtn, 'Add Schedule');
                    this.isSubmitting = false;
                    return;
                }
            }

            // Prepare payload
            const payload = {
                room_id: roomId,
                faculty_id: facultyIdInt,
                program_id: Number.isInteger(programId) && programId > 0 ? programId : null,
                year_level: Number.isInteger(yearLevelInt) && yearLevelInt > 0 ? yearLevelInt : null,
                subject_id: subjectId,
                day_of_week: day,
                time_start: timeStart,
                time_end: timeEnd,
                created_by: parseInt(createdBy)
            };

            // Make API call
            const response = await fetch('/api/labSchedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...SmartLab.Core.Auth.getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('ModalManager: Add schedule API error:', error);
                throw new Error(error.message || 'Failed to create schedule');
            }

            const result = await response.json();
            
            // Success notification
            const successMessage = result.message || 'Schedule created successfully!';
            this.showToast(successMessage, 'success');
            
            // Brief success feedback on button
            if (submitBtn) {
                submitBtn.textContent = '✅ Added!';
                submitBtn.style.backgroundColor = '#10b981';
            }

            // Hide modal and refresh
            setTimeout(() => {
                this.hide();
                if (data.onSuccess) {
                    data.onSuccess();
                }
            }, 1000);

        } catch (error) {
            console.error('ModalManager: Error creating schedule:', error);
            this.showToast(error.message || 'Failed to create schedule', 'error');
            this.resetSubmitButton(submitBtn, 'Add Schedule');
        } finally {
            // Reset submission flag
            this.isSubmitting = false;
        }
    }

    /**
     * Handle edit schedule form submission
     */
    async handleEditScheduleSubmit(e, data) {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (this.isSubmitting) {
            return;
        }
        
        this.isSubmitting = true;
        
        const form = e.target;
        const formData = new FormData(form);
        const scheduleId = data.scheduleId;

        try {
            // Collect form data
            const roomIdValue = formData.get('room_id');
            const day = formData.get('day');
            const timeStart = formData.get('time-start') + ':00';  // Add seconds for backend
            const timeEnd = formData.get('time-end') + ':00';      // Add seconds for backend
            const facultyId = formData.get('faculty');
            const subjectIdValue = formData.get('subject_id');
            const programIdValue = formData.get('program_id');
            const yearLevel = formData.get('year-level');


            // Validate required fields
            if (!roomIdValue || !day || !timeStart || !timeEnd || !facultyId || !subjectIdValue) {
                this.showToast('Please fill in all required fields', 'warning');
                this.isSubmitting = false;
                return;
            }

            const roomId = parseInt(roomIdValue, 10);
            const facultyIdInt = parseInt(facultyId, 10);
            const subjectId = parseInt(subjectIdValue, 10);
            const programId = programIdValue ? parseInt(programIdValue, 10) : null;
            const yearLevelInt = yearLevel ? parseInt(yearLevel, 10) : null;

            if (!Number.isInteger(roomId) || roomId <= 0 || !Number.isInteger(facultyIdInt) || !Number.isInteger(subjectId)) {
                this.showToast('Invalid field selection detected. Please review your entries.', 'warning');
                this.isSubmitting = false;
                return;
            }

            // Validate time
            if (timeEnd <= timeStart) {
                this.showToast('End time must be after start time', 'warning');
                this.isSubmitting = false;
                return;
            }

            // Get academic context (required for update)
            let academicContext;
            try {
                const contextResponse = await fetch('/api/activeAcademicContext', { headers: SmartLab.Core.Auth.getAuthHeaders() });
                if (contextResponse.ok) {
                    academicContext = await contextResponse.json();
                }
            } catch (error) {
            }

            // Prepare payload with academic context
            const payload = {
                room_id: roomId,
                faculty_id: facultyIdInt,
                program_id: Number.isInteger(programId) && programId > 0 ? programId : null,
                year_level: Number.isInteger(yearLevelInt) && yearLevelInt > 0 ? yearLevelInt : null,
                subject_id: subjectId,
                day_of_week: day,
                time_start: timeStart,
                time_end: timeEnd,
                academic_year_id: academicContext?.academic_year_id || 1,  // Default to 1 if not available
                term_id: academicContext?.term_id || 1  // Default to 1 if not available
            };

            // Check for conflicts using ScheduleManager (excluding current schedule)
            const scheduleManager = window.scheduleManager;
            if (scheduleManager) {
                const roomMeta = this.getSelectedOptionMeta('schedule-lab');
                const programMeta = this.getSelectedOptionMeta('schedule-program');
                const subjectMeta = this.getSelectedOptionMeta('schedule-subject');
                const conflict = scheduleManager.checkEditScheduleConflict({
                    lab_room: roomMeta.label || 'Selected Laboratory',
                    faculty_id: payload.faculty_id,
                    program: programMeta.label || null,
                    year_level: payload.year_level,
                    subject: subjectMeta.label || 'Subject',
                    day_of_week: payload.day_of_week,
                    time_start: payload.time_start,
                    time_end: payload.time_end
                }, scheduleId);
                if (conflict) {
                    this.showToast('Schedule conflicts with existing schedule! Please choose a different time or lab.', 'warning');
                    this.isSubmitting = false;
                    return;
                }
            }

            // Make API call
            const response = await fetch(`/api/labSchedule/${scheduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...SmartLab.Core.Auth.getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update schedule');
            }

            const result = await response.json();
            
            // Success notification
            const successMessage = result.message || 'Schedule updated successfully!';
            this.showToast(successMessage, 'success');
            
            // Brief success feedback on button
            const editSubmitBtn = document.querySelector('button[type="submit"]');
            if (editSubmitBtn) {
                editSubmitBtn.textContent = '✅ Updated!';
                editSubmitBtn.style.backgroundColor = '#10b981';
            }

            // Hide modal and refresh
            setTimeout(() => {
                this.hide();
                if (data.onSuccess) {
                    data.onSuccess();
                }
            }, 1000);

        } catch (error) {
            console.error('ModalManager: Error updating schedule:', error);
            this.showToast(error.message || 'Failed to update schedule', 'error');
        } finally {
            // Reset submission flag
            this.isSubmitting = false;
        }
    }

    // =========================================
    // 6. ACADEMIC DIRECTORY MODALS (Buildings)
    // =========================================

    getAddBuildingModalContent() {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add Building</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="building-name">Building Name</label>
                    <input type="text" id="building-name" name="building-name" class="form-input" placeholder="e.g., Engineering and Architecture Building" autocomplete="off" required>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Building</button>
                </div>
            </form>
        `;
    }

    getEditBuildingModalContent(data) {
        const building = data?.building || {};
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Building</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="building-id" value="${building.building_id || ''}">
                <div class="form-group">
                    <label for="building-name">Building Name</label>
                    <input type="text" id="building-name" name="building-name" class="form-input" value="${this.escapeAttr(building.building_name || '')}" autocomplete="off" required>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
    }

    initializeAddBuildingModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._addBuildingHandler) {
            form.removeEventListener('submit', this._addBuildingHandler);
        }
        this._addBuildingHandler = (e) => this.handleBuildingSubmit(e, data, 'add');
        form.addEventListener('submit', this._addBuildingHandler);
    }

    initializeEditBuildingModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._editBuildingHandler) {
            form.removeEventListener('submit', this._editBuildingHandler);
        }
        this._editBuildingHandler = (e) => this.handleBuildingSubmit(e, data, 'edit');
        form.addEventListener('submit', this._editBuildingHandler);
    }

    async handleBuildingSubmit(e, data, mode = 'add') {
        e.preventDefault();
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || (mode === 'add' ? 'Add Building' : 'Save Changes');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'add' ? 'Saving...' : 'Updating...';
        }

        try {
            const nameInput = document.getElementById('building-name');
            const name = nameInput?.value.trim();
            if (!name) {
                this.showToast('Building name is required.', 'warning');
                this.resetSubmitButton(submitBtn, originalText);
                this.isSubmitting = false;
                return;
            }

            const headers = { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
            let response;
            if (mode === 'add') {
                response = await fetch('/api/academic-directory/buildings', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ building_name: name })
                });
            } else {
                const buildingId = document.getElementById('building-id')?.value || data?.building?.building_id;
                if (!buildingId) {
                    throw new Error('Missing building identifier.');
                }
                response = await fetch(`/api/academic-directory/buildings/${buildingId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ building_name: name })
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Request failed.');
            }

            this.showToast(`Building ${mode === 'add' ? 'added' : 'updated'} successfully.`, 'success');
            this.hide();
            data?.onSuccess?.();
        } catch (error) {
            console.error('ModalManager: Building submit error:', error);
            this.showToast(error.message || 'Failed to save building.', 'error');
            this.resetSubmitButton(submitBtn, originalText);
        } finally {
            this.isSubmitting = false;
        }
    }

    getAddRoomModalContent(data) {
        const options = this.getBuildingOptionsMarkup(data?.buildings || [], null);
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add Room</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="room-building">Building (optional)</label>
                    <select id="room-building" class="form-select">
                        <option value="">Unassigned</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group">
                    <label for="room-number">Room Number</label>
                    <input type="text" id="room-number" class="form-input" placeholder="e.g., LAB-101" autocomplete="off" required>
                </div>
                <div class="form-group">
                    <label for="room-name">Room Name</label>
                    <input type="text" id="room-name" class="form-input" placeholder="e.g., Computer Laboratory 1" autocomplete="off" required>
                </div>
                <div class="form-group form-checkbox" style="margin-top:1rem;">
                    <label class="checkbox">
                        <input type="checkbox" id="room-is-lab">
                        <span>Computer laboratory</span>
                    </label>
                    <small class="form-help">Checked rooms will appear in the "Use Laboratory Room" dropdown.</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Room</button>
                </div>
            </form>
        `;
    }

    getEditRoomModalContent(data) {
        const room = data?.room || {};
        const options = this.getBuildingOptionsMarkup(data?.buildings || [], room.building_id);
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Room</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>

            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="room-id" value="${room.room_id || ''}">
                <div class="form-group">
                    <label for="room-building">Building (optional)</label>
                    <select id="room-building" class="form-select">
                        <option value="">Unassigned</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group">
                    <label for="room-number">Room Number</label>
                    <input type="text" id="room-number" class="form-input" value="${this.escapeAttr(room.room_number || '')}" required>
                </div>
                <div class="form-group">
                    <label for="room-name">Room Name</label>
                    <input type="text" id="room-name" class="form-input" value="${this.escapeAttr(room.room_name || '')}" required>
                </div>
                <div class="form-group form-checkbox" style="margin-top:1rem;">
                    <label class="checkbox">
                        <input type="checkbox" id="room-is-lab" ${Number(room.is_computer_lab) === 1 ? 'checked' : ''}>
                        <span>Computer laboratory</span>
                    </label>
                    <small class="form-help">Checked rooms will appear in the "Use Laboratory Room" dropdown.</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
    }

    getBuildingOptionsMarkup(buildings = [], selectedId = null) {
        if (!Array.isArray(buildings)) return '';
        return buildings.map(b => {
            const isSelected = Number(b.building_id) === Number(selectedId);
            return `<option value="${b.building_id}" ${isSelected ? 'selected' : ''}>${this.escapeAttr(b.building_name)}</option>`;
        }).join('');
    }

    initializeAddRoomModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._addRoomHandler) {
            form.removeEventListener('submit', this._addRoomHandler);
        }
        this._addRoomHandler = (e) => this.handleRoomSubmit(e, data, 'add');
        form.addEventListener('submit', this._addRoomHandler);
    }

    initializeEditRoomModal(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        if (this._editRoomHandler) {
            form.removeEventListener('submit', this._editRoomHandler);
        }
        this._editRoomHandler = (e) => this.handleRoomSubmit(e, data, 'edit');
        form.addEventListener('submit', this._editRoomHandler);
    }

    async handleRoomSubmit(e, data, mode = 'add') {
        e.preventDefault();
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || (mode === 'add' ? 'Add Room' : 'Save Changes');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'add' ? 'Saving...' : 'Updating...';
        }

        try {
            const buildingValue = document.getElementById('room-building')?.value ?? '';
            const roomNumber = document.getElementById('room-number')?.value.trim();
            const roomName = document.getElementById('room-name')?.value.trim();

            if (!roomNumber || !roomName) {
                this.showToast('Room number and name are required.', 'warning');
                this.resetSubmitButton(submitBtn, originalText);
                this.isSubmitting = false;
                return;
            }

            const payload = {
                room_number: roomNumber,
                room_name: roomName,
                building_id: buildingValue === '' ? null : Number(buildingValue),
                is_computer_lab: document.getElementById('room-is-lab')?.checked ? 1 : 0
            };

            const headers = { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
            let response;
            if (mode === 'add') {
                response = await fetch('/api/academic-directory/rooms', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                const roomId = document.getElementById('room-id')?.value || data?.room?.room_id;
                if (!roomId) {
                    throw new Error('Missing room identifier.');
                }
                response = await fetch(`/api/academic-directory/rooms/${roomId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Request failed.');
            }

            this.showToast(`Room ${mode === 'add' ? 'added' : 'updated'} successfully.`, 'success');
            this.hide();
            data?.onSuccess?.();
        } catch (error) {
            console.error('ModalManager: Room submit error:', error);
            this.showToast(error.message || 'Failed to save room.', 'error');
            this.resetSubmitButton(submitBtn, originalText);
        } finally {
            this.isSubmitting = false;
        }
    }

    // =========================================
    // 7. EQUIPMENT MANAGEMENT MODALS (Add/Edit)
    // =========================================

    /**
     * Add Equipment modal content
     */
    getAddEquipmentModalContent(data) {
        return `
            <div class="modal-header">
                <h4 id="modal-title">Add New Equipment</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <div class="form-group">
                    <label for="equipment-name">Equipment Name</label>
                    <input type="text" id="equipment-name" name="equipment-name" class="form-input" placeholder="e.g., LCD/LED TV, VGA/HDMI port" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="equipment-total-qty">Total Quantity</label>
                    <input type="number" id="equipment-total-qty" name="equipment-total-qty" class="form-input" min="0" value="0" required>
                    <small class="form-help">Available quantity will be set equal to total quantity for new equipment.</small>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Equipment</button>
                </div>
            </form>
        `;
    }

    /**
     * Edit Equipment modal content
     */
    getEditEquipmentModalContent(data) {
        const eq = data.equipment || {};
        return `
            <div class="modal-header">
                <h4 id="modal-title">Edit Equipment</h4>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <form id="modal-form" class="modal-body" autocomplete="off">
                <input type="hidden" id="equipment-id" value="${eq.equipment_id || ''}">
                
                <div class="form-group">
                    <label for="equipment-name">Equipment Name</label>
                    <input type="text" id="equipment-name" name="equipment-name" class="form-input" value="${this.escapeAttr(eq.equipment_name || '')}" autocomplete="off" required>
                </div>
                
                <div class="form-group">
                    <label for="equipment-total-qty">Total Quantity</label>
                    <input type="number" id="equipment-total-qty" name="equipment-total-qty" class="form-input" min="0" value="${eq.total_qty || 0}" required>
                    <small id="equipment-qty-validation" class="form-help" style="display:none;"></small>
                </div>
                
                <div class="form-group" style="display: flex; gap: 1rem;">
                    <div style="flex:1;">
                        <label>Borrowed</label>
                        <input type="text" class="form-input" value="${eq.borrowed_qty || 0}" disabled>
                    </div>
                    <div style="flex:1;">
                        <label for="equipment-damaged-qty">Damaged</label>
                        <input type="number" class="form-input" id="equipment-damaged-qty" min="0" value="${eq.damaged_qty || 0}" aria-describedby="equipment-damaged-validation">
                        <small id="equipment-damaged-validation" class="form-help" style="display:none;"></small>
                    </div>
                    <div style="flex:1;">
                        <label>Available</label>
                        <input type="text" class="form-input" id="equipment-available-display" value="${eq.available_qty || 0}" disabled>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Equipment</button>
                </div>
            </form>
        `;
    }

    /**
     * Escape HTML attribute value
     */
    escapeAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Initialize add equipment modal
     */
    initializeAddEquipmentModal(data) {
        const form = document.getElementById('modal-form');
        if (form) {
            const newHandler = (e) => this.handleAddEquipmentSubmit(e, data);
            form.removeEventListener('submit', this._addEquipmentHandler);
            this._addEquipmentHandler = newHandler;
            form.addEventListener('submit', newHandler);
        }
    }

    /**
     * Initialize edit equipment modal with validation
     */
    initializeEditEquipmentModal(data) {
        const eq = data.equipment || {};
        
        const form = document.getElementById('modal-form');
        if (form) {
            const newHandler = (e) => this.handleEditEquipmentSubmit(e, data);
            form.removeEventListener('submit', this._editEquipmentHandler);
            this._editEquipmentHandler = newHandler;
            form.addEventListener('submit', newHandler);
        }

        // Setup real-time total qty validation
        const totalQtyInput = document.getElementById('equipment-total-qty');
        const validationMsg = document.getElementById('equipment-qty-validation');
        const damagedInput = document.getElementById('equipment-damaged-qty');
        const damagedValidation = document.getElementById('equipment-damaged-validation');
        const availableDisplay = document.getElementById('equipment-available-display');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

        const borrowedQty = eq.borrowed_qty || 0;

        const refreshState = () => {
            if (!totalQtyInput) return;
            const totalValue = parseInt(totalQtyInput.value, 10);
            const currentTotal = Number.isFinite(totalValue) ? totalValue : 0;
            const maxDamage = Math.max(0, currentTotal - borrowedQty);

            if (damagedInput) {
                damagedInput.max = maxDamage;
            }

            const damagedValue = damagedInput ? parseInt(damagedInput.value, 10) : NaN;
            const currentDamaged = Number.isFinite(damagedValue) ? Math.max(0, damagedValue) : 0;
            const clampedDamaged = Math.min(currentDamaged, maxDamage);

            if (damagedInput && clampedDamaged !== currentDamaged) {
                damagedInput.value = clampedDamaged;
            }

            const available = Math.max(0, currentTotal - borrowedQty - clampedDamaged);
            if (availableDisplay) {
                availableDisplay.value = available;
            }

            let totalInvalid = false;
            let damagedInvalid = false;

            const minimumTotal = borrowedQty + clampedDamaged;
            if (currentTotal < minimumTotal) {
                totalInvalid = true;
                if (validationMsg) {
                    let msg = `Minimum total is ${minimumTotal} because `;
                    const reasons = [];
                    if (borrowedQty > 0) reasons.push(`${borrowedQty} borrowed`);
                    if (clampedDamaged > 0) reasons.push(`${clampedDamaged} damaged`);
                    msg += reasons.join(' and ') + '.';
                    validationMsg.textContent = msg;
                    validationMsg.style.display = 'block';
                    validationMsg.style.color = '#ef4444';
                }
                totalQtyInput.style.borderColor = '#ef4444';
            } else if (validationMsg) {
                validationMsg.style.display = 'none';
                totalQtyInput.style.borderColor = '';
            }

            if (damagedInput) {
                if (clampedDamaged > maxDamage) {
                    damagedInvalid = true;
                    if (damagedValidation) {
                        damagedValidation.textContent = `Only ${maxDamage} items can be marked damaged with ${currentTotal - borrowedQty} non-borrowed units.`;
                        damagedValidation.style.display = 'block';
                        damagedValidation.style.color = '#ef4444';
                    }
                    damagedInput.style.borderColor = '#ef4444';
                } else {
                    if (damagedValidation) damagedValidation.style.display = 'none';
                    damagedInput.style.borderColor = '';
                }
            }

            const hasError = totalInvalid || damagedInvalid;
            if (submitBtn) {
                submitBtn.disabled = hasError;
                submitBtn.style.opacity = hasError ? '0.6' : '1';
            }
        };

        if (totalQtyInput) {
            totalQtyInput.addEventListener('input', refreshState);
        }
        if (damagedInput) {
            damagedInput.addEventListener('input', refreshState);
        }
        refreshState();
    }

    /**
     * Handle add equipment form submission
     */
    async handleAddEquipmentSubmit(e, data) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding...'; }

        try {
            const equipmentName = document.getElementById('equipment-name').value.trim();
            const totalQty = parseInt(document.getElementById('equipment-total-qty').value) || 0;

            if (!equipmentName) {
                this.showToast('Equipment name is required', 'warning');
                this.resetSubmitButton(submitBtn, 'Add Equipment');
                this.isSubmitting = false;
                return;
            }

            if (totalQty < 0) {
                this.showToast('Total quantity cannot be negative', 'warning');
                this.resetSubmitButton(submitBtn, 'Add Equipment');
                this.isSubmitting = false;
                return;
            }

            const payload = {
                equipment_name: equipmentName,
                total_qty: totalQty
            };

            const response = await fetch('/api/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add equipment');
            }

            const result = await response.json();
            this.showToast(result.message || `"${equipmentName}" added successfully`, 'success');

            if (submitBtn) {
                submitBtn.textContent = 'Added!';
                submitBtn.style.backgroundColor = '#10b981';
            }

            this.hide();
            if (data.onSuccess) data.onSuccess();

        } catch (error) {
            console.error('ModalManager: Error adding equipment:', error);
            this.showToast(error.message || 'Failed to add equipment', 'error');
            this.resetSubmitButton(submitBtn, 'Add Equipment');
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * Handle edit equipment form submission
     */
    async handleEditEquipmentSubmit(e, data) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating...'; }

        try {
            const equipmentId = document.getElementById('equipment-id').value;
            const equipmentName = document.getElementById('equipment-name').value.trim();
            const totalQty = parseInt(document.getElementById('equipment-total-qty').value) || 0;
            const damagedInput = document.getElementById('equipment-damaged-qty');
            const damagedQty = damagedInput ? Math.max(0, parseInt(damagedInput.value, 10) || 0) : 0;

            if (!equipmentName) {
                this.showToast('Equipment name is required', 'warning');
                this.resetSubmitButton(submitBtn, 'Update Equipment');
                this.isSubmitting = false;
                return;
            }

            const eq = data.equipment || {};
            const borrowedQty = eq.borrowed_qty || 0;
            const minimumTotal = borrowedQty + damagedQty;
            if (totalQty < minimumTotal) {
                this.showToast(`Total quantity cannot be less than ${minimumTotal}`, 'warning');
                this.resetSubmitButton(submitBtn, 'Update Equipment');
                this.isSubmitting = false;
                return;
            }

            const maxDamage = Math.max(0, totalQty - borrowedQty);
            if (damagedQty > maxDamage) {
                this.showToast(`Damaged quantity cannot exceed ${maxDamage}.`, 'warning');
                this.resetSubmitButton(submitBtn, 'Update Equipment');
                this.isSubmitting = false;
                return;
            }

            const payload = {
                equipment_name: equipmentName,
                total_qty: totalQty,
                damaged_qty: damagedQty
            };

            const response = await fetch(`/api/equipment/${equipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update equipment');
            }

            const result = await response.json();
            this.showToast(result.message || `"${equipmentName}" updated successfully`, 'success');

            if (submitBtn) {
                submitBtn.textContent = 'Updated!';
                submitBtn.style.backgroundColor = '#10b981';
            }

            this.hide();
            if (data.onSuccess) data.onSuccess();

        } catch (error) {
            console.error('ModalManager: Error updating equipment:', error);
            this.showToast(error.message || 'Failed to update equipment', 'error');
            this.resetSubmitButton(submitBtn, 'Update Equipment');
        } finally {
            this.isSubmitting = false;
        }
    }

    // =========================================
    // 7. GENERIC MODALS (Confirm/Alert/Form)
    // =========================================
    // Note: Generic modals are handled in the initialization section above
    // No additional handler methods needed as they use callback functions

    // =========================================
    // 8. UTILITY FUNCTIONS
    // =========================================

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        if (window.SmartLab?.Core?.UI?.showToast) {
            window.SmartLab.Core.UI.showToast(message, type);
        }
    }

    // =========================================
    // 7. STATIC METHODS & INITIALIZATION
    // =========================================

    /**
     * Static method to show modal (convenience)
     */
    static async show(type, data) {
        if (!window.modalManager) {
            window.modalManager = new ModalManager();
        }
        
        // Try to initialize if not already done
        if (!window.modalManager.modalContainer || !window.modalManager.modalContent) {
            const initialized = window.modalManager.init();
            if (!initialized) {
                // Wait a bit and retry once (SPA timing issue)
                await new Promise(resolve => setTimeout(resolve, 100));
                const retryInitialized = window.modalManager.init();
                if (!retryInitialized) {
                    throw new Error('Modal elements not found in DOM after retry');
                }
            }
        }
        
        return window.modalManager.show(type, data);
    }

    /**
     * Static method to hide modal (convenience)
     */
    static hide() {
        if (window.modalManager) {
            window.modalManager.hide();
        }
    }
}

// =========================================
// 8. GLOBAL INITIALIZATION
// =========================================

// Initialize modal manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modalManager = new ModalManager();
    window.modalManager.init();
});

// Also initialize immediately if DOM is already loaded (SPA context)
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded, initialize now
    if (!window.modalManager) {
        window.modalManager = new ModalManager();
        window.modalManager.init();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalManager };
}
