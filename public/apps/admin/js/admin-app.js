/**
 * SmartLab Admin Application
 * Modern SPA with component-based architecture
 */

class AdminApp {
    static async ensureModalManager() {
        if (typeof ModalManager !== 'undefined') return;

        if (!AdminApp._modalManagerPromise) {
            AdminApp._modalManagerPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-modal-manager]');
                if (existing) {
                    if (existing.dataset.loaded === 'true') {
                        resolve();
                        return;
                    }
                    existing.addEventListener('load', () => {
                        existing.dataset.loaded = 'true';
                        resolve();
                    }, { once: true });
                    existing.addEventListener('error', reject, { once: true });
                    return;
                }

                const script = document.createElement('script');
                script.src = '/apps/admin/js/modal-manager.js';
                script.async = false;
                script.dataset.modalManager = 'true';
                script.addEventListener('load', () => {
                    script.dataset.loaded = 'true';
                    resolve();
                }, { once: true });
                script.addEventListener('error', reject, { once: true });
                document.head.appendChild(script);
            });
        }

        try {
            await AdminApp._modalManagerPromise;
        } catch (error) {
            console.error('AdminApp: Failed to load ModalManager', error);
        }
    }

    static getInstance() {
        return window.SmartLab?.Admin || null;
    }

    static navigateToPage(page) {
        const instance = AdminApp.getInstance();
        if (instance && typeof instance.navigateTo === 'function') {
            instance.navigateTo(page);
        } else {
            window.location.hash = page;
        }
    }

    static async showAddUserModal() {
        await AdminApp.ensureModalManager();
        if (typeof ModalManager === 'undefined') {
            SmartLab?.Core?.UI?.showToast?.('User modal is not available yet', 'error');
            return;
        }

        try {
            await ModalManager.show('add-user', {
                onSuccess: () => {
                    const dashboard = window.SmartLab?.AdminDashboard;
                    dashboard?.updateDashboardCounts?.();
                    dashboard?.loadRecentActivity?.();
                }
            });
        } catch (error) {
            console.error('AdminApp: Failed to open add user modal', error);
            SmartLab?.Core?.UI?.showToast?.('Unable to open Add User modal', 'error');
        }
    }

    static openPendingRequests() {
        const preset = { status: 'Pending' };
        window.__SmartLabRequestsPreset = preset;
        try {
            sessionStorage.setItem('smartlab:requestsFilter', JSON.stringify(preset));
        } catch (error) {
            console.warn('AdminApp: Unable to cache requests filter', error);
        }
        AdminApp.navigateToPage('requests');
    }

    static async showAddScheduleModal() {
        await AdminApp.ensureModalManager();
        if (typeof ModalManager === 'undefined') {
            SmartLab?.Core?.UI?.showToast?.('Schedule modal is not available yet', 'error');
            return;
        }

        try {
            await ModalManager.show('add-schedule', {
                onSuccess: async () => {
                    const dashboard = window.SmartLab?.AdminDashboard;
                    dashboard?.updateDashboardCounts?.();
                    dashboard?.loadRecentActivity?.();
                    // If schedule page is currently mounted, refresh it too
                    await window.adminSchedulePage?.viewer?.reload?.();
                }
            });
        } catch (error) {
            console.error('AdminApp: Failed to open add schedule modal', error);
            SmartLab?.Core?.UI?.showToast?.('Unable to open Add Schedule modal', 'error');
        }
    }

    constructor() {
        this.currentPage = 'dashboard';
        this.components = {};
        this.routes = {};
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        try {
            // Show admin container immediately to avoid loading screen stuck
            const adminContainer = document.getElementById('admin-container');
            const loadingScreen = document.getElementById('loading-screen');
            
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            if (adminContainer) {
                adminContainer.style.display = 'block';
            }
            
            // Load components (don't let this block the app)
            try {
                await this.loadComponents();
            } catch (componentError) {
                // Create basic fallback UI if components fail
                this.createFallbackUI();
                
                // Load user profile information (call after fallback UI is created)
                this.loadUserProfile();
            }
            
            // Setup routing
            this.setupRouting();
            
            // Setup navigation
            this.setupNavigation();
            
            // Setup profile dropdown
            this.setupProfileDropdown();
            
            // Initialize SmartLab Core logout functionality
            if (window.SmartLab && window.SmartLab.Core && window.SmartLab.Core.Auth) {
                window.SmartLab.Core.Auth.setupLogout();
            }
            
            // Load initial page
            try {
                await this.loadPage(this.getCurrentPageFromURL());
            } catch (pageError) {
                // Load dashboard as fallback
                await this.loadPage('dashboard');
            }
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            // Load user profile information
            this.loadUserProfile();
            
            // Retry profile dropdown setup after a delay (in case components loaded late)
            setTimeout(() => {
                this.setupProfileDropdown();
            }, 1000);
            
            // Initialize notification manager (bell icon + dropdown)
            if (typeof NotificationManager !== 'undefined') {
                this.notificationManager = new NotificationManager();
            }
            
        } catch (error) {
            console.error('Failed to initialize admin app:', error);
            this.showError('Failed to load admin panel');
        }
    }

    createFallbackUI() {
        // Create basic sidebar if it failed to load
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer && !sidebarContainer.innerHTML.trim()) {
            sidebarContainer.innerHTML = `
                <div class="sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <div class="logo">
                            <img src="../../../images/PUPLogo.png" alt="SmartLab Logo">
                            <div class="sidebar-text">
                                <h2>smartlab.</h2>
                                <p>Admin Portal</p>
                            </div>
                        </div>
                    </div>
                    <div class="academic-context-sidebar" id="ac-option-a">
                        <div class="ac-label" id="ac-a-text">Loading...</div>
                    </div>
                    <nav class="navList">
                        <button class="nav-item active" data-page="dashboard">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            <span>Dashboard</span>
                        </button>
                        <button class="nav-item" data-page="users">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span>Manage Accounts</span>
                        </button>
                        <button class="nav-item" data-page="schedule">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>Lab Schedule</span>
                        </button>
                        <button class="nav-item" data-page="requests">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            <span>Requests</span>
                        </button>
                        <button class="nav-item" data-page="equipment">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                            <span>Equipments</span>
                        </button>
                        <button class="nav-item" data-page="reports">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                            <span>Reports</span>
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
                        <div class="profile-badge">Admin</div>
                    </div>
                    <div class="profile-dropdown-menu">
                        <button class="profile-menu-item" id="profile-signout-btn" data-action="logout">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Create basic header if it failed to load
        const headerContainer = document.getElementById('header-container');
        if (headerContainer && !headerContainer.innerHTML.trim()) {
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
                            <span class="breadcrumb-item current-page" id="current-page">Dashboard</span>
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
        
    }

    loadUserProfile() {
        try {
            // Get user information from sessionStorage (set during login)
            const userEmail = sessionStorage.getItem('gmail') || 'Admin User';
            const userRole = sessionStorage.getItem('role') || 'Admin';
            const userId = sessionStorage.getItem('user_id') || '';
            
            // Update profile email in sidebar
            const profileEmailElements = document.querySelectorAll('#profile-email, #dropdown-profile-email');
            profileEmailElements.forEach(element => {
                if (element) {
                    element.textContent = userEmail;
                }
            });
            
            // Update user name in header if exists
            const userFullNameElement = document.getElementById('user-fullname');
            if (userFullNameElement) {
                // Extract name from email or use default
                const displayName = userEmail.includes('@') ? userEmail.split('@')[0] : userEmail;
                userFullNameElement.textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            }
            
            // Update user info in header academic context if exists
            this.updateAcademicContext();
            
        } catch (error) {
            // Fallback to default values
            const profileEmailElements = document.querySelectorAll('#profile-email, #dropdown-profile-email');
            profileEmailElements.forEach(element => {
                if (element) {
                    element.textContent = 'Admin User';
                }
            });
        }
    }

    async updateAcademicContext() {
        let text = 'AY 2025-2026 | 1st Semester';
        try {
            const res = await fetch('/api/activeAcademicContext', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                text = `AY ${data.academic_year || '2025-2026'} | ${data.term || '1st Semester'}`;
            }
        } catch (error) {
        }

        const el = document.getElementById('ac-a-text');
        if (el) el.textContent = text;
    }

    async loadComponents() {
        try {
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Component loading timeout')), 5000)
            );
            
            // Load sidebar with timeout
            try {
                const sidebarResponse = await Promise.race([
                    fetch('components/sidebar.html'),
                    timeoutPromise
                ]);
                this.components.sidebar = await sidebarResponse.text();
                const sidebarContainer = document.getElementById('sidebar-container');
                if (sidebarContainer) {
                    sidebarContainer.innerHTML = this.components.sidebar;
                }
            } catch (error) {
            }
            
            // Load header with timeout
            try {
                const headerResponse = await Promise.race([
                    fetch('components/header.html'),
                    timeoutPromise
                ]);
                this.components.header = await headerResponse.text();
                const headerContainer = document.getElementById('header-container');
                if (headerContainer) {
                    headerContainer.innerHTML = this.components.header;
                }
            } catch (error) {
            }
            
            // Note: footer-container doesn't exist in admin.html, so we skip it
            
            // Initialize shared components
            this.initializeSharedComponents();
            
            // Load user profile information (call after components are loaded)
            this.loadUserProfile();
            
        } catch (error) {
            console.error('Failed to load components:', error);
            throw error;
        }
    }
    
    initializeSharedComponents() {
        // Initialize form validators
        document.querySelectorAll('form[data-validate]').forEach(form => {
            SmartLab.Core.Components.create('FormValidator', form);
        });
        
        // Initialize print reports
        document.querySelectorAll('[data-print]').forEach(element => {
            SmartLab.Core.Components.create('PrintReports', element);
        });
        
        // Initialize gantt charts
        document.querySelectorAll('[data-component="GanttChart"]').forEach(element => {
            SmartLab.Core.Components.create('GanttChart', element);
        });
    }

    setupRouting() {
        this.routes = {
            dashboard: {
                url: 'pages/dashboard.html',
                title: 'Dashboard',
                scripts: ['/shared/js/components/AcademicContextFilter.js', 'js/dashboard.js']
            },
            users: {
                url: 'pages/users.html',
                title: 'Users Management',
                scripts: ['js/users-page.js']
            },
            equipment: {
                url: 'pages/equipment.html',
                title: 'Equipment',
                scripts: ['js/equipment.js']
            },
            'academic-directory': {
                url: 'pages/academic-directory.html',
                title: 'Academic Directory',
                scripts: ['js/academic-directory.js']
            },
            requests: {
                url: 'pages/requests.html',
                title: 'Requests',
                scripts: ['/shared/js/components/AcademicContextFilter.js', 'js/requests.js']
            },
            schedule: {
                url: 'pages/schedule.html',
                title: 'Schedule',
                scripts: ['/shared/js/components/ScheduleViewer.js', '/shared/js/components/AcademicContextFilter.js', 'js/schedule-page.js']
            },
            reports: {
                url: 'pages/reports.html',
                title: 'Reports',
                scripts: ['/shared/js/components/AcademicContextFilter.js', 'js/reports.js']
            },
            profile: {
                url: '/shared/pages/profile.html',
                title: 'Profile Settings',
                scripts: ['/shared/js/pages/ProfileSettings.js']
            },
            'admin-settings': {
                url: 'pages/admin-settings.html',
                title: 'Admin Settings',
                scripts: ['js/pages/AdminSettings.js']
            }
        };
    }

    setupProfileDropdown() {
        const profileTrigger = document.getElementById('profile-trigger');
        const profileDropdown = document.getElementById('profile-dropdown');
        const signoutBtn = document.getElementById('profile-signout-btn');
        
        if (profileTrigger && profileDropdown) {
            // Remove any existing listeners to prevent duplicates
            profileTrigger.removeEventListener('click', this.handleProfileClick);
            
            // Create handler function
            this.handleProfileClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const isHidden = profileDropdown.classList.contains('hidden');
                if (isHidden) {
                    profileDropdown.classList.remove('hidden');
                } else {
                    profileDropdown.classList.add('hidden');
                }
            };
            
            // Add click listener
            profileTrigger.addEventListener('click', this.handleProfileClick);
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileDropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
                    profileDropdown.classList.add('hidden');
                }
            });
            
        }
        
        // Profile Settings & Change Password buttons → navigate to profile page
        const profileSettingsBtn = document.getElementById('profile-settings-btn');
        const changePasswordBtn = document.getElementById('change-password-btn');

        if (profileSettingsBtn) {
            profileSettingsBtn.addEventListener('click', () => {
                if (profileDropdown) profileDropdown.classList.add('hidden');
                this.navigateTo('profile');
            });
        }
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                if (profileDropdown) profileDropdown.classList.add('hidden');
                this.navigateTo('profile');
            });
        }

        // Admin Settings button → navigate to admin-settings page
        const adminSettingsBtn = document.getElementById('admin-settings-btn');
        if (adminSettingsBtn) {
            adminSettingsBtn.addEventListener('click', () => {
                if (profileDropdown) profileDropdown.classList.add('hidden');
                this.navigateTo('admin-settings');
            });
        }

    }

    logout() {
        // Use the existing SmartLab Core logout function
        if (window.SmartLab && window.SmartLab.Core && window.SmartLab.Core.Auth) {
            window.SmartLab.Core.Auth.logout();
        } else {
            // Fallback logout if SmartLab Core is not available
            sessionStorage.clear();
            window.location.href = "/index.html";
        }
    }

    setupNavigation() {
        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('[data-page]');
            if (navItem) {
                e.preventDefault();
                const page = navItem.dataset.page;
                this.navigateTo(page);
            }
        });
        
        // Handle sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                const header = document.querySelector('.admin-header');
                const container = document.querySelector('.admin-container');
                if (sidebar) sidebar.classList.toggle('collapsed');
                if (header) header.classList.toggle('sidebar-collapsed');
                if (container) container.classList.toggle('sidebar-collapsed');
            });
        }
        
        // Setup profile dropdown
        this.setupProfileDropdown();
    }

    async navigateTo(page) {
        if (!this.routes[page]) {
            console.error(`Page "${page}" not found`);
            return;
        }
        
        try {
            await this.loadPage(page);
        } catch (error) {
            console.error(`Navigation to "${page}" failed:`, error);
            SmartLab.Core.UI.showToast('Failed to load page', 'error');
        }
    }

    updateActiveNavigation(page) {
        // Update nav items
        document.querySelectorAll('[data-page]').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-page="${page}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    async loadPage(page) {
        const route = this.routes[page];
        
        try {
            // Always update sidebar highlight + breadcrumb + URL
            this.updateActiveNavigation(page);
            const breadcrumb = document.getElementById('current-page');
            if (breadcrumb) breadcrumb.textContent = route?.title || page;
            this.currentPage = page;
            this.updateURL(page);

            // Show loading
            this.showPageLoading();
            
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Page loading timeout')), 5000)
            );
            
            // Load page HTML with timeout
            const response = await Promise.race([
                fetch(route.url),
                timeoutPromise
            ]);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${page}`);
            }
            
            const content = await response.text();
            
            // Update content area - use page-content instead of main-content
            const pageContent = document.getElementById('page-content');
            if (pageContent) {
                pageContent.innerHTML = content;
            } else {
                throw new Error('Page content container not found');
            }
            
            // Load page-specific scripts (with timeout)
            if (route.scripts && route.scripts.length > 0) {
                try {
                    await this.loadPageScripts(route.scripts);
                } catch (scriptError) {
                }
            }
            
            // Initialize page
            await this.initializePage(page);
            
        } catch (error) {
            console.error(`Failed to load page ${page}:`, error);
            
            // Show fallback content
            const pageContent = document.getElementById('page-content');
            if (pageContent) {
                pageContent.innerHTML = `
                    <div class="dashboard-content">
                        <h2>${route?.title || 'Page'}</h2>
                        <p>Loading this page failed. Please try refreshing or contact support.</p>
                        <button onclick="location.reload()">Refresh Page</button>
                    </div>
                `;
            }
        } finally {
            this.hidePageLoading();
        }
    }

    async loadPageScripts(scripts) {
        for (const script of scripts) {
            try {
                await this.loadScript(script);
            } catch (error) {
                console.warn(`Failed to load script ${script}:`, error);
            }
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async initializePage(page) {
        // Page-specific initialization
        switch (page) {
            case 'users':
                // Initialize UsersPageManager for the users page
                if (typeof UsersPageManager !== 'undefined') {
                    new UsersPageManager();
                } else if (typeof initializeUsersPage !== 'undefined') {
                    initializeUsersPage();
                } else {
                    // Try to load the script manually if not available
                    try {
                        await this.loadScript('js/users-page.js');
                        if (typeof UsersPageManager !== 'undefined') {
                            new UsersPageManager();
                        } else if (typeof initializeUsersPage !== 'undefined') {
                            initializeUsersPage();
                        }
                    } catch (error) {
                        console.error('Failed to load users-page.js:', error);
                    }
                }
                break;
            
            case 'dashboard':
                // Initialize dashboard-specific functionality
                if (typeof window.initDashboard === 'function') {
                    window.initDashboard();
                } else if (typeof DashboardManager !== 'undefined') {
                    new DashboardManager();
                }
                break;
            
            case 'equipment':
                // Initialize equipment-specific functionality
                if (typeof EquipmentManager !== 'undefined') {
                    new EquipmentManager();
                }
                break;

            case 'academic-directory':
                if (typeof window.initAcademicDirectoryPage === 'function') {
                    window.initAcademicDirectoryPage();
                }
                break;
            
            case 'requests':
                // Initialize requests-specific functionality
                if (typeof RequestsManager !== 'undefined') {
                    new RequestsManager();
                }
                break;
            
            case 'schedule':
                // Initialize schedule-specific functionality
                if (typeof window.initAdminSchedulePage === 'function') {
                    window.initAdminSchedulePage();
                } else if (typeof ScheduleManager !== 'undefined') {
                    window.scheduleManager = new ScheduleManager();
                    window.scheduleManager.init();
                }
                break;
            
            case 'reports':
                // Initialize reports-specific functionality
                if (typeof window.initReports === 'function') {
                    window.initReports();
                } else if (typeof ReportsManager !== 'undefined') {
                    new ReportsManager();
                }
                break;
            
            case 'profile':
                if (typeof ProfileSettings !== 'undefined') {
                    new ProfileSettings();
                }
                break;

            case 'admin-settings':
                if (typeof AdminSettings !== 'undefined') {
                    new AdminSettings();
                }
                break;

        }
    }

    getCurrentPageFromURL() {
        const hash = window.location.hash.slice(1);
        return this.routes[hash] ? hash : 'dashboard';
    }

    updateURL(page) {
        window.location.hash = page;
    }

    showLoading() {
        this.isLoading = true;
        document.body.classList.add('loading');
    }

    hideLoading() {
        this.isLoading = false;
        document.body.classList.remove('loading');
    }

    showPageLoading() {
        const content = document.getElementById('page-content');
        if (content) {
            content.innerHTML = '<div class="loading-spinner">Loading...</div>';
        }
    }

    hidePageLoading() {
        // Loading will be hidden when content is loaded
    }

    showError(message) {
        const content = document.getElementById('page-content');
        if (content) {
            content.innerHTML = `
                <div class="error-message">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()">Reload</button>
                </div>
            `;
        }
    }

    setupGlobalEvents() {
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            const page = this.getCurrentPageFromURL();
            this.loadPage(page);
        });
        
        // Handle logout
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="logout"]')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    async logout() {
        try {
            await SmartLab.Core.API.post('/api/logout');
            SmartLab.Core.Auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if API call fails
            SmartLab.Core.Auth.logout();
        }
    }
}

// Initialize admin app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    if (!SmartLab.Core.Auth.guardRole('Admin')) {
        return;
    }
    
    // Initialize admin app
    window.SmartLab.Admin = new AdminApp();
});

// Register app with SmartLab Core
SmartLab.Core.registerApp('admin', AdminApp);
