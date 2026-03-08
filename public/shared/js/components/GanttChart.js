/* =========================================
   SmartLab - Gantt Chart Component
   Reusable schedule visualization component
========================================= */

const GANTT_DEFAULT_PALETTE = [
    '#800000', '#FFB81C', '#10b981', '#3b82f6', '#a855f7', '#ec4899',
    '#f97316', '#0ea5e9', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16'
];

class GanttChart {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            defaultLab: 'Lab 1',
            rowHeight: 32,
            schedules: null,
            source: '/api/labSchedule',
            onScheduleClick: null,
            colorKey: null,
            colorPalette: GANTT_DEFAULT_PALETTE,
            getScheduleColor: null,
            defaultBlockColor: 'linear-gradient(135deg,#800000 0%,#5c0000 100%)',
            ...options
        };

        this.element = element;
        this.currentView = this.options.defaultView;
        this.schedules = Array.isArray(this.options.schedules) ? [...this.options.schedules] : [];
        this.currentLab = this.options.defaultLab || 'Lab 1';
        this.labs = Array.isArray(this.options.labs) ? [...this.options.labs] : null;
        this.colorAssignments = new Map();
        this.defaultBlockColor = '#3b82f6';
        this.labFilterEl = null;
        this._labChangeHandler = null;
        this.onScheduleClick = typeof this.options.onScheduleClick === 'function'
            ? this.options.onScheduleClick
            : null;
        this.cellOccupancy = new Set();
        this.defaultPalette = [...GANTT_DEFAULT_PALETTE];
        this.options.colorPalette = Array.isArray(this.options.colorPalette) && this.options.colorPalette.length
            ? [...this.options.colorPalette]
            : [...this.defaultPalette];
        this.defaultBlockColor = this.options.defaultBlockColor || 'linear-gradient(135deg,#800000 0%,#5c0000 100%)';
        this.colorAssignments = new Map();
        this.buildColorAssignments();
    }

    init() {
        this.renderView();
        if (!this.schedules.length) {
            this.loadSchedules();
        }
    }

    esc(value) {
        return SmartLab.Core?.Utils?.escapeHtml
            ? SmartLab.Core.Utils.escapeHtml(value ?? '')
            : String(value ?? '');
    }

    normalizeLab(v) {
        return String(v ?? '').trim().toLowerCase();
    }

    async loadSchedules() {
        if (!this.options.source) {
            console.warn('GanttChart: no data source provided');
            return;
        }

        try {
            const data = await SmartLab.Core.API.get(this.options.source);
            this.updateSchedules(data);
        } catch (err) {
            console.error('GanttChart: failed to load schedules', err);
            this.schedules = [];
            this.renderView('Failed to load schedules');
        }
    }

    updateSchedules(schedules = []) {
        this.schedules = Array.isArray(schedules) ? [...schedules] : [];
        this.buildColorAssignments();
        this.renderView();
    }

    updateLabs(labs = []) {
        if (Array.isArray(labs)) {
            this.labs = [...labs];
            if (!this.labs.includes(this.currentLab) && this.labs.length) {
                this.currentLab = this.labs[0];
            }
        }
    }

    getColorKey(schedule) {
        const { colorKey } = this.options;
        if (!colorKey) return null;

        const resolveKey = (keyOption) => {
            if (!keyOption) return null;
            if (typeof keyOption === 'function') {
                try {
                    return keyOption(schedule);
                } catch (err) {
                    console.warn('GanttChart: colorKey resolver failed', err);
                    return null;
                }
            }
            if (typeof keyOption === 'string') {
                return schedule?.[keyOption];
            }
            return null;
        };

        if (Array.isArray(colorKey)) {
            for (const option of colorKey) {
                const value = resolveKey(option);
                if (value) {
                    return String(value).trim().toLowerCase();
                }
            }
            return null;
        }

        const value = resolveKey(colorKey);
        return value ? String(value).trim().toLowerCase() : null;
    }

    buildColorAssignments() {
        this.colorAssignments = new Map();

        if (typeof this.options.getScheduleColor === 'function') {
            return;
        }

        if (!this.options.colorKey) {
            return;
        }

        const palette = Array.isArray(this.options.colorPalette) && this.options.colorPalette.length
            ? this.options.colorPalette
            : this.defaultPalette;

        const uniqueKeys = [...new Set(
            this.schedules
                .map((schedule) => this.getColorKey(schedule))
                .filter(Boolean)
        )].sort();

        uniqueKeys.forEach((key, index) => {
            const color = palette[index % palette.length];
            this.colorAssignments.set(key, color);
        });
    }

    getColorForSchedule(schedule) {
        if (typeof this.options.getScheduleColor === 'function') {
            const color = this.options.getScheduleColor(schedule);
            if (color) return color;
        }

        const key = this.getColorKey(schedule);
        if (key && this.colorAssignments.has(key)) {
            return this.colorAssignments.get(key);
        }

        return this.defaultBlockColor;
    }

    getStats() {
        const uniqueLabs = (this.labs && this.labs.length) ? this.labs : this.getLabsFromSchedules();
        const uniqueFaculty = [...new Set(this.schedules.map(s => s.faculty_name || s.full_name).filter(Boolean))].sort();
        return {
            total: this.schedules.length,
            uniqueLabs,
            uniqueFaculty
        };
    }

    getLabsFromSchedules() {
        const labels = [...new Set(this.schedules.map(s => s.lab_room).filter(Boolean))];
        return labels.filter(label => this.looksLikeLabLabel(label));
    }

    looksLikeLabLabel(label) {
        if (!label) return false;
        const normalized = String(label).toLowerCase();
        return normalized.includes('computer laboratory') || normalized.includes('computer lab');
    }

    renderView(errorMessage = null) {
        const { total, uniqueLabs, uniqueFaculty } = this.getStats();
        const labs = (this.labs && this.labs.length) ? this.labs : (uniqueLabs.length ? uniqueLabs : []);
        const fallbackLab = labs[0] || this.options.defaultLab || 'Lab 1';
        if (!labs.includes(this.currentLab)) {
            this.currentLab = fallbackLab;
        }

        const labOptions = labs.length
            ? labs.map(l => `<option value="${this.esc(l)}" ${l === this.currentLab ? 'selected' : ''}>${this.esc(l)}</option>`).join('')
            : `<option value="${this.esc(fallbackLab)}">${this.esc(fallbackLab)}</option>`;

        this.element.innerHTML = `
            <div class="gantt-chart-view" style="text-align:center;padding:2rem 1rem;">
                <h3 style="color:#374151;margin-bottom:1rem;">📊 Chart View</h3>
                <p style="color:#9ca3af;margin-bottom:1.5rem;">Schedule analytics and visualization</p>
                <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                    <div style="padding:1rem;background:#f3f4f6;border-radius:8px;min-width:120px;">
                        <div style="font-size:1.5rem;font-weight:bold;color:#800000;">${total}</div>
                        <div style="font-size:0.8rem;color:#6b7280;">Total Schedules</div>
                    </div>
                    <div style="padding:1rem;background:#f3f4f6;border-radius:8px;min-width:120px;">
                        <div style="font-size:1.5rem;font-weight:bold;color:#10b981;">${uniqueLabs.length}</div>
                        <div style="font-size:0.8rem;color:#6b7280;">Active Labs</div>
                    </div>
                    <div style="padding:1rem;background:#f3f4f6;border-radius:8px;min-width:120px;">
                        <div style="font-size:1.5rem;font-weight:bold;color:#3b82f6;">${uniqueFaculty.length}</div>
                        <div style="font-size:0.8rem;color:#6b7280;">Faculty Members</div>
                    </div>
                </div>

                <div style="margin-top:2rem;text-align:left;">
                    <h4 style="color:#374151;margin-bottom:1rem;text-align:center;">📅 Schedule Gantt Chart</h4>
                    <div class="gantt-chart-shell" style="background:white;border-radius:8px;padding:1rem;border:1px solid #e5e7eb;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem;">
                            <h5 style="margin:0;color:#374151;">Weekly Schedule Overview</h5>
                            <select class="filter-select gantt-lab-filter" style="min-width:130px;">
                                ${labOptions}
                            </select>
                        </div>
                        <div class="gantt-chart-content" style="overflow-x:auto;border:1px solid #e5e7eb;border-radius:6px;">
                            ${errorMessage ? `<div style="padding:2rem;text-align:center;color:#ef4444;">${errorMessage}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupLabFilter();
        if (!errorMessage) {
            this.renderChart();
        }
    }

    setupLabFilter() {
        if (this.labFilterEl && this._labChangeHandler) {
            this.labFilterEl.removeEventListener('change', this._labChangeHandler);
        }

        this.labFilterEl = this.element.querySelector('.gantt-lab-filter');
        if (!this.labFilterEl) return;

        this.labFilterEl.value = this.currentLab;
        this._labChangeHandler = (e) => {
            this.currentLab = e.target.value || this.options.defaultLab;
            this.renderChart();
        };
        this.labFilterEl.addEventListener('change', this._labChangeHandler);
    }

    renderChart() {
        const tableContainer = this.element.querySelector('.gantt-chart-content');
        if (!tableContainer) return;

        const selectedLab = this.labFilterEl?.value || this.currentLab || this.options.defaultLab || 'Lab 1';
        const labNorm = this.normalizeLab(selectedLab);
        const labSchedules = this.schedules.filter(s => this.normalizeLab(s.lab_room) === labNorm);

        if (!labSchedules.length) {
            tableContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:#6b7280;">No schedules for the selected lab.</div>';
            return;
        }

        tableContainer.innerHTML = '';
        this.buildTableStructure(tableContainer);
        this.cellOccupancy = new Set();

        const table = tableContainer.querySelector('.-sched-gantt-chart');
        if (!table) return;

        const rows = table.querySelectorAll('tr');
        if (rows[1]) {
            const rect = rows[1].getBoundingClientRect();
            if (rect.height > 0) this.rowPx = rect.height;
        }

        labSchedules.forEach(schedule => this.renderScheduleBlock(schedule, table));
    }

    buildTableStructure(container) {
        const table = document.createElement('table');
        table.className = '-sched-gantt-chart';
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;';

        const colgroup = document.createElement('colgroup');
        colgroup.innerHTML = `
            <col style="width:70px;">
            <col style="width:70px;">
            <col><col><col><col><col><col>
        `;
        table.appendChild(colgroup);

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">Start</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">End</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">MON</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">TUE</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">WED</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">THU</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">FRI</th>
            <th style="background:#f9fafb;padding:8px;border:1px solid #e5e7eb;font-weight:600;">SAT</th>
        `;
        table.appendChild(headerRow);

        const timeSlots = [
            ['07:30 AM','08:00 AM'],['08:00 AM','08:30 AM'],['08:30 AM','09:00 AM'],
            ['09:00 AM','09:30 AM'],['09:30 AM','10:00 AM'],['10:00 AM','10:30 AM'],
            ['10:30 AM','11:00 AM'],['11:00 AM','11:30 AM'],['11:30 AM','12:00 PM'],
            ['12:00 PM','12:30 PM'],['12:30 PM','01:00 PM'],['01:00 PM','01:30 PM'],
            ['01:30 PM','02:00 PM'],['02:00 PM','02:30 PM'],['02:30 PM','03:00 PM'],
            ['03:00 PM','03:30 PM'],['03:30 PM','04:00 PM'],['04:00 PM','04:30 PM'],
            ['04:30 PM','05:00 PM'],['05:00 PM','05:30 PM'],['05:30 PM','06:00 PM'],
            ['06:00 PM','06:30 PM'],['06:30 PM','07:00 PM'],['07:00 PM','07:30 PM'],
            ['07:30 PM','08:00 PM'],['08:00 PM','08:30 PM'],['08:30 PM','09:00 PM'],
            ['09:00 PM','09:30 PM']
        ];

        timeSlots.forEach(([start, end]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="background:#f9fafb;padding:6px 8px;border:1px solid #e5e7eb;font-weight:500;white-space:nowrap;">${start}</td>
                <td style="background:#f9fafb;padding:6px 8px;border:1px solid #e5e7eb;font-weight:500;white-space:nowrap;">${end}</td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
                <td style="border:1px solid #e5e7eb;position:relative;"></td>
            `;
            table.appendChild(row);
        });

        container.appendChild(table);
    }

    renderScheduleBlock(schedule, table) {
        const dayColumns = { MONDAY: 2, TUESDAY: 3, WEDNESDAY: 4, THURSDAY: 5, FRIDAY: 6, SATURDAY: 7 };
        const dayKey = (schedule.day_of_week || '').toUpperCase();
        const dayColumn = dayColumns[dayKey];
        if (!dayColumn) return;

        const startMinutes = this.parseMinutes(schedule.time_start, 'start');
        const endMinutes = this.parseMinutes(schedule.time_end, 'end');
        const startRow = this.findRowIndex(startMinutes, 'start');
        const endRow = this.findRowIndex(endMinutes, 'end');

        if (startRow === -1 || endRow === -1 || endRow < startRow) return;

        const rows = table.querySelectorAll('tr');
        if (!rows[startRow] || !rows[startRow].cells[dayColumn]) return;

        for (let r = startRow; r <= endRow; r++) {
            if (this.cellOccupancy.has(`${r}:${dayColumn}`)) {
                return;
            }
        }

        for (let r = startRow; r <= endRow; r++) {
            this.cellOccupancy.add(`${r}:${dayColumn}`);
        }

        const targetCell = rows[startRow].cells[dayColumn];
        targetCell.style.position = 'relative';
        targetCell.style.verticalAlign = 'top';
        targetCell.innerHTML = '';

        const rowSpanPx = Math.max(24, (endRow - startRow + 1) * (this.rowPx || this.options.rowHeight) - 4);

        const blockColor = this.getColorForSchedule(schedule);
        const block = document.createElement('div');
        block.style.cssText = `
            background:${blockColor};color:white;
            padding:4px 6px;border-radius:4px;font-size:11px;font-weight:600;
            box-shadow:0 2px 4px rgba(0,0,0,0.1);cursor:pointer;
            transition:transform 0.2s,box-shadow 0.2s;
            display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;overflow:hidden;
            position:absolute;box-sizing:border-box;inset:2px;height:${rowSpanPx}px;z-index:5;
        `;
        block.innerHTML = `
        <div style="font-size:10px;opacity:0.9;">${schedule.program_code} - ${schedule.year_level}</div>
        <div style="font-weight:bold;margin-bottom:2px;">${this.esc(schedule.faculty_name || 'Faculty')}</div>
        `;

        block.addEventListener('mouseenter', () => {
            block.style.transform = 'scale(1.02)';
            block.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        });

        block.addEventListener('mouseleave', () => {
            block.style.transform = 'scale(1)';
            block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });

        block.addEventListener('click', () => {
            if (this.onScheduleClick) {
                this.onScheduleClick(schedule);
            }
        });

        targetCell.appendChild(block);

        for (let r = startRow + 1; r <= endRow; r++) {
            const cell = rows[r]?.cells?.[dayColumn];
            if (cell) {
                cell.innerHTML = '';
                cell.style.background = 'rgba(128,0,0,0.05)';
            }
        }
    }

    parseMinutes(timeStr, type) {
        if (!timeStr) return 0;
        const str = String(timeStr).trim();
        if (/[AP]M$/i.test(str)) {
            const [time, period] = str.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
            if (period.toUpperCase() === 'AM' && h === 12) h = 0;
            return h * 60 + (m || 0);
        }

        const [hour, minute] = str.split(':').map(Number);
        return hour * 60 + (minute || 0);
    }

    findRowIndex(minutes, type) {
        const startSlots = [450,480,510,540,570,600,630,660,690,720,750,780,810,840,870,900,930,960,990,1020,1050,1080,1110,1140,1170,1200,1230,1260];
        const endSlots =   [480,510,540,570,600,630,660,690,720,750,780,810,840,870,900,930,960,990,1020,1050,1080,1110,1140,1170,1200,1230,1260,1290];
        const slots = type === 'end' ? endSlots : startSlots;
        for (let i = 0; i < slots.length; i++) {
            if (minutes >= slots[i] && minutes < slots[i] + 30) {
                return i + 1; // +1 to account for header row
            }
        }
        return -1;
    }

    refresh() {
        this.loadSchedules();
    }

    setLab(lab) {
        this.currentLab = lab;
        if (this.labFilterEl) {
            this.labFilterEl.value = lab;
        }
        this.renderChart();
    }

    destroy() {
        if (this.labFilterEl && this._labChangeHandler) {
            this.labFilterEl.removeEventListener('change', this._labChangeHandler);
        }
        this.element.innerHTML = '';
    }
}

// Register component with SmartLab Core
SmartLab.Core.Components.register('GanttChart', GanttChart);
