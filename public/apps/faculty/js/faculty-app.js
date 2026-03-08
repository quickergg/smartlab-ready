/* =========================================
   SmartLab – Faculty SPA Application
   Follows admin-app.js architecture
========================================= */

class FacultyApp {
    constructor() {
        this.currentPage = 'request';
        this.routes = {};
        this.isLoading = false;
        this.allSchedules = [];
        this.filteredSchedules = [];
        this.timeValidationDefaults = {
            start: 'Select a start time between 7:30 AM and 9:00 PM.',
            end: 'Select an end time at least 30 minutes after the start.'
        };
        this.requestLeadDays = 2;
        this._labCheckboxRefs = null;
        this.ganttChartInstance = null;
        this.scheduleCurrentView = 'table';
        this.schedulePagination = { currentPage: 1, itemsPerPage: 10 };
        this.calendarDate = new Date();
        this._scheduleSearchTimer = null;
        this.labColors = [
            '#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
        ];
        this._labColorMap = {};
        this._calModalEscHandler = null;
        this.myRequestsTable = null;
        this.requestSubmitState = { blocked: false, reason: '' };
        this.requestConflictHelper = null;

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
            if (message && text) {
                message.textContent = text;
            }
        };

        const notify = (msg) => {
            if (emitToast) {
                this.showToast(msg, 'warning');
            }
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
            if (!allowIncomplete) {
                notify('Please select a start time.');
            }
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
            if (!allowIncomplete) {
                notify('Please select an end time.');
            }
        } else if (!slots.includes(end)) {
            setState(endCard, 'error', 'Time End must be between 7:30 AM and 9:00 PM in 30-minute increments.');
            notify('Time End must be between 7:30 AM and 9:00 PM in 30-minute increments.');
            isValid = false;
        } else {
            endSlotValid = true;
            // Temporarily mark as clear; may be overridden by cross-field validation below
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

    setupTimeValidationCards() {
        const timeStart = document.getElementById('timeStart');
        const timeEnd = document.getElementById('timeEnd');
        const form = document.getElementById('facultyRequestForm');

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
            form.addEventListener('reset', () => {
                // Wait for native reset to clear values before refreshing
                setTimeout(refresh, 0);
            });
        }

        refresh();
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

    async reloadEquipment(date) {
        if (this.borrowRequestController?.loadEquipmentForForm) {
            await this.borrowRequestController.loadEquipmentForForm(date || undefined);
        } else {
            console.warn('FacultyApp: BorrowRequestController.loadEquipmentForForm not available.');
        }
    }

    teardownLabCheckbox() {
        const refs = this._labCheckboxRefs;
        if (!refs) return;
        refs.labChk?.removeEventListener('change', refs.handleCheckboxChange);
        refs.labSelect?.removeEventListener('change', refs.handleLabSelectChange);
        this._labCheckboxRefs = null;
    }

    setupLabCheckbox() {
        const labChk = document.getElementById('labChk');
        const labSelectWrap = document.getElementById('labSelectWrap');
        const labSelect = document.getElementById('labSelect');
        const locationInput = document.getElementById('location');

        this.teardownLabCheckbox();

        if (!labChk || !labSelectWrap) return;

        const toggle = () => {
            const on = labChk.checked;
            labSelectWrap.classList.toggle('hidden', !on);
            if (!on && labSelect) {
                labSelect.value = '';
            }

            if (locationInput) {
                if (on) {
                    locationInput.dataset.prevValue = locationInput.value || '';
                    locationInput.disabled = true;
                    locationInput.value = '';
                } else {
                    locationInput.disabled = false;
                    if (locationInput.dataset.prevValue !== undefined) {
                        locationInput.value = locationInput.dataset.prevValue;
                        delete locationInput.dataset.prevValue;
                    }
                }
            }
        };

        const handleCheckboxChange = () => {
            toggle();
            this.runConflictCheck();
        };

        labChk.addEventListener('change', handleCheckboxChange);

        const handleLabSelectChange = () => this.runConflictCheck();
        if (labSelect) {
            labSelect.addEventListener('change', handleLabSelectChange);
        }

        this._labCheckboxRefs = {
            labChk,
            labSelect,
            labSelectWrap,
            locationInput,
            handleCheckboxChange,
            handleLabSelectChange
        };

        toggle();
    }

    async loadFacultyOptions() {
        const facultySelect = document.getElementById('facultyIdSelect');
        if (!facultySelect) return;

        try {
            const res = await fetch('/api/faculty', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const options = data.map(faculty => `<option value="${faculty.id}">${faculty.name}</option>`);
                facultySelect.innerHTML = options.join('');
            }
        } catch (err) {
            console.error('FacultyApp: Faculty list load failed:', err);
        }
    }

    // =========================================
    // Initialization
    // =========================================

    async init() {
        try {
            // Guard role + token validity
            if (!SmartLab.Core.Auth.guardRole('Faculty')) return;

            // Show container, hide loading
            const container = document.getElementById('faculty-container');
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
            console.error('FacultyApp: Init failed:', error);
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
                                <p>Faculty Portal</p>
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
                        <div class="profile-badge">Faculty</div>
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
        const email = sessionStorage.getItem('gmail') || 'Faculty';
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
            console.warn('FacultyApp: Academic context load failed:', err);
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
                this.loadPage('profile');
            });
        }
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                dropdown.classList.add('hidden');
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
                url: '/shared/pages/profile.html',
                title: 'Profile Settings',
                absolute: true,
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
            console.error('FacultyApp: Unknown page:', page);
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
            const fetchUrl = route.absolute ? route.url : '/apps/faculty/' + route.url;
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
            console.error('FacultyApp: Page load failed:', error);
            const content = document.getElementById('page-content');
            if (content) {
                content.innerHTML = `<div style="padding:2rem;text-align:center;color:#6b7280;">
                    <p>Failed to load page. Please try again.</p>
                    <button class="btn btn-primary" onclick="window.facultyApp.loadPage('${page}')">Retry</button>
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
            SmartLab.Core.Templates.renderBorrowRequestForm('borrow-request-form', { role: 'faculty' });
        } else {
            console.warn('FacultyApp: BorrowRequestForm template not found.');
        }

        if (!window.SmartLab?.Core?.Pages?.BorrowRequestController) {
            console.error('FacultyApp: BorrowRequestController not found.');
            return;
        }

        this.borrowRequestController = new SmartLab.Core.Pages.BorrowRequestController({
            role: 'faculty',
            formId: 'facultyRequestForm',
            requestLeadDays: this.requestLeadDays,
            hooks: {
                onAfterInit: async () => {
                    this.setupLabCheckbox();
                    this.setupConflictDetection();
                    this.setupRequestFormSubmit();
                },
                onDateChange: () => this.runConflictCheck(),
                onTimeChange: () => this.runConflictCheck(),
                onEquipmentChange: () => this.runConflictCheck(),
                onEquipmentLoad: () => this.runConflictCheck(),
                onReset: async () => {
                    this.setupLabCheckbox();
                    this.requestConflictHelper?.reset();
                    this.updateSubmitAvailability(false);
                }
            }
        });

        await this.borrowRequestController.init();
    }

    // =========================================
    // CONFLICT DETECTION
    // =========================================

    setupConflictDetection() {
        const Helper = window.SmartLab?.Core?.Pages?.RequestConflictHelper;
        if (!Helper) {
            console.error('FacultyApp: RequestConflictHelper not found.');
            return;
        }

        const resolveRoom = () => {
            const labChk = document.getElementById('labChk');
            const labSelect = document.getElementById('labSelect');
            const locationInput = document.getElementById('location');

            if (labChk?.checked) {
                const labOption = labSelect?.selectedOptions?.[0];
                if (labOption) {
                    const label = labOption.dataset?.locationValue
                        || labOption.dataset?.roomLabel
                        || labOption.textContent?.trim()
                        || '';
                    const parsedId = labOption.value ? Number(labOption.value) : null;
                    return { label, id: Number.isNaN(parsedId) ? null : parsedId };
                }
            } else if (locationInput) {
                if (locationInput.tagName === 'SELECT') {
                    const selectedLocation = locationInput.selectedOptions?.[0];
                    if (selectedLocation) {
                        const label = selectedLocation.dataset?.locationValue
                            || selectedLocation.dataset?.roomLabel
                            || selectedLocation.textContent?.trim()
                            || '';
                        const parsedId = selectedLocation.value ? Number(selectedLocation.value) : null;
                        return { label, id: Number.isNaN(parsedId) ? null : parsedId };
                    }
                } else if (locationInput.value?.trim()) {
                    const label = locationInput.value.trim();
                    const parsedId = locationInput.dataset?.roomId ? Number(locationInput.dataset.roomId) : null;
                    return { label, id: Number.isNaN(parsedId) ? null : parsedId };
                }
            }

            return { label: '', id: null };
        };

        const shouldCheck = () => {
            const dateNeeded = document.getElementById('dateNeeded');
            const timeStart = document.getElementById('timeStart');
            const timeEnd = document.getElementById('timeEnd');
            const room = resolveRoom();
            return !!(room.label && dateNeeded?.value && timeStart?.value && timeEnd?.value);
        };

        this.requestConflictHelper = new Helper({
            role: 'faculty',
            containerId: 'conflict-display',
            resolveRoom,
            getSelectedEquipment: () => this.getSelectedEquipment(),
            onBlockingChange: (blocked, reason) => this.updateSubmitAvailability(blocked, reason),
            shouldCheck,
            watchFields: [
                { element: 'labChk', events: ['change'] },
                { element: 'labSelect', events: ['change'] },
                { element: 'location', events: ['change', 'input'] }
            ],
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
        this.requestConflictHelper?.runCheck();
    }

    updateSubmitAvailability(blocked, reason = '') {
        this.requestSubmitState = { blocked: !!blocked, reason: reason || '' };
        const submitBtn = document.getElementById('submitRequestBtn');
        if (!submitBtn) return;

        submitBtn.disabled = !!blocked;
        submitBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
        if (blocked && reason) {
            submitBtn.title = reason;
        } else {
            submitBtn.removeAttribute('title');
        }
    }

    setupRequestFormSubmit() {
        const form = document.getElementById('facultyRequestForm');
        if (!form) return;

        const newBtn = document.getElementById('newRequestBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        const resetFormState = async () => {
            this.setupLabCheckbox();
            const dateInput = document.getElementById('dateNeeded');
            await this.reloadEquipment(dateInput?.value);
            this.requestConflictHelper?.reset();
            this.updateSubmitAvailability(false);
        };

        if (newBtn) newBtn.addEventListener('click', async () => {
            const ok = await SmartLab.Core.UI.confirm('Start a new request? Current form data will be cleared.', 'New Request', { type: 'info', confirmText: 'Start New' });
            if (ok) {
                form.reset();
                await resetFormState();
            }
        });
        if (cancelBtn) cancelBtn.addEventListener('click', async () => {
            const ok = await SmartLab.Core.UI.confirm('Cancel this request? All entered data will be lost.', 'Cancel Request', { type: 'warning', confirmText: 'Yes, Cancel' });
            if (ok) {
                form.reset();
                await resetFormState();
            }
        });

        this.updateSubmitAvailability(false);

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

        if (this.requestSubmitState?.blocked) {
            this.showToast(this.requestSubmitState.reason || 'Resolve conflicts before submitting.', 'warning');
            return;
        }

        const labChk = document.getElementById('labChk');
        const labSelect = document.getElementById('labSelect');
        const facultySelect = document.getElementById('facultyIdSelect');
        const programSelect = document.getElementById('program-select');
        const yearSelect = document.getElementById('year-select');
        const subjectSelect = document.getElementById('subject-select');
        const dateNeeded = document.getElementById('dateNeeded');
        const locationSelect = document.getElementById('location');
        const timeStart = document.getElementById('timeStart');
        const timeEnd = document.getElementById('timeEnd');
        const contactDetails = document.getElementById('contactDetails');
        const purpose = document.getElementById('purpose');

        const selectedSubjectOption = subjectSelect?.selectedOptions?.[0] || null;
        const selectedSubjectId = selectedSubjectOption ? Number(selectedSubjectOption.value) : null;

        const selectedProgramOption = programSelect?.selectedOptions?.[0] || null;
        const selectedProgramId = selectedProgramOption ? Number(selectedProgramOption.value) : null;

        const yearLevel = yearSelect?.value ? Number(yearSelect.value) : null;
        const date = dateNeeded?.value || '';
        const start = timeStart?.value || '';
        const end = timeEnd?.value || '';
        const contact = contactDetails?.value?.trim() || '';
        const purposeText = purpose?.value?.trim() || '';

        const labSelectedOption = labSelect?.selectedOptions?.[0] || null;
        const manualLocationOption = locationSelect?.selectedOptions?.[0] || null;

        let roomId = null;
        if (labChk?.checked && labSelectedOption) {
            roomId = labSelectedOption.value ? Number(labSelectedOption.value) : null;
        } else if (manualLocationOption) {
            roomId = manualLocationOption.value ? Number(manualLocationOption.value) : null;
        }

        let facultyId = facultySelect?.value ? Number(facultySelect.value) : userId;

        // Validation
        if (!date || !start || !end || !purposeText) {
            this.showToast('Please fill in all required fields.', 'warning');
            return;
        }
        if (!selectedSubjectId || !Number.isInteger(selectedSubjectId) || selectedSubjectId <= 0) {
            this.showToast('Please select a subject from the list.', 'warning');
            return;
        }
        if (!selectedProgramId || !Number.isInteger(selectedProgramId) || selectedProgramId <= 0) {
            this.showToast('Please select a program.', 'warning');
            return;
        }
        if (!Number.isInteger(yearLevel) || yearLevel <= 0) {
            this.showToast('Please select a year level.', 'warning');
            return;
        }
        if (!roomId || !Number.isInteger(roomId) || roomId <= 0) {
            this.showToast('Please select a valid laboratory/room.', 'warning');
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

        const payload = {
            requested_by: userId,
            lab_schedule_id: null,
            faculty_id: facultyId,
            subject_id: selectedSubjectId,
            program_id: selectedProgramId,
            year_level: yearLevel,
            date_needed: date,
            room_id: roomId,
            time_start: start,
            time_end: end,
            contact_details: contact || null,
            purpose: purposeText,
            status_id: 1,
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
            this.setupLabCheckbox();
            await this.reloadEquipment(dateNeeded?.value);
            this.requestConflictHelper?.reset();
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            console.error('FacultyApp: Request submit error:', err);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    // =========================================
    // VIEW REQUESTS PAGE
    // =========================================

    async initViewRequestsPage() {
        const TableHelper = window.SmartLab?.Core?.Pages?.MyRequestsTable;
        if (!TableHelper) {
            console.error('FacultyApp: MyRequestsTable helper not found.');
            return;
        }

        if (!this.myRequestsTable) {
            this.myRequestsTable = new TableHelper({
                role: 'faculty',
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
                buildRoomLabel: (row) => {
                    const roomNumber = (row.room_number || '').trim();
                    const roomName = (row.room_name || '').trim();
                    if (roomNumber && roomName) return `${roomNumber} • ${roomName}`;
                    if (roomNumber || roomName) return roomNumber || roomName;
                    return row.room_label || '-';
                },
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
            throw new Error(errData.message || 'Failed to cancel request');
        }
    }

    // =========================================
    // SCHEDULE PAGE
    // =========================================

    async initSchedulePage() {
        if (!window.SmartLab?.Core?.Components?.ScheduleViewer) {
            console.error('FacultyApp: ScheduleViewer component not found.');
            return;
        }

        if (!this.scheduleViewer) {
            this.scheduleViewer = new SmartLab.Core.Components.ScheduleViewer({
                useAcademicContextFilter: false,
                permissions: { canAdd: false, canEdit: false, canDelete: false },
                callbacks: {
                    onInfo: (schedule) => this.showScheduleDetailModal(schedule)
                }
            });
        }

        await this.scheduleViewer.init();
    }

    cacheScheduleElements() {
        this.scheduleDOM = {
            searchInput: document.getElementById('schedule-search'),
            labFilter: document.getElementById('lab-filter'),
            dayFilter: document.getElementById('day-filter'),
            facultyFilter: document.getElementById('faculty-filter'),
            statusFilter: document.getElementById('status-filter'),
            sortSelect: document.getElementById('schedule-sort'),
            resultsCount: document.getElementById('schedule-results-count'),
            clearBtn: document.getElementById('schedule-clear-filters-btn'),
            activeFilters: document.getElementById('schedule-active-filters'),
            tableBody: document.getElementById('schedule-table-body'),
            pagination: document.getElementById('schedule-pagination'),
            calendarGrid: document.getElementById('calendar-grid'),
            calendarLabel: document.getElementById('cal-month-label')
        };
    }

    setupScheduleEventListeners() {
        const viewTabs = document.querySelectorAll('.schedule-page .view-tab[data-view]');
        viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) this.switchScheduleView(view);
            });
        });

        const handleFilterChange = () => {
            this.schedulePagination.currentPage = 1;
            this.applyScheduleFilters();
        };

        [
            this.scheduleDOM.labFilter,
            this.scheduleDOM.dayFilter,
            this.scheduleDOM.facultyFilter,
            this.scheduleDOM.statusFilter,
            this.scheduleDOM.sortSelect
        ].forEach(el => el?.addEventListener('change', handleFilterChange));

        if (this.scheduleDOM.searchInput) {
            this.scheduleDOM.searchInput.addEventListener('input', () => {
                clearTimeout(this._scheduleSearchTimer);
                this._scheduleSearchTimer = setTimeout(() => {
                    this.schedulePagination.currentPage = 1;
                    this.applyScheduleFilters();
                }, 300);
            });
        }

        this.scheduleDOM.clearBtn?.addEventListener('click', () => this.clearScheduleFilters());
        this.scheduleDOM.activeFilters?.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-tag-remove');
            if (!btn) return;
            this.clearSingleScheduleFilter(btn.dataset.clear);
        });

        document.getElementById('cal-prev-month')?.addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
            this.renderCalendarView();
        });
        document.getElementById('cal-next-month')?.addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
            this.renderCalendarView();
        });
        document.getElementById('cal-today-btn')?.addEventListener('click', () => {
            this.calendarDate = new Date();
            this.renderCalendarView();
        });
    }

    clearScheduleFilters() {
        if (this.scheduleDOM.searchInput) this.scheduleDOM.searchInput.value = '';
        if (this.scheduleDOM.labFilter) this.scheduleDOM.labFilter.value = '';
        if (this.scheduleDOM.dayFilter) this.scheduleDOM.dayFilter.value = '';
        if (this.scheduleDOM.facultyFilter) this.scheduleDOM.facultyFilter.value = '';
        if (this.scheduleDOM.statusFilter) this.scheduleDOM.statusFilter.value = '';
        if (this.scheduleDOM.sortSelect) this.scheduleDOM.sortSelect.value = 'day-time';
        this.schedulePagination.currentPage = 1;
        this.applyScheduleFilters();
    }

    clearSingleScheduleFilter(target) {
        switch (target) {
            case 'lab': if (this.scheduleDOM.labFilter) this.scheduleDOM.labFilter.value = ''; break;
            case 'day': if (this.scheduleDOM.dayFilter) this.scheduleDOM.dayFilter.value = ''; break;
            case 'faculty': if (this.scheduleDOM.facultyFilter) this.scheduleDOM.facultyFilter.value = ''; break;
            case 'status': if (this.scheduleDOM.statusFilter) this.scheduleDOM.statusFilter.value = ''; break;
            case 'search': if (this.scheduleDOM.searchInput) this.scheduleDOM.searchInput.value = ''; break;
            case 'sort': if (this.scheduleDOM.sortSelect) this.scheduleDOM.sortSelect.value = 'day-time'; break;
        }
        this.schedulePagination.currentPage = 1;
        this.applyScheduleFilters();
    }

    populateLabFilter() {
        if (!this.scheduleDOM?.labFilter) return;
        const current = this.scheduleDOM.labFilter.value;
        const labs = [...new Set(this.allSchedules.map(s => s.lab_room).filter(Boolean))].sort();
        this.scheduleDOM.labFilter.innerHTML = '<option value="">All Labs</option>';
        labs.forEach(lab => {
            this.scheduleDOM.labFilter.innerHTML += `<option value="${this.escapeHtml(lab)}">${this.escapeHtml(lab)}</option>`;
        });
        this.scheduleDOM.labFilter.value = current;
    }

    populateFacultyFilter() {
        if (!this.scheduleDOM?.facultyFilter) return;
        const current = this.scheduleDOM.facultyFilter.value;
        const faculty = [...new Set(this.allSchedules.map(s => s.faculty_name || s.full_name).filter(Boolean))].sort();
        this.scheduleDOM.facultyFilter.innerHTML = '<option value="">All Faculty</option>';
        faculty.forEach(name => {
            this.scheduleDOM.facultyFilter.innerHTML += `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`;
        });
        this.scheduleDOM.facultyFilter.value = current;
    }

    applyScheduleFilters() {
        const labVal = (this.scheduleDOM.labFilter?.value || '').trim();
        const dayVal = (this.scheduleDOM.dayFilter?.value || '').trim().toUpperCase();
        const facultyVal = (this.scheduleDOM.facultyFilter?.value || '').trim();
        const statusVal = (this.scheduleDOM.statusFilter?.value || '').trim();
        const searchVal = (this.scheduleDOM.searchInput?.value || '').trim().toLowerCase();
        const sortVal = this.scheduleDOM.sortSelect?.value || 'day-time';

        const filtered = this.allSchedules.filter(s => {
            if (labVal && (s.lab_room || '') !== labVal) return false;
            if (dayVal && (s.day_of_week || '').toUpperCase() !== dayVal) return false;
            if (facultyVal && (s.faculty_name || s.full_name || '') !== facultyVal) return false;
            if (statusVal) {
                const isOneTime = !!s.schedule_date;
                if (statusVal === 'recurring' && isOneTime) return false;
                if (statusVal === 'upcoming' && (!isOneTime || s.is_expired)) return false;
                if (statusVal === 'expired' && (!isOneTime || !s.is_expired)) return false;
            }
            if (searchVal) {
                const haystack = [s.faculty_name, s.full_name, s.subject, s.program, s.lab_room, s.day_of_week]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(searchVal)) return false;
            }
            return true;
        });

        const DAY_ORDER = { 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6, 'SUNDAY': 7 };
        filtered.sort((a, b) => {
            switch (sortVal) {
                case 'lab-asc':
                    return (a.lab_room || '').localeCompare(b.lab_room || '');
                case 'faculty-asc':
                    return (a.faculty_name || a.full_name || '').localeCompare(b.faculty_name || b.full_name || '');
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

        this.filteredSchedules = filtered;
        this.updateScheduleStats();
        this.updateResultsCount();
        this.renderActiveFilters();

        if (this.scheduleCurrentView === 'table') {
            this.renderScheduleTable();
        } else if (this.scheduleCurrentView === 'chart') {
            this.renderChartView();
        } else if (this.scheduleCurrentView === 'calendar') {
            this.renderCalendarView();
        }
    }

    updateScheduleStats() {
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        set('total-schedules-count', this.allSchedules.length);
        set('active-labs-count', [...new Set(this.allSchedules.map(s => s.lab_room).filter(Boolean))].length);
        set('total-faculty-count', [...new Set(this.allSchedules.map(s => s.faculty_name || s.full_name).filter(Boolean))].length);
        set('total-subjects-count', [...new Set(this.allSchedules.map(s => s.subject).filter(Boolean))].length);
    }

    updateResultsCount() {
        if (!this.scheduleDOM?.resultsCount) return;
        const total = this.allSchedules.length;
        const shown = this.filteredSchedules.length;
        this.scheduleDOM.resultsCount.textContent = shown === total
            ? `${total} schedule${total !== 1 ? 's' : ''}`
            : `${shown} of ${total} schedule${total !== 1 ? 's' : ''}`;
    }

    renderActiveFilters() {
        if (!this.scheduleDOM?.activeFilters) return;
        const tags = [];
        const icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        const labVal = this.scheduleDOM.labFilter?.value || '';
        if (labVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Lab:</span> ${this.escapeHtml(labVal)} <button class="filter-tag-remove" data-clear="lab">${icon}</button></span>`);
        }

        const dayVal = this.scheduleDOM.dayFilter?.value || '';
        if (dayVal) {
            const label = this.scheduleDOM.dayFilter.options[this.scheduleDOM.dayFilter.selectedIndex]?.text || dayVal;
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Day:</span> ${this.escapeHtml(label)} <button class="filter-tag-remove" data-clear="day">${icon}</button></span>`);
        }

        const facultyVal = this.scheduleDOM.facultyFilter?.value || '';
        if (facultyVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Faculty:</span> ${this.escapeHtml(facultyVal)} <button class="filter-tag-remove" data-clear="faculty">${icon}</button></span>`);
        }

        const statusVal = this.scheduleDOM.statusFilter?.value || '';
        if (statusVal) {
            const labels = { recurring: 'Recurring', upcoming: 'Upcoming', expired: 'Expired' };
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Status:</span> ${labels[statusVal] || statusVal} <button class="filter-tag-remove" data-clear="status">${icon}</button></span>`);
        }

        const searchVal = (this.scheduleDOM.searchInput?.value || '').trim();
        if (searchVal) {
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Search:</span> "${this.escapeHtml(searchVal)}" <button class="filter-tag-remove" data-clear="search">${icon}</button></span>`);
        }

        const sortVal = this.scheduleDOM.sortSelect?.value || 'day-time';
        if (sortVal !== 'day-time') {
            const sortLabels = { 'lab-asc': 'Lab A-Z', 'faculty-asc': 'Faculty A-Z', 'subject-asc': 'Subject A-Z' };
            tags.push(`<span class="filter-tag"><span class="filter-tag-label">Sort:</span> ${sortLabels[sortVal] || sortVal} <button class="filter-tag-remove" data-clear="sort">${icon}</button></span>`);
        }

        this.scheduleDOM.activeFilters.innerHTML = tags.join('');
    }

    async loadLabSchedules() {
        if (this.scheduleDOM?.tableBody) {
            this.scheduleDOM.tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading schedules...</td></tr>';
        }

        try {
            await this.fetchSchedules();
            this.renderScheduleTable();
        } catch (err) {
            console.error('FacultyApp: Failed to load schedules', err);
            if (this.scheduleDOM?.tableBody) {
                this.scheduleDOM.tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#b91c1c;padding:1.5rem;">Failed to load schedules.</td></tr>';
            }
        }
    }

    async fetchSchedules() {
        try {
            this.showScheduleLoadingState();
            const res = await fetch('/api/lab-schedules', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.allSchedules = Array.isArray(data) ? data : [];
            this.filteredSchedules = [...this.allSchedules];
            this.updateScheduleStats();
            this.renderScheduleTable();
        } catch (err) {
            console.error('FacultyApp: fetchSchedules failed', err);
            throw err;
        }
    }

    showScheduleLoadingState() {
        if (this.scheduleDOM?.tableBody) {
            this.scheduleDOM.tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading schedules...</td></tr>';
        }
    }

    renderPagination(totalSchedules) {
        const container = this.scheduleDOM?.pagination;
        if (!container) return;

        const totalPages = Math.ceil(totalSchedules / this.schedulePagination.itemsPerPage);
        if (totalPages <= 1) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        const start = ((this.schedulePagination.currentPage - 1) * this.schedulePagination.itemsPerPage) + 1;
        const end = Math.min(this.schedulePagination.currentPage * this.schedulePagination.itemsPerPage, totalSchedules);

        const info = `<div class="pagination-info">
            Showing ${start} to ${end} of ${totalSchedules} schedules
        </div>`;
        const controls = this.createPaginationControls(totalPages);

        container.innerHTML = info + controls;
        container.classList.remove('hidden');
        container.style.display = '';
        this.bindPaginationEvents();
    }

    createPaginationControls(totalPages) {
        let controls = '<div class="pagination-controls">';

        controls += `<button class="pagination-btn" ${this.schedulePagination.currentPage === 1 ? 'disabled' : ''} data-page="${this.schedulePagination.currentPage - 1}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
        </button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.schedulePagination.currentPage - 1 && i <= this.schedulePagination.currentPage + 1)) {
                controls += `<button class="pagination-btn ${i === this.schedulePagination.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === this.schedulePagination.currentPage - 2 || i === this.schedulePagination.currentPage + 2) {
                controls += '<span class="pagination-btn" disabled>...</span>';
            }
        }

        controls += `<button class="pagination-btn" ${this.schedulePagination.currentPage === totalPages ? 'disabled' : ''} data-page="${this.schedulePagination.currentPage + 1}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"></polyline>
            </svg>
        </button>`;

        controls += '</div>';
        return controls;
    }

    bindPaginationEvents() {
        document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                if (!page || page === this.schedulePagination.currentPage || page < 1) return;
                this.schedulePagination.currentPage = page;
                this.renderScheduleTable();
            });
        });
    }

    // =========================================
    // VIEW SWITCHING
    // =========================================

    switchScheduleView(view) {
        this.scheduleCurrentView = view;

        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        const tableView = document.getElementById('schedule-table-view');
        const calendarView = document.getElementById('schedule-calendar-view');
        let chartContainer = document.getElementById('chart-placeholder');
        const paginationContainer = this.scheduleDOM?.pagination;

        if (tableView) tableView.classList.add('hidden');
        if (calendarView) calendarView.classList.add('hidden');
        if (chartContainer) chartContainer.style.display = 'none';
        if (paginationContainer) paginationContainer.classList.toggle('hidden', view !== 'table');

        if (view === 'table') {
            if (tableView) tableView.classList.remove('hidden');
            this.renderScheduleTable();
        } else if (view === 'calendar') {
            if (calendarView) calendarView.classList.remove('hidden');
            this.renderCalendarView();
        } else if (view === 'chart') {
            this.renderChartView();
        }
    }

    // =========================================
    // CHART VIEW (Gantt + Stats)
    // =========================================

    renderChartView() {
        const tableView = document.getElementById('schedule-table-view');
        const calendarView = document.getElementById('schedule-calendar-view');

        if (tableView) tableView.classList.add('hidden');
        if (calendarView) calendarView.classList.add('hidden');

        let chartContainer = document.getElementById('chart-placeholder');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'chart-placeholder';
            chartContainer.dataset.component = 'GanttChart';
            const cardBody = document.querySelector('.cardBody');
            if (cardBody) cardBody.appendChild(chartContainer);
        }

        chartContainer.style.display = 'block';

        const dataset = this.filteredSchedules.length ? this.filteredSchedules : this.allSchedules;
        const labLabels = this.scheduleViewer?.getLabLabels?.() || [...new Set(dataset.map(s => s.lab_room).filter(Boolean))];
        const chartLabs = labLabels.length ? labLabels : (dataset[0]?.lab_room ? [dataset[0].lab_room] : []);
        const defaultLab = chartLabs[0] || this.options?.defaultLab || 'Lab 1';

        const chartOptions = {
            schedules: dataset,
            labs: chartLabs,
            defaultLab,
            colorKey: [
                (s) => s.faculty_id && String(s.faculty_id),
                (s) => s.faculty_name || s.full_name
            ],
            onScheduleClick: (schedule) => this.showScheduleDetailModal(schedule)
        };

        if (!this.ganttChartInstance) {
            this.ganttChartInstance = SmartLab.Core.Components.create('GanttChart', chartContainer, chartOptions);
            this.ganttChartInstance?.init?.();
        } else {
            this.ganttChartInstance.updateLabs?.(chartLabs);
            this.ganttChartInstance.updateSchedules(dataset);
            this.ganttChartInstance.setLab?.(defaultLab);
        }
    }

    // =========================================
    // CALENDAR VIEW
    // =========================================

    renderCalendarView() {
        const grid = this.scheduleDOM?.calendarGrid;
        if (!grid) return;

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        const today = new Date();

        if (this.scheduleDOM?.calendarLabel) {
            this.scheduleDOM.calendarLabel.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
        }

        this._buildLabColorMap();

        const JS_DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const recurringByDay = {};
        const oneTimeByDate = {};

        for (const sched of this.filteredSchedules) {
            if (sched.schedule_date) {
                const dateKey = String(sched.schedule_date).slice(0, 10);
                if (!oneTimeByDate[dateKey]) oneTimeByDate[dateKey] = [];
                oneTimeByDate[dateKey].push(sched);
            } else {
                const dayKey = this._normalizeDayName((sched.day_of_week || '').toUpperCase());
                if (!recurringByDay[dayKey]) recurringByDay[dayKey] = [];
                recurringByDay[dayKey].push(sched);
            }
        }

        const sortByTime = arr => arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || ''));
        Object.values(recurringByDay).forEach(sortByTime);
        Object.values(oneTimeByDate).forEach(sortByTime);

        const getSchedulesForDate = (dateObj) => {
            const dayName = JS_DAY_NAMES[dateObj.getDay()];
            const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const recurring = recurringByDay[dayName] || [];
            const oneTime = oneTimeByDate[dateKey] || [];
            return [...recurring, ...oneTime].sort((a, b) => (a.time_start || '').localeCompare(b.time_start || ''));
        };

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const cells = [];
        const MAX_PILLS = 3;

        for (let i = firstDayIndex - 1; i >= 0; i--) {
            cells.push(this._calDayCellHTML(prevMonthDays - i, true, false, []));
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const isToday = dateObj.toDateString() === today.toDateString();
            const daySchedules = getSchedulesForDate(dateObj);
            cells.push(this._calDayCellHTML(day, false, isToday, daySchedules, MAX_PILLS, dateObj));
        }

        const remainder = cells.length % 7;
        if (remainder > 0) {
            for (let i = 1; i <= 7 - remainder; i++) {
                cells.push(this._calDayCellHTML(i, true, false, []));
            }
        }

        grid.innerHTML = cells.join('');
        grid.onclick = (event) => {
            const cell = event.target.closest('.cal-day-cell:not(.outside)');
            if (!cell) return;
            const day = Number(cell.dataset.day);
            if (!day) return;
            const selectedDate = new Date(year, month, day);
            const daySchedules = getSchedulesForDate(selectedDate);
            this._showDayDetailModal(selectedDate, daySchedules);
        };
    }

    _normalizeDayName(day) {
        const map = {
            'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY',
            'THU': 'THURSDAY', 'FRI': 'FRIDAY', 'SAT': 'SATURDAY', 'SUN': 'SUNDAY'
        };
        return map[day] || day;
    }

    _buildLabColorMap() {
        const labs = [...new Set(this.allSchedules.map(s => s.lab_room).filter(Boolean))].sort();
        this._labColorMap = {};
        labs.forEach((lab, index) => {
            this._labColorMap[lab] = this.labColors[index % this.labColors.length];
        });
    }

    _calDayCellHTML(dayNum, isOutside, isToday, schedules, maxPills = 3, dateObj = null) {
        const classes = ['cal-day-cell'];
        if (isOutside) classes.push('outside');
        if (isToday) classes.push('today');

        let inner = `<div class="cal-day-number">${dayNum}</div>`;

        if (!isOutside && schedules.length > 0) {
            inner += '<div class="cal-schedule-dots">';
            schedules.slice(0, maxPills).forEach((sched) => {
                const bg = this._labColorMap[sched.lab_room] || '#6b7280';
                const title = `${this.escapeHtml(sched.subject || 'Class')} — ${SmartLab.Core.Utils.formatTimeRange(sched.time_start, sched.time_end)}`;
                inner += `<div class="cal-schedule-pill" style="background:${bg}" title="${title}">${this.escapeHtml(sched.subject || 'Class')}</div>`;
            });
            if (schedules.length > maxPills) {
                inner += `<div class="cal-more-label">+${schedules.length - maxPills} more</div>`;
            }
            inner += '</div>';
        }

        const dataAttr = isOutside ? '' : ` data-day="${dayNum}" data-date="${dateObj?.toISOString().slice(0,10)}"`;
        return `<div class="${classes.join(' ')}"${dataAttr}>${inner}</div>`;
    }

    _showDayDetailModal(dateObj, schedules) {
        this._hideDayDetailModal();

        const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

        let bodyContent = '';
        if (!schedules.length) {
            bodyContent = `<div class="cal-no-schedules">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin-bottom:0.5rem">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <div>No schedules on this day</div>
            </div>`;
        } else {
            bodyContent = schedules.map((sched) => {
                const color = this._labColorMap[sched.lab_room] || '#6b7280';
                const isOneTime = !!sched.schedule_date;
                const badge = isOneTime
                    ? '<span style="font-size:0.7rem;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:500;">One-time</span>'
                    : '<span style="font-size:0.7rem;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;font-weight:500;">Recurring</span>';
                return `<div class="cal-sched-card" style="border-left-color:${color}">
                    <div class="cal-sched-subject">${this.escapeHtml(sched.subject || 'Untitled')} ${badge}</div>
                    <div class="cal-sched-meta">
                        <span>🕐 ${SmartLab.Core.Utils.formatTimeRange(sched.time_start, sched.time_end)}</span>
                        <span>📍 ${this.escapeHtml(sched.lab_room || '—')}</span>
                        <span>👤 ${this.escapeHtml(sched.faculty_name || sched.full_name || '—')}</span>
                        ${sched.program ? `<span>📚 ${this.escapeHtml(sched.program)}${sched.year_level ? ' — Year ' + sched.year_level : ''}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        const overlay = document.createElement('div');
        overlay.className = 'cal-day-modal-overlay';
        overlay.id = 'cal-day-modal-overlay';
        overlay.innerHTML = `
            <div class="cal-day-modal">
                <div class="cal-day-modal-header">
                    <h4>${this.escapeHtml(dayLabel)} <span style="font-weight:400;color:#9ca3af;font-size:0.85rem">(${schedules.length} schedule${schedules.length !== 1 ? 's' : ''})</span></h4>
                    <button class="cal-day-modal-close" title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="cal-day-modal-body">${bodyContent}</div>
            </div>`;

        document.querySelector('.schedule-page')?.appendChild(overlay);
        overlay.querySelector('.cal-day-modal-close')?.addEventListener('click', () => this._hideDayDetailModal());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this._hideDayDetailModal(); });
        this._calModalEscHandler = (e) => {
            if (e.key === 'Escape') this._hideDayDetailModal();
        };
        document.addEventListener('keydown', this._calModalEscHandler);
    }

    _hideDayDetailModal() {
        const existing = document.getElementById('cal-day-modal-overlay');
        if (existing) existing.remove();
        if (this._calModalEscHandler) {
            document.removeEventListener('keydown', this._calModalEscHandler);
            this._calModalEscHandler = null;
        }
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
    window.facultyApp = new FacultyApp();
});
