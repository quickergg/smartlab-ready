class GanttChartManager {
  constructor() {
    this.schedules = [];
    this.currentLab = 'Lab 1';            // default Lab 1
    this.occupied = new Set();            // tracks blocked cells to avoid overlaps
    this.rowPx = 32;                      // fallback row height (px); updated after table builds
    this.init();
  }

  init() {
    this.loadSchedules();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const filterSelect = document.querySelector('.gantt-chart-filter-select');
    if (filterSelect) {
      // Ensure UI matches default
      filterSelect.value = this.currentLab;

      filterSelect.addEventListener('change', (e) => {
        this.currentLab = e.target.value || 'Lab 1';
        this.renderChart();
      });
    }
  }

  normalizeLab(v) {
    return String(v ?? '').trim().toLowerCase();
  }

  cellKey(rowIndex, colIndex) {
    return `${rowIndex}:${colIndex}`;
  }

  async loadSchedules() {
    try {
      const res = await fetch('/api/labSchedule');
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to load schedules');

      this.schedules = Array.isArray(data) ? data : [];

      this.renderChart();
    } catch (err) {
      console.error('Failed to load lab schedules:', err);
      this.schedules = [];
    }
  }

  renderChart() {
    const tableContainer = document.querySelector('.gantt-chart-content');
    if (!tableContainer) return;

    // Reset occupancy on every render
    this.occupied.clear();

    // Build fresh table structure in JavaScript
    this.buildTableStructure(tableContainer);

    const table = tableContainer.querySelector('.-sched-gantt-chart');
    if (!table) return;

    // measure real row height (1st data row)
    const rows = table.querySelectorAll('tr');
    if (rows[1]) {
      const rect = rows[1].getBoundingClientRect();
      if (rect.height > 0) this.rowPx = rect.height;
    }

    // ✅ FIXED FILTER (no "All", Lab 1 default, normalized compare)
    const labNorm = this.normalizeLab(this.currentLab);
    const filteredSchedules = this.schedules.filter(s =>
      this.normalizeLab(s.lab_room) === labNorm
    );

    filteredSchedules.forEach(schedule => {
      this.renderScheduleBlock(schedule);
    });
  }

  buildTableStructure(container) {
    const existingTables = container.querySelectorAll('.-sched-gantt-chart');
    existingTables.forEach(table => table.remove());

    // remove any previous debug labels (if you used them before)
    const debugLabels = container.querySelectorAll('div[style*="position: absolute"]');
    debugLabels.forEach(label => label.remove());

    const table = document.createElement('table');
    table.className = '-sched-gantt-chart';

    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th></th>
      <th></th>
      <th>MONDAY</th>
      <th>TUESDAY</th>
      <th>WEDNESDAY</th>
      <th>THURSDAY</th>
      <th>FRIDAY</th>
      <th>SATURDAY</th>
    `;
    table.appendChild(headerRow);

    const timeSlots = [
      ['07:30 AM', '08:00 AM'],
      ['08:00 AM', '08:30 AM'],
      ['08:30 AM', '09:00 AM'],
      ['09:00 AM', '09:30 AM'],
      ['09:30 AM', '10:00 AM'],
      ['10:00 AM', '10:30 AM'],
      ['10:30 AM', '11:00 AM'],
      ['11:00 AM', '11:30 AM'],
      ['11:30 AM', '12:00 PM'],
      ['12:00 PM', '12:30 PM'],
      ['12:30 PM', '01:00 PM'],
      ['01:00 PM', '01:30 PM'],
      ['01:30 PM', '02:00 PM'],
      ['02:00 PM', '02:30 PM'],
      ['02:30 PM', '03:00 PM'],
      ['03:00 PM', '04:00 PM'], // (left as-is since you didn't ask; but keep in mind it’s not 30 mins)
      ['04:00 PM', '04:30 PM'],
      ['04:30 PM', '05:00 PM'],
      ['05:00 PM', '05:30 PM'],
      ['05:30 PM', '06:00 PM'],
      ['06:00 PM', '06:30 PM'],
      ['06:30 PM', '07:00 PM'],
      ['07:00 PM', '07:30 PM'],
      ['07:30 PM', '08:00 PM'],
      ['08:00 PM', '08:30 PM'],
      ['08:30 PM', '09:00 PM'],
      ['09:00 PM', '09:30 PM']
    ];

    timeSlots.forEach(([startTime, endTime]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${startTime}</td>
        <td>${endTime}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
      `;
      table.appendChild(row);
    });

    const h3 = container.querySelector('h3');
    if (h3) h3.parentNode.insertBefore(table, h3.nextSibling);
    else container.appendChild(table);
  }

  renderScheduleBlock(schedule) {
    const table = document.querySelector('.-sched-gantt-chart');
    if (!table) return;

    const day = schedule.day_of_week;
    const startTime = this.parseTime(schedule.time_start);
    const endTime = this.parseTime(schedule.time_end);

    const dayColumns = {
      'MONDAY': 2,
      'TUESDAY': 3,
      'WEDNESDAY': 4,
      'THURSDAY': 5,
      'FRIDAY': 6,
      'SATURDAY': 7
    };

    const dayColumn = dayColumns[day];
    if (!dayColumn) {
      console.error("Unknown day:", day);
      return;
    }

    const startRow = this.findRowForStartTime(startTime);
    const endRow = this.findRowForEndTime(endTime);

    if (startRow === -1 || endRow === -1) return;

    const rowSpan = endRow - startRow + 1;
    if (rowSpan <= 0) return;

    const rows = table.querySelectorAll('tr');
    if (startRow >= rows.length) return;

    // Validate column exists on the start row
    if (dayColumn >= rows[startRow].cells.length) {
      console.error("dayColumn out of range:", { dayColumn, rowCells: rows[startRow].cells.length });
      return;
    }

    // ✅ SAFETY: check occupancy for the entire span (prevents overlaps AND column drifting)
    for (let r = startRow; r <= endRow; r++) {
      const k = this.cellKey(r, dayColumn);
      if (this.occupied.has(k)) {
        console.warn("Skipped overlapping schedule (occupied cell).", {
          subject: schedule.subject,
          day,
          time: `${schedule.time_start} - ${schedule.time_end}`,
          row: r,
          col: dayColumn
        });
        return;
      }
    }

    // mark occupied cells (including the start cell)
    for (let r = startRow; r <= endRow; r++) {
      this.occupied.add(this.cellKey(r, dayColumn));
    }

    // Build schedule block (tall block, no rowSpan, no deleteCell)
    const scheduleBlock = document.createElement('div');
    scheduleBlock.className = 'schedule-block';
    scheduleBlock.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin: 2px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      position: absolute;
      inset: 2px;
      height: ${Math.max(24, rowSpan * this.rowPx - 4)}px;
      z-index: 5;
    `;

    scheduleBlock.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 2px;">${schedule.subject || 'Subject'}</div>
      <div style="font-size: 10px; opacity: 0.9;">${schedule.time_start} - ${schedule.time_end}</div>
    `;

    scheduleBlock.addEventListener('mouseenter', () => {
      scheduleBlock.style.transform = 'scale(1.02)';
      scheduleBlock.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    });

    scheduleBlock.addEventListener('mouseleave', () => {
      scheduleBlock.style.transform = 'scale(1)';
      scheduleBlock.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });

    scheduleBlock.addEventListener('click', () => this.showScheduleDetails(schedule));

    // Place the block in the start cell, and visually "block out" cells below
    const targetCell = rows[startRow].cells[dayColumn];

    // make the cell a positioning context for the absolute block
    targetCell.style.position = 'relative';
    targetCell.style.verticalAlign = 'top';
    targetCell.innerHTML = '';
    targetCell.appendChild(scheduleBlock);

    // Optional: fade cells underneath so you can see they’re “covered”
    for (let r = startRow + 1; r <= endRow; r++) {
      const c = rows[r]?.cells?.[dayColumn];
      if (c) {
        c.innerHTML = '';
        c.style.background = 'rgba(102, 126, 234, 0.06)';
      }
    }
  }

  parseTime(timeStr) {
        // Handle different time formats
        // Format 1: "09:00 AM" (12-hour with AM/PM)
        // Format 2: "09:00:00" (24-hour with seconds)
        
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
            // 12-hour format: "09:00 AM"
            const [time, period] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            
            return hours * 60 + minutes;
        } else {
            // 24-hour format: "09:00:00"
            let [hours, minutes, seconds] = timeStr.split(':').map(Number);
            
            // Handle edge case for times like "19:59:00" - round to nearest 30-min slot
            const totalMinutes = hours * 60 + minutes;
            
            // Round to nearest 30-minute interval
            const roundedMinutes = Math.round(totalMinutes / 30) * 30;
            
            return roundedMinutes;
        }
    }

    findRowForStartTime(minutes) {
        // Map start time to first time column based on actual table structure
        const timeSlots = [
            450,  // 07:30 AM - Row 1 (first column)
            480,  // 08:00 AM - Row 2 (first column)
            510,  // 08:30 AM - Row 3 (first column)
            540,  // 09:00 AM - Row 4 (first column)
            570,  // 09:30 AM - Row 5 (first column)
            600,  // 10:00 AM - Row 6 (first column)
            630,  // 10:30 AM - Row 7 (first column)
            660,  // 11:00 AM - Row 8 (first column)
            690,  // 11:30 AM - Row 9 (first column)
            720,  // 12:00 PM - Row 10 (first column)
            750,  // 12:30 PM - Row 11 (first column)
            780,  // 01:00 PM - Row 12 (first column)
            810,  // 01:30 PM - Row 13 (first column)
            840,  // 02:00 PM - Row 14 (first column)
            870,  // 02:30 PM - Row 15 (first column)
            900,  // 03:00 PM - Row 16 (first column)
            930,  // 04:00 PM - Row 17 (first column)
            960,  // 04:30 PM - Row 18 (first column)
            990,  // 05:00 PM - Row 19 (first column)
            1020, // 05:30 PM - Row 20 (first column)
            1050, // 06:00 PM - Row 21 (first column)
            1080, // 06:30 PM - Row 22 (first column)
            1110, // 07:00 PM - Row 23 (first column)
            1140, // 07:30 PM - Row 24 (first column)
            1170, // 08:00 PM - Row 25 (first column)
            1200, // 08:30 PM - Row 26 (first column)
            1230  // 09:00 PM - Row 27 (first column)
        ];

        // Find the exact time slot
        for (let i = 0; i < timeSlots.length; i++) {
            if (minutes >= timeSlots[i] && minutes < timeSlots[i] + 30) {
                return i + 1; // +1 because header row is at index 0
            }
        }
        
        return -1; // Not found
    }

    findRowForEndTime(minutes) {
        // Map end time to second time column based on actual table structure
        const timeSlots = [
            480,  // 08:00 AM - Row 1 (second column)
            510,  // 08:30 AM - Row 2 (second column)
            540,  // 09:00 AM - Row 3 (second column)
            570,  // 09:30 AM - Row 4 (second column)
            600,  // 10:00 AM - Row 5 (second column)
            630,  // 10:30 AM - Row 6 (second column)
            660,  // 11:00 AM - Row 7 (second column)
            690,  // 11:30 AM - Row 8 (second column)
            720,  // 12:00 PM - Row 9 (second column)
            750,  // 12:30 PM - Row 10 (second column)
            780,  // 01:00 PM - Row 11 (second column)
            810,  // 01:30 PM - Row 12 (second column)
            840,  // 02:00 PM - Row 13 (second column)
            870,  // 02:30 PM - Row 14 (second column)
            900,  // 03:00 PM - Row 15 (second column)
            930,  // 04:00 PM - Row 16 (second column)
            960,  // 04:30 PM - Row 17 (second column)
            990,  // 05:00 PM - Row 18 (second column)
            1020, // 05:30 PM - Row 19 (second column)
            1050, // 06:00 PM - Row 20 (second column)
            1080, // 06:30 PM - Row 21 (second column)
            1110, // 07:00 PM - Row 22 (second column)
            1140, // 07:30 PM - Row 23 (second column)
            1170, // 08:00 PM - Row 24 (second column)
            1200, // 08:30 PM - Row 25 (second column)
            1230, // 09:00 PM - Row 26 (second column)
            1260  // 09:30 PM - Row 27 (second column)
        ];

        // Find the exact time slot
        for (let i = 0; i < timeSlots.length; i++) {
            if (minutes >= timeSlots[i] && minutes < timeSlots[i] + 30) {
                return i + 1; // +1 because header row is at index 0
            }
        }
        
        return -1; // Not found
    }

    showScheduleDetails(schedule) {
        const details = `
        Laboratory: ${schedule.lab_room}
        Day: ${schedule.day_of_week}
        Time: ${schedule.time_start} - ${schedule.time_end}
        Subject: ${schedule.subject || 'N/A'}
        Academic Year: ${schedule.academic_year || 'N/A'}
        Term: ${schedule.term || 'N/A'}
        `.trim();

        alert(details);
    }
}

document.addEventListener('DOMContentLoaded', () => {
  new GanttChartManager();
});
