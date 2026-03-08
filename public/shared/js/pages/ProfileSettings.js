/* =========================================
   SmartLab – Profile Settings (Shared)
   Reusable across admin, faculty, student apps
========================================= */

class ProfileSettings {
    constructor() {
        this.userId = sessionStorage.getItem('user_id');
        this.userRole = (sessionStorage.getItem('role') || '').toLowerCase();
        this.profile = null;
        this.departments = [];

        if (!this.userId) {
            console.error('ProfileSettings: No user_id in sessionStorage');
            return;
        }

        this.init();
    }

    async loadDepartments() {
        try {
            const res = await fetch('/api/academic-directory/departments', { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.departments = await res.json();
            this.populateDepartmentSelect();
        } catch (err) {
            console.error('ProfileSettings: Failed to load departments:', err);
            this.departments = [];
        }
    }

    populateDepartmentSelect(selectedId = null) {
        const select = this.$('profile-department');
        if (!select) return;

        select.innerHTML = '';

        if (!this.departments.length) {
            select.innerHTML = '<option value="" disabled>No departments available</option>';
            select.value = '';
            select.disabled = true;
            return;
        }

        select.disabled = false;
        select.innerHTML = '<option value="">Select Department</option>';

        let hasMatch = false;
        this.departments.forEach((dept) => {
            const option = document.createElement('option');
            option.value = dept.department_id;
            option.textContent = dept.department_name;
            if (selectedId && Number(dept.department_id) === Number(selectedId)) {
                option.selected = true;
                hasMatch = true;
            }
            select.appendChild(option);
        });

        if (selectedId && !hasMatch) {
            const orphanOption = document.createElement('option');
            orphanOption.value = selectedId;
            orphanOption.textContent = '(Unavailable Department)';
            orphanOption.selected = true;
            select.appendChild(orphanOption);
        }
    }

    // =========================================
    // Initialization
    // =========================================

    async init() {
        await this.loadDepartments();
        await this.loadProfile();
        this.bindEvents();
    }

    $(id) {
        return document.getElementById(id);
    }

    // =========================================
    // Load Profile Data
    // =========================================

    async loadProfile() {
        try {
            const res = await fetch(`/api/users/${this.userId}`, { headers: SmartLab.Core.Auth.getAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.profile = await res.json();
            this.renderProfile();
        } catch (err) {
            console.error('ProfileSettings: Failed to load profile:', err);
            this.showMessage('Failed to load profile data', 'error');
        }
    }

    renderProfile() {
        const p = this.profile;
        if (!p) return;

        const role = (p.role_name || this.userRole || '').toLowerCase();
        const fullName = p.full_name || p.gmail?.split('@')[0] || 'User';
        const initials = fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        // Header
        const avatar = this.$('profile-avatar-initials');
        if (avatar) avatar.textContent = initials;

        const displayName = this.$('profile-display-name');
        if (displayName) displayName.textContent = fullName;

        const displayEmail = this.$('profile-display-email');
        if (displayEmail) displayEmail.textContent = p.gmail || '';

        const badge = this.$('profile-role-badge');
        if (badge) {
            badge.textContent = (p.role_name || role).charAt(0).toUpperCase() + (p.role_name || role).slice(1);
            badge.className = `role-badge ${role}`;
        }

        // Form fields
        const nameInput = this.$('profile-fullname');
        if (nameInput) nameInput.value = p.full_name || '';

        const gmailInput = this.$('profile-gmail');
        if (gmailInput) gmailInput.value = p.gmail || '';

        // Role-specific fields
        const facultyFields = this.$('profile-faculty-fields');
        const studentFields = this.$('profile-student-fields');

        if (role === 'faculty') {
            if (facultyFields) facultyFields.style.display = '';
            if (studentFields) studentFields.style.display = 'none';
            this.populateDepartmentSelect(p.department_id || null);
        } else if (role === 'student') {
            if (facultyFields) facultyFields.style.display = 'none';
            if (studentFields) studentFields.style.display = '';
            const prog = this.$('profile-program');
            if (prog) prog.value = p.program || '';
            const year = this.$('profile-year-level');
            if (year) year.value = p.year_level || '';
        } else {
            if (facultyFields) facultyFields.style.display = 'none';
            if (studentFields) studentFields.style.display = 'none';
        }
    }

    // =========================================
    // Event Binding
    // =========================================

    bindEvents() {
        // Profile info form
        const infoForm = this.$('profile-info-form');
        if (infoForm) {
            infoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        // Password form
        const pwForm = this.$('profile-password-form');
        if (pwForm) {
            pwForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        // Password strength indicator
        const newPw = this.$('profile-new-password');
        if (newPw) {
            newPw.addEventListener('input', () => this.updatePasswordStrength(newPw.value));
        }
    }

    // =========================================
    // Save Profile
    // =========================================

    async saveProfile() {
        const btn = this.$('profile-save-btn');
        const fullName = (this.$('profile-fullname')?.value || '').trim();

        if (!fullName) {
            this.showMessage('Full name is required', 'error');
            return;
        }

        const body = { full_name: fullName };

        const role = (this.profile?.role_name || this.userRole || '').toLowerCase();
        if (role === 'faculty') {
            const deptValue = this.$('profile-department')?.value || '';
            if (!deptValue) {
                this.showMessage('Please select a department', 'error');
                return;
            }
            body.department_id = parseInt(deptValue, 10);
            if (!Number.isInteger(body.department_id) || body.department_id <= 0) {
                this.showMessage('Invalid department selection', 'error');
                return;
            }
        } else if (role === 'student') {
            body.program = (this.$('profile-program')?.value || '').trim();
            body.year_level = this.$('profile-year-level')?.value || null;
        }

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

            const res = await fetch(`/api/users/${this.userId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }

            this.showMessage('Profile updated successfully', 'success');

            // Update sessionStorage and sidebar display
            sessionStorage.setItem('full_name', fullName);
            this.updateSidebarProfile(fullName);

            // Reload profile to reflect changes
            await this.loadProfile();

        } catch (err) {
            this.showMessage(err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        }
    }

    // =========================================
    // Change Password
    // =========================================

    async changePassword() {
        const btn = this.$('password-save-btn');
        const currentPw = (this.$('profile-current-password')?.value || '');
        const newPw = (this.$('profile-new-password')?.value || '');
        const confirmPw = (this.$('profile-confirm-password')?.value || '');

        if (!currentPw || !newPw || !confirmPw) {
            this.showMessage('All password fields are required', 'error');
            return;
        }

        if (newPw.length < 6) {
            this.showMessage('New password must be at least 6 characters', 'error');
            return;
        }

        if (newPw !== confirmPw) {
            this.showMessage('New passwords do not match', 'error');
            return;
        }

        if (currentPw === newPw) {
            this.showMessage('New password must be different from current password', 'error');
            return;
        }

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Changing...'; }

            const res = await fetch(`/api/users/${this.userId}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify({ current_password: currentPw, new_password: newPw })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to change password');
            }

            this.showMessage('Password changed successfully', 'success');

            // Clear form
            if (this.$('profile-current-password')) this.$('profile-current-password').value = '';
            if (this.$('profile-new-password')) this.$('profile-new-password').value = '';
            if (this.$('profile-confirm-password')) this.$('profile-confirm-password').value = '';
            this.updatePasswordStrength('');

        } catch (err) {
            this.showMessage(err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Change Password'; }
        }
    }

    // =========================================
    // UI Helpers
    // =========================================

    showMessage(text, type = 'error') {
        const el = this.$('profile-message');
        if (!el) return;
        el.textContent = text;
        el.className = `profile-message ${type}`;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (el.textContent === text) {
                    el.className = 'profile-message';
                }
            }, 4000);
        }
    }

    updatePasswordStrength(password) {
        const bar = this.$('password-strength-bar');
        if (!bar) return;

        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 10) strength++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const pct = Math.min(strength / 5 * 100, 100);
        const colors = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
        bar.style.width = password ? `${pct}%` : '0';
        bar.style.background = colors[Math.min(strength, 4)] || '#e5e7eb';
    }

    updateSidebarProfile(fullName) {
        // Update sidebar email displays with name where possible
        const els = document.querySelectorAll('#profile-email, #dropdown-profile-email');
        // Don't overwrite email display — only update if full_name element exists
        const nameEl = document.getElementById('user-fullname');
        if (nameEl) nameEl.textContent = fullName;
    }

}
