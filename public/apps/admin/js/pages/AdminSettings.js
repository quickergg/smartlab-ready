/* =========================================
   SmartLab – Admin Settings Page
   Manages global system configurations
========================================= */

class AdminSettings {
    constructor() {
        this.init();
    }

    $(id) {
        return document.getElementById(id);
    }

    async init() {
        await this.loadData();
        this.bindEvents();
    }

    // =========================================
    // Load Data
    // =========================================

    async loadData() {
        try {
            const [yearsRes, termsRes, activeRes] = await Promise.all([
                fetch('/api/academic-years', { headers: SmartLab.Core.Auth.getAuthHeaders() }),
                fetch('/api/terms', { headers: SmartLab.Core.Auth.getAuthHeaders() }),
                fetch('/api/activeAcademicContext', { headers: SmartLab.Core.Auth.getAuthHeaders() })
            ]);

            const years = yearsRes.ok ? await yearsRes.json() : [];
            const terms = termsRes.ok ? await termsRes.json() : [];
            const active = activeRes.ok ? await activeRes.json() : null;

            // Populate academic year dropdown
            const yearSelect = this.$('admin-academic-year');
            if (yearSelect) {
                yearSelect.innerHTML = years.map(y =>
                    `<option value="${y.academic_year_id}" ${y.is_active ? 'selected' : ''}>${y.academic_year}</option>`
                ).join('');
            }

            // Populate term dropdown
            const termSelect = this.$('admin-term');
            if (termSelect) {
                termSelect.innerHTML = terms.map(t =>
                    `<option value="${t.term_id}" ${t.is_active ? 'selected' : ''}>${t.term}</option>`
                ).join('');
            }

            // Show current context
            const display = this.$('admin-context-display');
            if (display && active) {
                display.textContent = `AY ${active.academic_year}  \u2022  ${active.term}`;
            } else if (display) {
                display.textContent = 'Not set';
            }
        } catch (err) {
            console.error('AdminSettings: Failed to load data:', err);
            this.showMessage('Failed to load settings data', 'error');
        }
    }

    // =========================================
    // Event Binding
    // =========================================

    bindEvents() {
        const saveBtn = this.$('admin-save-context-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveAcademicContext());
        }

        const addYearBtn = this.$('btn-add-year');
        if (addYearBtn) {
            addYearBtn.addEventListener('click', () => this.addAcademicYear());
        }
    }

    // =========================================
    // Save Academic Context
    // =========================================

    async saveAcademicContext() {
        const btn = this.$('admin-save-context-btn');
        const yearId = this.$('admin-academic-year')?.value;
        const termId = this.$('admin-term')?.value;

        if (!yearId || !termId) {
            this.showMessage('Please select both academic year and term', 'error');
            return;
        }

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

            const res = await fetch('/api/academic-context', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify({ academic_year_id: Number(yearId), term_id: Number(termId) })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update context');

            this.showMessage('Academic context updated successfully', 'success');
            await this.loadData();

        } catch (err) {
            this.showMessage(err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Update Academic Context'; }
        }
    }

    // =========================================
    // Add Academic Year
    // =========================================

    async addAcademicYear() {
        const input = prompt('Enter new academic year (e.g. 2027-2028):');
        if (!input || !input.trim()) return;

        const value = input.trim();
        if (!/^\d{4}-\d{4}$/.test(value)) {
            this.showMessage('Invalid format. Use YYYY-YYYY (e.g. 2027-2028)', 'error');
            return;
        }

        try {
            const res = await fetch('/api/academic-years', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() },
                body: JSON.stringify({ academic_year: value })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add academic year');

            this.showMessage(`Academic year "${value}" added`, 'success');
            await this.loadData();

            // Auto-select the new year
            const yearSelect = this.$('admin-academic-year');
            if (yearSelect && data.academic_year_id) {
                yearSelect.value = data.academic_year_id;
            }
        } catch (err) {
            this.showMessage(err.message, 'error');
        }
    }

    // =========================================
    // UI Helpers
    // =========================================

    showMessage(text, type = 'error') {
        const el = this.$('settings-message');
        if (!el) return;
        el.textContent = text;
        el.className = `settings-message ${type}`;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (type === 'success') {
            setTimeout(() => {
                if (el.textContent === text) {
                    el.className = 'settings-message';
                }
            }, 4000);
        }
    }
}
