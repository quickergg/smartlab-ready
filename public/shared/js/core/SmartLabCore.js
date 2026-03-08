/* =========================================
   SmartLab - Core Framework
   Base functionality for all SmartLab applications
========================================= */

window.SmartLab = window.SmartLab || {};

class SmartLabCore {
    constructor() {
        this.version = '2.0.0';
        this.apps = new Map();
        this.components = new Map();
        this.plugins = new Map();
        
        // Initialize core utilities
        this.initUtils();
        this.initAuth();
        this.initAPI();
        this.initUI();
        this.initComponents();
        this.initEvents();
        
        console.log(`SmartLab Core v${this.version} initialized`);
    }
    
    // 🔧 Utility Functions
    initUtils() {
        this.Utils = {
            // String utilities
            escapeHtml: (val) => {
                return String(val ?? "")
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")
                    .replaceAll('"', "&quot;")
                    .replaceAll("'", "&#039;");
            },
            
            formatDate: (date) => {
                if (!date) return '-';
                const d = new Date(date);
                if (isNaN(d)) return '-';
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
            },
            
            formatDateTime: (date) => {
                if (!date) return '-';
                const d = new Date(date);
                if (isNaN(d)) return '-';
                return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
            },

            formatTime: (timeStr) => {
                if (!timeStr) return '-';
                const [h, m] = String(timeStr).split(':');
                const hour = parseInt(h, 10);
                if (isNaN(hour)) return '-';
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const h12 = hour % 12 || 12;
                return `${h12}:${(m || '00').padStart(2, '0')} ${ampm}`;
            },

            formatTimeRange: (start, end) => {
                const s = SmartLab.Core.Utils.formatTime(start);
                const e = SmartLab.Core.Utils.formatTime(end);
                if (s === '-') return '-';
                return e !== '-' ? `${s} - ${e}` : s;
            },
            
            // Safe JSON parsing
            safeJson: async (response) => {
                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch {
                    return { message: text || "Unexpected server response" };
                }
            },
            
            // Debounce function
            debounce: (func, wait) => {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },
            
            // Throttle function
            throttle: (func, limit) => {
                let inThrottle;
                return function() {
                    const args = arguments;
                    const context = this;
                    if (!inThrottle) {
                        func.apply(context, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            // Generate unique ID
            generateId: (prefix = 'id') => {
                return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            },
            
            // Copy to clipboard
            copyToClipboard: async (text) => {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        return true;
                    } catch (err) {
                        document.body.removeChild(textArea);
                        return false;
                    }
                }
            }
        };
    }
    
    // 🔐 Authentication System
    initAuth() {
        this._tokenCheckInterval = null;

        this.Auth = {
            // Decode JWT payload without verifying signature (client-side only)
            _decodeToken: (token) => {
                try {
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    return JSON.parse(atob(base64));
                } catch { return null; }
            },

            // Check if the stored JWT is expired
            isTokenExpired: () => {
                const token = sessionStorage.getItem("token");
                if (!token) return true;
                const payload = this.Auth._decodeToken(token);
                if (!payload || !payload.exp) return true;
                // exp is in seconds; add 10s grace period
                return Date.now() >= (payload.exp * 1000) - 10000;
            },

            // Guard page by role AND valid token
            guardRole: (role) => {
                const token = sessionStorage.getItem("token");
                const currentRole = sessionStorage.getItem("role");

                if (!token || !currentRole || currentRole !== role || this.Auth.isTokenExpired()) {
                    this.Auth._redirectExpired();
                    return false;
                }

                // Start periodic expiry monitor
                this.Auth._startTokenMonitor();
                return true;
            },
            
            // Check if user is authenticated (token exists and not expired)
            isAuthenticated: () => {
                return !!sessionStorage.getItem("token") && !this.Auth.isTokenExpired();
            },
            
            // Get JWT token
            getToken: () => {
                return sessionStorage.getItem("token");
            },
            
            // Get current user info
            getCurrentUser: () => {
                return {
                    id: sessionStorage.getItem("user_id"),
                    email: sessionStorage.getItem("gmail"),
                    role: sessionStorage.getItem("role"),
                    fullName: sessionStorage.getItem("full_name")
                };
            },
            
            // Set user info
            setUser: (userData) => {
                sessionStorage.setItem("user_id", userData.user_id);
                sessionStorage.setItem("gmail", userData.gmail);
                sessionStorage.setItem("role", userData.role_name);
                sessionStorage.setItem("full_name", userData.full_name || userData.gmail);
            },
            
            // Clear authentication
            logout: () => {
                this.Auth._stopTokenMonitor();
                sessionStorage.clear();
                window.location.href = "/index.html";
            },
            
            // Handle 401 responses (expired/invalid token)
            handleUnauthorized: () => {
                this.Auth._stopTokenMonitor();
                this.Auth._redirectExpired();
            },
            
            // Get auth headers for direct fetch calls
            getAuthHeaders: () => {
                const token = sessionStorage.getItem("token");
                return token ? { 'Authorization': `Bearer ${token}` } : {};
            },
            
            // Setup logout buttons
            setupLogout: () => {
                const logoutBtns = document.querySelectorAll('[data-action="logout"]');
                logoutBtns.forEach(btn => {
                    btn.addEventListener('click', () => this.Auth.logout());
                });
            },

            // Redirect to login with expired-session flag
            _redirectExpired: () => {
                this.Auth._stopTokenMonitor();
                sessionStorage.clear();
                window.location.href = "/index.html?session=expired";
            },

            // Periodically check token expiry (every 60s)
            _startTokenMonitor: () => {
                if (this._tokenCheckInterval) return;
                this._tokenCheckInterval = setInterval(() => {
                    if (this.Auth.isTokenExpired()) {
                        this.Auth._redirectExpired();
                    }
                }, 60000);
            },

            _stopTokenMonitor: () => {
                if (this._tokenCheckInterval) {
                    clearInterval(this._tokenCheckInterval);
                    this._tokenCheckInterval = null;
                }
            }
        };
    }
    
    // 🌐 API System
    initAPI() {
        this.API = {
            // Base fetch wrapper (auto-injects JWT Authorization header)
            fetch: async (url, options = {}) => {
                const token = this.Auth.getToken();
                const defaultHeaders = {
                    'Content-Type': 'application/json',
                };
                if (token) {
                    defaultHeaders['Authorization'] = `Bearer ${token}`;
                }
                
                const finalOptions = {
                    ...options,
                    headers: {
                        ...defaultHeaders,
                        ...(options.headers || {}),
                    },
                };
                
                try {
                    const response = await fetch(url, finalOptions);
                    
                    // Handle expired/invalid token globally
                    if (response.status === 401) {
                        this.Auth.handleUnauthorized();
                        return response;
                    }
                    
                    if (!response.ok) {
                        const error = await this.Utils.safeJson(response);
                        throw new Error(error.message || `HTTP ${response.status}`);
                    }
                    
                    return response;
                } catch (error) {
                    console.error('API Error:', error);
                    throw error;
                }
            },
            
            // GET request
            get: async (url) => {
                const response = await this.fetch(url);
                return this.Utils.safeJson(response);
            },
            
            // POST request
            post: async (url, data) => {
                const response = await this.fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                return this.Utils.safeJson(response);
            },
            
            // PUT request
            put: async (url, data) => {
                const response = await this.fetch(url, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                return this.Utils.safeJson(response);
            },
            
            // DELETE request
            delete: async (url) => {
                const response = await this.fetch(url, {
                    method: 'DELETE',
                });
                return this.Utils.safeJson(response);
            }
        };
    }
    
    // 🧩 Component System
    initComponents() {
        this.Components = {
            // Register a component
            register: (name, componentClass) => {
                this.components.set(name, componentClass);
            },
            
            // Get a component
            get: (name) => {
                return this.components.get(name);
            },
            
            // Create component instance
            create: (name, element, options = {}) => {
                const ComponentClass = this.components.get(name);
                if (!ComponentClass) {
                    console.error(`Component "${name}" not found`);
                    return null;
                }
                
                return new ComponentClass(element, options);
            },
            
            // Auto-initialize components
            initAll: () => {
                document.querySelectorAll('[data-component]').forEach(element => {
                    const componentName = element.dataset.component;
                    const component = this.Components.create(componentName, element);
                    if (component && component.init) {
                        component.init();
                    }
                });
            }
        };
    }
    
    // 📢 Event System
    initEvents() {
        this.Events = {
            listeners: new Map(),
            
            // Add event listener
            on: (event, callback) => {
                if (!this.listeners.has(event)) {
                    this.listeners.set(event, []);
                }
                this.listeners.get(event).push(callback);
            },
            
            // Remove event listener
            off: (event, callback) => {
                const callbacks = this.listeners.get(event);
                if (callbacks) {
                    const index = callbacks.indexOf(callback);
                    if (index > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            },
            
            // Trigger event
            emit: (event, data = null) => {
                const callbacks = this.listeners.get(event);
                if (callbacks) {
                    callbacks.forEach(callback => callback(data));
                }
            }
        };
    }
    
    // 🎨 UI Utilities
    initUI() {
        this.UI = {
            // Show toast notification
            showToast: (message, type = 'info', duration = 3000) => {
                const icons = {
                    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
                    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
                };

                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.innerHTML = `
                    <span class="toast-icon">${icons[type] || icons.info}</span>
                    <span class="toast-message">${message}</span>
                    <button class="toast-close">&times;</button>
                `;

                let container = document.querySelector('.toast-container');
                if (!container) {
                    container = document.createElement('div');
                    container.className = 'toast-container';
                    document.body.appendChild(container);
                }

                container.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);

                const dismiss = () => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                };

                setTimeout(dismiss, duration);
                toast.querySelector('.toast-close').addEventListener('click', dismiss);
            },
            
            // Show loading state
            showLoading: (element, text = 'Loading...') => {
                if (typeof element === 'string') {
                    element = document.querySelector(element);
                }
                
                if (!element) return;
                
                const originalContent = element.innerHTML;
                element.dataset.originalContent = originalContent;
                element.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <span>${text}</span>
                    </div>
                `;
                element.classList.add('loading');
            },
            
            // Hide loading state
            hideLoading: (element) => {
                if (typeof element === 'string') {
                    element = document.querySelector(element);
                }
                
                if (!element) return;
                
                const originalContent = element.dataset.originalContent;
                if (originalContent) {
                    element.innerHTML = originalContent;
                    delete element.dataset.originalContent;
                }
                element.classList.remove('loading');
            },
            
            // Confirm dialog
            // Usage: await SmartLab.Core.UI.confirm(message, title, options?)
            // options: { type: 'warning'|'danger'|'info'|'success', confirmText, cancelText }
            confirm: async (message, title = 'Confirm', options = {}) => {
                const type = options.type || 'warning';
                const confirmText = options.confirmText || 'Confirm';
                const cancelText  = options.cancelText  || 'Cancel';
                const confirmDisabled = Boolean(options.confirmDisabled);

                const icons = {
                    warning: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                    danger:  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
                    info:    `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
                    success: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>`
                };

                return new Promise((resolve) => {
                    const overlay = document.createElement('div');
                    overlay.className = 'confirm-overlay';
                    overlay.innerHTML = `
                        <div class="confirm-dialog confirm-${type}">
                            <div class="confirm-icon">${icons[type] || icons.warning}</div>
                            <h3 class="confirm-title">${title}</h3>
                            <div class="confirm-message">${message}</div>
                            <div class="confirm-actions">
                                <button class="confirm-btn confirm-btn-cancel" data-action="cancel">${cancelText}</button>
                                <button class="confirm-btn confirm-btn-ok" data-action="confirm">${confirmText}</button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(overlay);
                    requestAnimationFrame(() => overlay.classList.add('show'));

                    const handleAction = (action) => {
                        overlay.classList.remove('show');
                        setTimeout(() => overlay.remove(), 250);
                        resolve(action === 'confirm');
                    };

                    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
                    if (confirmDisabled) {
                        confirmBtn.disabled = true;
                        confirmBtn.setAttribute('aria-disabled', 'true');
                        confirmBtn.classList.add('confirm-btn-disabled');
                    }

                    confirmBtn.addEventListener('click', () => {
                        if (confirmDisabled) return;
                        handleAction('confirm');
                    });
                    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => handleAction('cancel'));

                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) handleAction('cancel');
                    });

                    // Keyboard: Enter to confirm, Escape to cancel
                    const onKey = (e) => {
                        if (e.key === 'Escape') { handleAction('cancel'); document.removeEventListener('keydown', onKey); }
                        if (e.key === 'Enter' && !confirmDisabled)  { handleAction('confirm'); document.removeEventListener('keydown', onKey); }
                    };
                    document.addEventListener('keydown', onKey);
                });
            }
        };
    }
    
    // 🚀 Application Registration
    registerApp(name, appClass) {
        this.apps.set(name, appClass);
        console.log(`App "${name}" registered`);
    }
    
    // 🚀 Initialize Application
    initApp(name, element) {
        const AppClass = this.apps.get(name);
        if (!AppClass) {
            console.error(`App "${name}" not found`);
            return null;
        }
        
        const app = new AppClass(element);
        if (app.init) {
            app.init();
        }
        
        console.log(`App "${name}" initialized`);
        return app;
    }
}

// Initialize SmartLab Core
window.SmartLab.Core = new SmartLabCore();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.SmartLab.Core.Components.initAll();
    window.SmartLab.Core.Auth.setupLogout();
});
