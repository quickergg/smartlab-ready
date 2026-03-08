/* =========================================
   SmartLab – Student SPA Application
   Follows faculty-app.js / admin-app.js architecture
========================================= */

class StudentApp {
    constructor() {
        this.currentPage = 'request';
        this.routes = {};
        this.isLoading = false;
        this.timeValidationDefaults = {
            start: 'Select a start time between 7:30 AM and 9:00 PM.',
            end: 'Select an end time at least 30 minutes after the start.'
        };
        this.requestLeadDays = 2;
        this.scheduleViewer = null;
        this.borrowRequestController = null;
        this.requestConflictHelper = null;
        this.profilePageContext = null;
        this.myRequestsTable = null;

        this.init();
    }

    validateTimeSlots(start, end, options = {}) {
        const { emitToast = true, allowIncomplete = false } = options;
        const startCard = document.querySelector('[data-time-card="start"]');
        const endCard = document.querySelector('[data-time-card="end"]');
        const defaults = this.timeValidationDefaults || {};
        const slots = (window.FormValidator?.getHalfHourSlots?.())
            ? FormValidator.getHalfHourSlots()
            : ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];

        const setState = (card, state, text) => {
            if (!card) return;
            card.classList.remove('conflict-loading', 'conflict-clear', 'conflict-error');
            card.classList.add(`conflict-${state}`);
            const message = card.querySelector('.time-validation-message');
            if (message && text) message.textContent = text;
        };

        const notify = (msg) => {
            if (emitToast) this.showToast(msg, 'warning');
        };

        const formatDuration = (minutes) => {
            if (!minutes) return '0 min';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const parts = [];
            if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
            if (mins) parts.push(`${mins} min`);
            return parts.join(' ');
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

            const durationLabel = formatDuration((endIdx - startIdx) * 30);
            setState(startCard, 'clear', `Starts at ${SmartLab.Core.Utils.formatTime(start)}.`);
            setState(endCard, 'clear', `Ends at ${SmartLab.Core.Utils.formatTime(end)} • ${durationLabel}`);
            return true;
        }

        return isValid;
    }

    populateTimeSelects() {
        const selects = document.querySelectorAll('[data-time-select]');
        if (!selects.length) return;

        const slots = (window.FormValidator?.getHalfHourSlots?.())
            ? FormValidator.getHalfHourSlots()
            : ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];

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
        const timeStart = document.getElementById('timeStart');
        const timeEnd = document.getElementById('timeEnd');
        const form = document.getElementById('studentRequestForm');

        if (!timeStart || !timeEnd) return;

        const refresh = () => {
            const startVal = timeStart.value || '';
            const endVal = timeEnd.value || '';
            this.validateTimeSlots(startVal, endVal, { emitToast: false, allowIncomplete: true });
            this.runConflictCheck();
        };

        ['input', 'change'].forEach(evt => {
            timeStart.addEventListener(evt, refresh);
            timeEnd.addEventListener(evt, refresh);
        });

        if (form) {
            form.addEventListener('reset', () => setTimeout(refresh, 0));
        }

        refresh();
    }

    setupDateConstraints() {
        const dateInput = document.getElementById('dateNeeded');
        if (!dateInput) return;

        const updateMin = () => {
            const leadDays = Number(this.requestLeadDays) || 0;
            const minDate = new Date();
            minDate.setHours(0, 0, 0, 0);
            minDate.setDate(minDate.getDate() + leadDays);
            const formatted = SmartLab.Core.Utils.formatDateInput?.(minDate)
                || `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`;
            dateInput.min = formatted;

            if (!dateInput.value) {
                dateInput.value = formatted;
                dateInput.dispatchEvent(new Event('change'));
                return;
            }

            if (dateInput.value && dateInput.value < formatted) {
                dateInput.value = formatted;
                dateInput.dispatchEvent(new Event('change'));
            }
        };

        updateMin();
        dateInput.addEventListener('focus', updateMin);
    }

    // =========================================
    // Initialization
    // =========================================

    async init() {
        try {
            // Guard role + token validity
            if (!SmartLab.Core.Auth.guardRole('Student')) return;

            // Show container, hide loading
            const container = document.getElementById('student-container');
            const loading = document.getElementById('loading-screen');
            if (loading) loading.style.display = 'none';
            if (container) container.style.display = 'flex';

            // Build shell UI
            this.createShellUI();
            this.setupRouting();
            this.setupNavigation();
            this.setupProfileDropdown();
            this.loadUserProfile();
            this.loadAcademicContext();

            // Initialize notification manager (bell icon + dropdown)
            if (typeof NotificationManager !== 'undefined') {
                this.notificationManager = new NotificationManager();
            }

            // Load initial page
            await this.loadPage('request');

        } catch (error) {
            console.error('StudentApp: Init failed:', error);
        }
    }

    // =========================================
    // Shell UI Creation (header, sidebar, dropdown)
    // =========================================

    createShellUI() {
        // Sidebar
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer) {
            sidebarContainer.innerHTML = `
                <div class="sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <div class="logo">
                            <img src="/images/PUPLogo.png" alt="SmartLab Logo">
                            <div class="sidebar-text">
                                <h2>smartlab.</h2>
                                <p>Student Portal</p>
                            </div>
                        </div>
                    </div>
                    <div class="academic-context-sidebar" id="ac-option-a">
                        <div class="ac-label" id="ac-a-text">Loading...</div>
                    </div>
                    <nav class="navList">
                        <button class="nav-item active" data-page="request">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>New Request</span>
                        </button>
                        <button class="nav-item" data-page="view-requests">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            <span>View Requests</span>
                        </button>
                        <button class="nav-item" data-page="schedule">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>View Schedules</span>
                        </button>
                    </nav>
                    <div class="sidebar-profile">
                        <button class="profile-trigger" id="profile-trigger">
                            <div class="profile-avatar">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                                </svg>
                            </div>
                            <span class="profile-email" id="profile-email">Loading...</span>
                            <svg class="profile-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- Profile Dropdown -->
                <div class="profile-dropdown hidden" id="profile-dropdown">
                    <div class="dropdown-profile">
                        <div class="profile-avatar">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <span class="profile-email" id="dropdown-profile-email">Loading...</span>
                    </div>
                    <div class="profile-dropdown-header">
                        <div class="profile-badge">Student</div>
                    </div>
                    <div class="profile-dropdown-menu">
                        <button class="profile-menu-item" id="profile-settings-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                            </svg>
                            Profile Settings
                        </button>
                        <button class="profile-menu-item" id="change-password-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12.65 10C11.83 7.67 9.61 6 7 6C3.69 6 1 8.69 1 12C1 15.31 3.69 18 7 18C9.61 18 11.83 16.33 12.65 14H17V18H21V14H23V10H12.65ZM7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14Z" fill="currentColor"/>
                            </svg>
                            Change Password
                        </button>
                        <button class="profile-menu-item profile-signout" id="profile-signout-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            `;
        }

        // Header
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            headerContainer.innerHTML = `
                <header class="admin-header">
                    <div class="header-left">
                        <button class="sidebar-toggle" id="sidebar-toggle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <div>|</div>
                        <div class="breadcrumb">
                            <span class="breadcrumb-item">smartlab</span>
                            <span class="breadcrumb-separator">></span>
                            <span class="breadcrumb-item current-page" id="current-page">New Request</span>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="header-actions">
                            <button class="btn-icon" id="btn-notifications">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            `;
        }

        // Sidebar toggle
        const toggle = document.getElementById('sidebar-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                const header = document.querySelector('.admin-header');
                const container = document.querySelector('.admin-container');
                if (sidebar) sidebar.classList.toggle('collapsed');
                if (header) header.classList.toggle('sidebar-collapsed');
                if (container) container.classList.toggle('sidebar-collapsed');
            });
        }

        // Sign out
        const signOutBtn = document.getElementById('profile-signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                sessionStorage.clear();
                window.location.href = '/index.html';
            });
        }
    }

    // =========================================
    // User Profile & Academic Context
    // =========================================

    loadUserProfile() {
        const email = sessionStorage.getItem('gmail') || 'Student';
        const fullName = sessionStorage.getItem('full_name') || email.split('@')[0];

        const els = {
            'profile-email': email,
            'dropdown-profile-email': email
        };

        Object.entries(els).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    async loadAcademicContext() {
        let text = 'AY 2025-2026 | 1st Semester';
        try {
            const res = await fetch('/api/activeAcademicContext', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                text = `AY ${data.academic_year || '2025-2026'} | ${data.term || '1st Semester'}`;
            }
        } catch (err) {
            console.warn('StudentApp: Academic context load failed:', err);
        }

        const el = document.getElementById('ac-a-text');
        if (el) el.textContent = text;
    }

    // =========================================
    // Profile Dropdown
    // =========================================

    setupProfileDropdown() {
        const trigger = document.getElementById('profile-trigger');
        const dropdown = document.getElementById('profile-dropdown');
        if (!trigger || !dropdown) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Profile Settings & Change Password buttons
        const profileSettingsBtn = document.getElementById('profile-settings-btn');
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (profileSettingsBtn) {
            profileSettingsBtn.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                this.profilePageContext = 'info';
                this.loadPage('profile');
            });
        }
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                this.profilePageContext = 'password';
                this.loadPage('profile');
            });
        }
    }

    // =========================================
    // Routing & Navigation
    // =========================================

    setupRouting() {
        this.routes = {
            request: {
                url: 'pages/request.html',
                title: 'New Request'
            },
            'view-requests': {
                url: 'pages/view-requests.html',
                title: 'View Requests'
            },
            schedule: {
                url: 'pages/schedule.html',
                title: 'View Schedules'
            },
            profile: {
                url: 'pages/profile.html',
                title: 'Profile Settings',
                scripts: ['/shared/js/pages/ProfileSettings.js']
            }
        };
    }

    setupNavigation() {
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem && navItem.dataset.page) {
                e.preventDefault();
                this.loadPage(navItem.dataset.page);
            }
        });
    }

    // =========================================
    // Page Loading
    // =========================================

    async loadPage(page) {
        const route = this.routes[page];
        if (!route) {
            console.error('StudentApp: Unknown page:', page);
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (activeNav) activeNav.classList.add('active');

            // Fetch page HTML
            const fetchUrl = route.absolute ? route.url : '/apps/student/' + route.url;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`Failed to load ${page}`);
            const html = await response.text();

            // Insert into content area
            const content = document.getElementById('page-content');
            if (content) content.innerHTML = html;

            this.currentPage = page;

            // Update breadcrumb in header
            const breadcrumb = document.getElementById('current-page');
            if (breadcrumb) breadcrumb.textContent = route.title;

            // Initialize page-specific logic
            await this.initializePage(page);

        } catch (error) {
            console.error('StudentApp: Page load failed:', error);
            const content = document.getElementById('page-content');
            if (content) {
                content.innerHTML = `<div style="padding:2rem;text-align:center;color:#6b7280;">
                    <p>Failed to load page. Please try again.</p>
                    <button class="btn btn-primary" onclick="window.studentApp.loadPage('${page}')">Retry</button>
                </div>`;
            }
        } finally {
            this.isLoading = false;
        }
    }

    async initializePage(page) {
        switch (page) {
            case 'request':
                await this.initRequestPage();
                break;
            case 'view-requests':
                await this.initViewRequestsPage();
                break;
            case 'schedule':
                await this.initSchedulePage();
                break;
            case 'profile':
                await this.initProfilePage();
                break;
        }
    }

    // =========================================
    // PROFILE PAGE
    // =========================================

    async initProfilePage() {
        const route = this.routes.profile;
        if (route.scripts) {
            for (const src of route.scripts) {
                await this.loadScript(src);
            }
        }
        if (typeof ProfileSettings !== 'undefined') {
            new ProfileSettings();
        }

        const backBtn = document.getElementById('profile-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.loadPage('request'));
        }

        if (this.profilePageContext === 'password') {
            document.getElementById('profile-password-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('profile-new-password')?.focus();
        } else {
            document.getElementById('profile-fullname')?.focus();
        }

        this.profilePageContext = null;
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // =========================================
    // REQUEST PAGE
    // =========================================

    async initRequestPage() {
        if (window.SmartLab?.Core?.Templates?.renderBorrowRequestForm) {
            SmartLab.Core.Templates.renderBorrowRequestForm('borrow-request-form', { role: 'student' });
        } else {
            console.warn('StudentApp: BorrowRequestForm template not found.');
        }
        if (!window.SmartLab?.Core?.Pages?.BorrowRequestController) {
            console.error('StudentApp: BorrowRequestController not found.');
            return;
        }

        this.borrowRequestController = new SmartLab.Core.Pages.BorrowRequestController({
            role: 'student',
            formId: 'studentRequestForm',
            requestLeadDays: this.requestLeadDays,
            hooks: {
                onDirectoryReady: async () => {
                    await this.autoFillStudentProfile();
                },
                onAfterInit: async () => {
                    this.setupConflictDetection();
                    this.setupRequestFormSubmit();
                },
                onDateChange: () => this.triggerRequestConflictCheck(),
                onTimeChange: () => this.triggerRequestConflictCheck(),
                onEquipmentChange: () => this.triggerRequestConflictCheck(),
                onEquipmentLoad: () => this.triggerRequestConflictCheck(),
                onReset: async () => {
                    await this.autoFillStudentProfile();
                    this.requestConflictHelper?.reset();
                }
            }
        });

        await this.borrowRequestController.init();
    }

    buildRoomDisplay(room) {
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

    async loadDirectoryOptions() {
        await Promise.all([
            this.loadSubjectOptions(),
            this.loadProgramOptions(),
            this.loadRoomOptions()
        ]);
    }

    async loadSubjectOptions() {
        const subjectSelect = document.getElementById('subject-select');
        if (!subjectSelect) return;

        const previousValue = subjectSelect.value;
        const wasDisabled = subjectSelect.disabled;
        subjectSelect.disabled = true;
        subjectSelect.innerHTML = '<option value="">Loading subjects...</option>';

        try {
            const res = await fetch('/api/academic-directory/subjects', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load subjects');
            const subjects = await res.json();

            if (!Array.isArray(subjects) || subjects.length === 0) {
                subjectSelect.innerHTML = '<option value="">No subjects available</option>';
                return;
            }

            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            subjects.forEach((subject) => {
                const option = document.createElement('option');
                option.value = subject.subject_id ? String(subject.subject_id) : '';
                option.textContent = subject.subject_code
                    ? `${subject.subject_code} — ${subject.subject_name}`
                    : (subject.subject_name || 'Unnamed Subject');
                option.dataset.subjectName = subject.subject_name || '';
                option.dataset.subjectCode = subject.subject_code || '';
                option.dataset.subjectLabel = option.textContent;
                subjectSelect.appendChild(option);
            });

            if (previousValue) {
                subjectSelect.value = previousValue;
            }
        } catch (err) {
            console.error('StudentApp: Failed to load subjects', err);
            subjectSelect.innerHTML = '<option value="">Unable to load subjects</option>';
        } finally {
            subjectSelect.disabled = wasDisabled;
        }
    }

    async loadProgramOptions() {
        const programSelect = document.getElementById('program-select');
        if (!programSelect) return;

        const previousValue = programSelect.value;
        const wasDisabled = programSelect.disabled;
        programSelect.disabled = true;
        programSelect.innerHTML = '<option value="">Loading programs...</option>';

        try {
            const res = await fetch('/api/academic-directory/programs', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load programs');
            const programs = await res.json();

            if (!Array.isArray(programs) || programs.length === 0) {
                programSelect.innerHTML = '<option value="">No programs available</option>';
                return;
            }

            programSelect.innerHTML = '<option value="">Select Program</option>';
            programs.forEach((program) => {
                const option = document.createElement('option');
                option.value = program.program_id ? String(program.program_id) : '';
                option.textContent = program.program_code
                    ? `${program.program_code} — ${program.program_name}`
                    : (program.program_name || 'Unnamed Program');
                option.dataset.programName = program.program_name || '';
                option.dataset.programCode = program.program_code || '';
                option.dataset.programLabel = option.textContent;
                programSelect.appendChild(option);
            });

            if (previousValue) {
                programSelect.value = previousValue;
            }
        } catch (err) {
            console.error('StudentApp: Failed to load programs', err);
            programSelect.innerHTML = '<option value="">Unable to load programs</option>';
        } finally {
            programSelect.disabled = wasDisabled;
        }
    }

    async loadRoomOptions() {
        const locationSelect = document.getElementById('location');
        if (!locationSelect) return;

        const previousValue = locationSelect.value;
        locationSelect.disabled = true;
        locationSelect.innerHTML = '<option value="">Loading rooms...</option>';

        try {
            const res = await fetch('/api/academic-directory/rooms', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load rooms');
            const rooms = await res.json();

            if (!Array.isArray(rooms) || rooms.length === 0) {
                locationSelect.innerHTML = '<option value="">No rooms available</option>';
                return;
            }

            locationSelect.innerHTML = '<option value="">Select Location</option>';
            rooms.forEach((room) => {
                const { displayLabel, locationValue } = this.buildRoomDisplay(room);
                const option = document.createElement('option');
                option.value = room.room_id ? String(room.room_id) : '';
                option.textContent = displayLabel;
                option.dataset.roomLabel = displayLabel;
                option.dataset.locationValue = locationValue;
                if (room.room_id) {
                    option.dataset.roomId = String(room.room_id);
                }
                if (room.is_computer_lab !== undefined && room.is_computer_lab !== null) {
                    option.dataset.isComputerLab = String(room.is_computer_lab);
                }
                locationSelect.appendChild(option);
            });

            if (previousValue) {
                locationSelect.value = previousValue;
            }
        } catch (err) {
            console.error('StudentApp: Failed to load rooms', err);
            locationSelect.innerHTML = '<option value="">Unable to load rooms</option>';
        } finally {
            locationSelect.disabled = false;
        }
    }

    async fetchCurrentUserProfile() {
        const userId = sessionStorage.getItem('user_id');
        if (!userId) throw new Error('Missing user id');

        const res = await fetch(`/api/users/${userId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
    }

    async autoFillStudentProfile() {
        const programSelect = document.getElementById('program-select');
        const yearSelect = document.getElementById('year-select');

        if (!programSelect && !yearSelect) return;

        const setLockedState = (locked) => {
            if (programSelect) programSelect.disabled = locked;
            if (yearSelect) yearSelect.disabled = locked;
        };

        setLockedState(true);

        try {
            const profile = await this.fetchCurrentUserProfile();

            let hasCompleteProfile = true;

            if (programSelect) {
                let resolvedProgramValue = '';
                if (profile.program_id) {
                    resolvedProgramValue = String(profile.program_id);
                } else if (profile.program) {
                    const normalizedProgram = String(profile.program).trim().toLowerCase();
                    const matchingOption = Array.from(programSelect.options).find((option) => {
                        const optionName = option.dataset?.programName?.trim().toLowerCase();
                        const optionCode = option.dataset?.programCode?.trim().toLowerCase();
                        const optionText = option.textContent?.trim().toLowerCase();
                        return optionName === normalizedProgram || optionCode === normalizedProgram || optionText === normalizedProgram;
                    });
                    if (matchingOption) {
                        resolvedProgramValue = matchingOption.value;
                    }
                }

                if (resolvedProgramValue) {
                    programSelect.value = resolvedProgramValue;
                } else {
                    programSelect.value = '';
                    hasCompleteProfile = false;
                }
            }

            if (yearSelect) {
                if (profile.year_level) {
                    yearSelect.value = String(profile.year_level);
                } else {
                    yearSelect.value = '';
                    hasCompleteProfile = false;
                }
            }

            setLockedState(hasCompleteProfile);
            if (!hasCompleteProfile) {
                this.showToast('Some profile details are missing. Please fill them in manually.', 'warning');
            }
        } catch (err) {
            console.warn('StudentApp: Could not auto-fill profile:', err);
            setLockedState(false);
        }
    }

    async loadEquipmentForForm(date) {
        const container = document.getElementById('equipment-container');
        if (!container) return;

        try {
            let url = '/api/equipment';
            let isDateBased = false;
            if (date) {
                url = `/api/equipment/availability?date=${encodeURIComponent(date)}`;
                isDateBased = true;
            }

            container.innerHTML = '<div style="padding:10px;text-align:center;color:#6b7280;">Loading equipment...</div>';

            const res = await fetch(url, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load equipment');
            const equipment = await res.json();

            if (!equipment || equipment.length === 0) {
                container.innerHTML = '<div style="padding:10px;color:#666;">No equipment available.</div>';
                return;
            }

            container.innerHTML = equipment.map(item => {
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

                return `
                    <div class="equipment-item ${disabled ? 'disabled' : ''}" style="margin-bottom:8px;padding:10px;border:1px solid #ddd;border-radius:6px;display:flex;align-items:center;justify-content:space-between;${disabled ? 'background:#f9f9f9;opacity:0.6;' : ''}">
                        <div style="display:flex;align-items:center;flex:1;flex-wrap:wrap;">
                            <input type="checkbox" name="equipment_ids[]" value="${item.equipment_id}"
                                   data-equipment-id="${item.equipment_id}" ${disabled ? 'disabled' : ''}
                                   style="margin-right:10px;" />
                            <strong>${this.escapeHtml(item.equipment_name)}</strong>
                            ${disabled ? `<span style="margin-left:8px;color:#dc2626;font-size:12px;font-weight:600;">(${isDateBased ? 'Unavailable on this date' : 'Out of Stock'})</span>` : ''}
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
            }).join('');

            const dateInfoId = 'equipment-date-context';
            let dateInfo = document.getElementById(dateInfoId);
            if (isDateBased) {
                if (!dateInfo) {
                    dateInfo = document.createElement('div');
                    dateInfo.id = dateInfoId;
                    dateInfo.style.cssText = 'padding:6px 10px;margin:8px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1e40af;display:flex;align-items:center;gap:6px;';
                    const labelEl = container.previousElementSibling;
                    if (labelEl) {
                        labelEl.insertAdjacentElement('afterend', dateInfo);
                    } else {
                        container.parentElement?.insertBefore(dateInfo, container);
                    }
                }
                dateInfo.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Showing availability for <strong>${this.escapeHtml(date)}</strong>.
                `;
            } else if (dateInfo) {
                dateInfo.remove();
            }

            if (!container.dataset.equipmentListenerBound) {
                container.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox' && e.target.name === 'equipment_ids[]') {
                        const eqId = e.target.dataset.equipmentId;
                        const qtyInput = document.getElementById(`requested-${eqId}`);
                        if (qtyInput) {
                            qtyInput.disabled = !e.target.checked;
                            qtyInput.value = e.target.checked ? '1' : '';
                        }
                    }

                    if (e.target.name === 'equipment_ids[]' || e.target.name === 'requested_quantities[]') {
                        this.runConflictCheck();
                    }
                });
                container.dataset.equipmentListenerBound = 'true';
            }

            this.runConflictCheck();

        } catch (err) {
            console.error('StudentApp: Equipment load failed:', err);
            container.innerHTML = '<div style="color:red;padding:10px;">Failed to load equipment.</div>';
        }
    }

    setupDateEquipmentRefresh() {
        const dateNeeded = document.getElementById('dateNeeded');
        if (!dateNeeded) return;

        dateNeeded.addEventListener('change', () => {
            const date = dateNeeded.value;
            this.loadEquipmentForForm(date || undefined);
            this.runConflictCheck();
        });
    }

    setupConflictDetection() {
        const role = sessionStorage.getItem('role');
        if (!role || role.toLowerCase() === 'student' || role === '3') {
            this.requestConflictHelper = null;
            return;
        }

        const Helper = window.SmartLab?.Core?.Pages?.RequestConflictHelper;
        if (!Helper) {
            console.error('StudentApp: RequestConflictHelper not found.');
            return;
        }

        const resolveRoom = () => {
            const locationInput = document.getElementById('location');
            if (!locationInput) return { label: '', id: null };

            if (locationInput.tagName === 'SELECT') {
                const selectedOption = locationInput.selectedOptions?.[0];
                if (selectedOption) {
                    const label = selectedOption.dataset?.roomLabel
                        || selectedOption.dataset?.locationValue
                        || selectedOption.textContent?.trim()
                        || '';
                    const parsedId = selectedOption.value ? Number(selectedOption.value) : null;
                    return { label, id: Number.isNaN(parsedId) ? null : parsedId };
                }
            } else if (locationInput.value?.trim()) {
                const label = locationInput.value.trim();
                const parsedId = locationInput.dataset?.roomId ? Number(locationInput.dataset.roomId) : null;
                return { label, id: Number.isNaN(parsedId) ? null : parsedId };
            }

            return { label: '', id: null };
        };

        this.requestConflictHelper = new Helper({
            role: 'student',
            containerId: 'conflict-display',
            resolveRoom,
            getSelectedEquipment: () => this.getSelectedEquipment(),
            onBlockingChange: () => {},
            watchFields: ['location'],
            includePending: false,
            includeRequests: false
        });

        this.requestConflictHelper.init();
    }

    getSelectedEquipment() {
        const checkboxes = document.querySelectorAll('input[name="equipment_ids[]"]:checked');
        const ids = [];
        const quantities = {};

        checkboxes.forEach(cb => {
            const eqId = cb.value;
            ids.push(Number(eqId));
            const qtyInput = document.getElementById(`requested-${eqId}`);
            quantities[eqId] = Number(qtyInput?.value) || 1;
        });

        return { ids, quantities };
    }

    runConflictCheck() {
        this.triggerRequestConflictCheck();
    }

    triggerRequestConflictCheck() {
        this.requestConflictHelper?.runCheck();
    }

    async loadFacultyOptions() {
        const facultySelect = document.getElementById('facultyIdSelect');
        if (!facultySelect) return;

        try {
            const res = await fetch('/api/faculty-list', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error('Failed');
            const faculty = await res.json();

            facultySelect.innerHTML = '<option value="">-- Select Faculty --</option>';
            faculty.forEach(fac => {
                const opt = document.createElement('option');
                opt.value = fac.faculty_id;
                opt.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
                facultySelect.appendChild(opt);
            });
        } catch (err) {
            console.error('StudentApp: Faculty list load failed:', err);
        }
    }

    setupRequestFormSubmit() {
        const form = document.getElementById('studentRequestForm');
        if (!form) return;

        const newBtn = document.getElementById('newRequestBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        if (newBtn) newBtn.addEventListener('click', async () => {
            const ok = await SmartLab.Core.UI.confirm('Start a new request? Current form data will be cleared.', 'New Request', { type: 'info', confirmText: 'Start New' });
            if (ok) {
                form.reset();
                await this.autoFillStudentProfile();
                const dateInput = document.getElementById('dateNeeded');
                await this.loadEquipmentForForm(dateInput?.value);
                this.requestConflictHelper?.reset();
            }
        });
        if (cancelBtn) cancelBtn.addEventListener('click', async () => {
            const ok = await SmartLab.Core.UI.confirm('Cancel this request? All entered data will be lost.', 'Cancel Request', { type: 'warning', confirmText: 'Yes, Cancel' });
            if (ok) {
                form.reset();
                await this.autoFillStudentProfile();
                const dateInput = document.getElementById('dateNeeded');
                await this.loadEquipmentForForm(dateInput?.value);
                this.requestConflictHelper?.reset();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRequestSubmit(form);
        });
    }

    async handleRequestSubmit(form) {
        const userId = Number(sessionStorage.getItem('user_id'));
        if (!userId) {
            this.showToast('Session expired. Please log in again.', 'error');
            return;
        }

        const locationInput = document.getElementById('location');
        const facultySelect = document.getElementById('facultyIdSelect');
        const programSelect = document.getElementById('program-select');
        const yearSelect = document.getElementById('year-select');
        const subjectSelect = document.getElementById('subject-select');
        const dateNeeded = document.getElementById('dateNeeded');
        const timeStart = document.getElementById('timeStart');
        const timeEnd = document.getElementById('timeEnd');
        const contactDetails = document.getElementById('contactDetails');
        const purpose = document.getElementById('purpose');

        const parseInteger = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const parsed = Number(value);
            return Number.isInteger(parsed) ? parsed : null;
        };

        // Collect values
        const selectedSubjectOption = subjectSelect?.selectedOptions?.[0];
        const selectedSubjectId = parseInteger(subjectSelect?.value);
        const subjectLabel = selectedSubjectOption?.dataset?.subjectLabel
            || selectedSubjectOption?.textContent?.trim()
            || '';
        const date = dateNeeded?.value || '';
        const start = timeStart?.value || '';
        const end = timeEnd?.value || '';
        const contact = contactDetails?.value?.trim() || '';
        const purposeText = purpose?.value?.trim() || '';
        const selectedProgramOption = programSelect?.selectedOptions?.[0];
        const selectedProgramId = parseInteger(programSelect?.value);
        const programLabel = selectedProgramOption?.dataset?.programLabel
            || selectedProgramOption?.textContent?.trim()
            || '';
        const yearLevel = yearSelect?.value ? Number(yearSelect.value) : null;

        let roomId = null;
        let roomLabel = '';
        if (locationInput) {
            if (locationInput.tagName === 'SELECT') {
                const selectedRoomOption = locationInput.selectedOptions?.[0];
                if (selectedRoomOption) {
                    roomLabel = selectedRoomOption.dataset?.roomLabel
                        || selectedRoomOption.dataset?.locationValue
                        || selectedRoomOption.textContent?.trim()
                        || '';
                    roomId = parseInteger(selectedRoomOption.value);
                }
            } else if (locationInput.value?.trim()) {
                roomLabel = locationInput.value.trim();
                roomId = parseInteger(locationInput.dataset?.roomId || null);
            }
        }

        let facultyId = facultySelect?.value ? Number(facultySelect.value) : null;
        let facultyName = facultySelect?.options[facultySelect?.selectedIndex]?.text || '';

        // Validation
        if (!subjectLabel || !date || !start || !end || !purposeText) {
            this.showToast('Please fill in all required fields.', 'warning');
            return;
        }
        if (!selectedSubjectId || selectedSubjectId <= 0) {
            this.showToast('Please select a subject from the list.', 'warning');
            return;
        }
        if (!selectedProgramId || selectedProgramId <= 0) {
            this.showToast('Please select a program.', 'warning');
            return;
        }
        if (!yearLevel || yearLevel <= 0) {
            this.showToast('Please select a year level.', 'warning');
            return;
        }
        if (!roomId || roomId <= 0 || !roomLabel) {
            this.showToast('Please select a laboratory/room.', 'warning');
            return;
        }
        if (!this.validateTimeSlots(start, end)) {
            return;
        }

        // Get selected equipment with quantities
        const selectedEquipment = Array.from(
            document.querySelectorAll('input[name="equipment_ids[]"]:checked')
        ).map(cb => {
            const eqId = Number(cb.value);
            const qty = parseInt(document.getElementById(`requested-${eqId}`)?.value) || 0;
            return { equipment_id: eqId, requested_quantity: qty };
        }).filter(item => item.requested_quantity > 0);

        const equipment_ids = selectedEquipment.map(item => item.equipment_id);

        if (!selectedEquipment.length) {
            this.showToast('Please select at least one equipment item.', 'warning');
            return;
        }

        const payload = {
            requested_by: userId,
            lab_schedule_id: null,
            faculty_id: facultyId,
            subject_id: selectedSubjectId,
            program_id: selectedProgramId,
            program_label: programLabel,
            year_level: yearLevel,
            date_needed: date,
            room_id: roomId,
            time_start: start,
            time_end: end,
            contact_details: contact || null,
            purpose: purposeText,
            status_id: 1,
            subject_label: subjectLabel,
            room_label: roomLabel,
            academic_year_id: null,
            term_id: null,
            equipment_ids,
            equipment_details: selectedEquipment
        };

        try {
            const res = await fetch('/api/borrowRequests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                this.showToast(data.message || 'Failed to submit request.', 'error');
                return;
            }

            this.showToast(data.message || 'Request submitted successfully!', 'success');
            form.reset();
            await this.autoFillStudentProfile();
            const dateInput = document.getElementById('dateNeeded');
            await this.loadEquipmentForForm(dateInput?.value);
            this.requestConflictHelper?.reset();
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            console.error('StudentApp: Request submit error:', err);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    // =========================================
    // VIEW REQUESTS PAGE
    // =========================================

    async initViewRequestsPage() {
        const TableHelper = window.SmartLab?.Core?.Pages?.MyRequestsTable;
        if (!TableHelper) {
            console.error('StudentApp: MyRequestsTable helper not found.');
            return;
        }

        if (!this.myRequestsTable) {
            this.myRequestsTable = new TableHelper({
                role: 'student',
                tableSelector: '#my-requests-tbody',
                paginationSelector: '#my-requests-pagination',
                fetchUrl: (userId) => `/api/myBorrowRequests/my/${userId}`,
                getAuthHeaders: () => SmartLab.Core.Auth.getAuthHeaders(),
                getUserId: () => Number(sessionStorage.getItem('user_id')),
                itemsPerPage: 10,
                columnCount: 8,
                emptyCopy: 'No requests found.',
                loadingCopy: 'Loading...',
                errorCopy: 'Failed to load requests.',
                sessionExpiredCopy: 'Session expired. Please log in again.',
                buildRoomLabel: (row) => row.location || '-',
                buildNoteLabel: (row) => (row.note && String(row.note).trim()) ? String(row.note).trim() : '-',
                formatDate: (val) => this.formatDate(val),
                getStatusClass: (status) => this.getStatusClass(status),
                showToast: (msg, type) => this.showToast(msg, type),
                onCancelRequest: (requestId) => this.cancelBorrowRequest(requestId),
                confirmCancelMessage: 'Cancel this request? This action cannot be undone.',
                confirmCancelTitle: 'Cancel Request',
                cancelSuccessMessage: 'Request cancelled successfully.'
            });
        }

        await this.myRequestsTable.init();
    }

    async cancelBorrowRequest(requestId) {
        if (!requestId) return;

        const res = await fetch(`/api/borrowRequests/${requestId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
            body: JSON.stringify({ status_id: 4 })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to cancel request.');
        }
    }

    // =========================================
    // SCHEDULE PAGE
    // =========================================

    async initSchedulePage() {
        if (!window.SmartLab?.Core?.Components?.ScheduleViewer) {
            console.error('StudentApp: ScheduleViewer component not found.');
            return;
        }

        this.scheduleViewer = new SmartLab.Core.Components.ScheduleViewer({
            useAcademicContextFilter: false,
            permissions: { canAdd: false, canEdit: false, canDelete: false },
            callbacks: {
                onInfo: (schedule) => this.showScheduleDetailModal(schedule)
            }
        });

        await this.scheduleViewer.init();
    }

    // =========================================
    // SCHEDULE DETAIL MODAL
    // =========================================

    showScheduleDetailModal(s) {
        // Remove existing
        document.querySelector('.sd-modal-overlay')?.remove();

        const initials = (s.faculty_name || s.full_name || '?')
            .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        const overlay = document.createElement('div');
        overlay.className = 'sd-modal-overlay';
        overlay.innerHTML = `
            <div class="sd-modal">
                <div class="sd-header">
                    <div class="sd-header-left">
                        <span class="sd-day-badge">${this.escapeHtml(s.day_of_week || '-')}</span>
                    </div>
                    <button class="sd-close" title="Close">&times;</button>
                </div>
                <div class="sd-body">
                    <h3 class="sd-title">Schedule Details</h3>

                    <div class="sd-requester-card">
                        <div class="sd-avatar">${initials}</div>
                        <div class="sd-requester-info">
                            <span class="sd-requester-name">${this.escapeHtml(s.faculty_name || s.full_name || '-')}</span>
                            <span class="sd-requester-meta">Faculty</span>
                        </div>
                    </div>

                    <div class="sd-grid">
                        <div class="sd-field">
                            <span class="sd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Lab Room
                            </span>
                            <span class="sd-value">${this.escapeHtml(s.lab_room || '-')}</span>
                        </div>
                        <div class="sd-field">
                            <span class="sd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                Subject
                            </span>
                            <span class="sd-value">${this.escapeHtml(s.subject || '-')}</span>
                        </div>
                        <div class="sd-field">
                            <span class="sd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Day
                            </span>
                            <span class="sd-value">${this.escapeHtml(s.day_of_week || '-')}</span>
                        </div>
                        <div class="sd-field">
                            <span class="sd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                                Time
                            </span>
                            <span class="sd-value">${SmartLab.Core.Utils.formatTimeRange(s.time_start, s.time_end)}</span>
                        </div>
                        <div class="sd-field">
                            <span class="sd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                Program &amp; Year
                            </span>
                            <span class="sd-value">${this.escapeHtml(s.program_code || '-')}${s.year_level ? ' - Year ' + s.year_level : ''}</span>
                        </div>
                    </div>
                </div>
                <div class="sd-footer">
                    <button class="sd-close-btn">Close</button>
                </div>
            </div>`;

        document.querySelector('.schedule-page').appendChild(overlay);

        // Close handlers
        overlay.querySelector('.sd-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.sd-close-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
        });

        // Animate in
        requestAnimationFrame(() => overlay.classList.add('active'));
    }

    // =========================================
    // Utilities
    // =========================================

    escapeHtml(val) {
        return String(val ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    formatDate(d) {
        return SmartLab.Core.Utils.formatDate(d);
    }

    getStatusClass(statusName) {
        const s = String(statusName).toLowerCase();
        if (s.includes('approve')) return 'status-approved';
        if (s.includes('borrow')) return 'status-borrowed';
        if (s.includes('decline')) return 'status-declined';
        if (s.includes('cancel')) return 'status-cancelled';
        if (s.includes('return')) return 'status-returned';
        return 'status-pending';
    }

    showToast(message, type = 'info') {
        if (window.SmartLab?.Core?.UI?.showToast) {
            window.SmartLab.Core.UI.showToast(message, type);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.studentApp = new StudentApp();
});
