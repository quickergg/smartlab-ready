// Gantt Chart for Lab Schedule - Visual Only
class LabScheduleGantt {
  constructor() {
    this.schedules = [];
    this.currentLabFilter = 'all';
    this.timeSlots = [];
    this.daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    
    this.init();
  }

  init() {
    this.generateTimeSlots();
    this.setupEventListeners();
    this.loadSchedules();
  }

  generateTimeSlots() {
    this.timeSlots = [];
    for (let hour = 7; hour <= 21; hour++) {
      this.timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
  }

  setupEventListeners() {
    // Gantt lab filter
    document.querySelectorAll('.gantt-controls .lab-filter button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.gantt-controls .lab-filter button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentLabFilter = e.target.dataset.lab;
        this.render();
      });
    });

    // Sync with main table filter
    const mainLabFilter = document.getElementById('lab-filter');
    if (mainLabFilter) {
      mainLabFilter.addEventListener('change', (e) => {
        this.currentLabFilter = e.target.value;
        this.render();
        // Sync Gantt filter
        document.querySelectorAll('.gantt-controls .lab-filter button').forEach(b => b.classList.remove('active'));
        const targetBtn = document.querySelector(`.gantt-controls .lab-filter button[data-lab="${e.target.value}"]`);
        if (targetBtn) targetBtn.classList.add('active');
      });
    }
  }

  async loadSchedules() {
    try {
      const response = await fetch('/api/labSchedule');
      if (!response.ok) throw new Error('Failed to load schedules');
      
      this.schedules = await response.json();
      this.render();
    } catch (error) {
      console.error('Error loading schedules:', error);
      this.showError('Unable to load lab schedules');
    }
  }

  render() {
    this.renderDaysHeader();
    this.renderGanttBody();
  }

  renderDaysHeader() {
    const daysHeader = document.getElementById('gantt-days-header');
    if (!daysHeader) return;

    daysHeader.innerHTML = '';
    
    this.daysOfWeek.forEach(day => {
      const daySlot = document.createElement('div');
      daySlot.className = 'day-slot';
      daySlot.textContent = day.charAt(0) + day.slice(1).toLowerCase();
      daysHeader.appendChild(daySlot);
    });
  }

  renderGanttBody() {
    const ganttBody = document.getElementById('gantt-chart-body');
    if (!ganttBody) return;

    ganttBody.innerHTML = '';

    const filteredSchedules = this.getFilteredSchedules();

    if (this.timeSlots.length === 0) {
      ganttBody.innerHTML = '<div class="gantt-empty">No time slots available</div>';
      return;
    }

    // Create rows for each time slot
    this.timeSlots.forEach(time => {
      const row = this.createTimeRow(time, filteredSchedules);
      ganttBody.appendChild(row);
    });
  }

  getFilteredSchedules() {
    let filtered = [...this.schedules];

    // Filter by lab
    if (this.currentLabFilter !== 'all') {
      filtered = filtered.filter(schedule => {
        const labName = this.formatLab(schedule.lab_room);
        return labName === this.currentLabFilter;
      });
    }

    return filtered;
  }

  createTimeRow(time, schedules) {
    const row = document.createElement('div');
    row.className = 'gantt-row';

    // Time info column
    const timeInfo = document.createElement('div');
    timeInfo.className = 'time-info';
    timeInfo.textContent = time;
    row.appendChild(timeInfo);

    // Week timeline
    const timeline = document.createElement('div');
    timeline.className = 'gantt-week-timeline';

    // Create day blocks
    this.daysOfWeek.forEach(day => {
      const dayBlock = document.createElement('div');
      dayBlock.className = 'day-block';
      timeline.appendChild(dayBlock);
    });

    // Add schedule bars for this time slot
    schedules.forEach(schedule => {
      if (this.isScheduleInTimeSlot(schedule, time)) {
        const bar = this.createScheduleBar(schedule);
        timeline.appendChild(bar);
      }
    });

    row.appendChild(timeline);
    return row;
  }

  isScheduleInTimeSlot(schedule, timeSlot) {
    const startTime = schedule.time_start.substring(0, 5);
    const endTime = schedule.time_end.substring(0, 5);
    
    // Check if the schedule spans this time slot
    return startTime <= timeSlot && endTime > timeSlot;
  }

  createScheduleBar(schedule) {
    const bar = document.createElement('div');
    bar.className = `schedule-bar lab-${schedule.lab_room}`;
    
    // Find the day index for positioning
    const dayIndex = this.daysOfWeek.indexOf(schedule.day_of_week);
    if (dayIndex === -1) return bar;
    
    // Position the bar in the correct day column
    const dayWidth = 100 / this.daysOfWeek.length;
    bar.style.left = `${dayIndex * dayWidth}%`;
    bar.style.width = `${dayWidth - 2}%`;
    
    bar.textContent = `${schedule.subject} - ${this.formatLab(schedule.lab_room)}`;
    
    // Add tooltip
    bar.addEventListener('mouseenter', (e) => this.showTooltip(e, schedule));
    bar.addEventListener('mouseleave', () => this.hideTooltip());
    
    return bar;
  }

  formatLab(lab) {
    if (lab === "1" || lab === 1) return "Lab 1";
    if (lab === "2" || lab === 2) return "Lab 2";
    if (lab === "3" || lab === 3) return "Lab 3";
    return lab;
  }

  showTooltip(event, schedule) {
    const tooltip = document.getElementById('gantt-tooltip');
    if (!tooltip) return;

    const startTime = String(schedule.time_start).substring(0, 5);
    const endTime = String(schedule.time_end).substring(0, 5);
    
    tooltip.innerHTML = `
      <strong>${schedule.subject}</strong><br>
      Faculty: ${schedule.faculty_name}<br>
      Section: ${schedule.program} - Year ${schedule.year_level}<br>
      Day: ${schedule.day_of_week}<br>
      Time: ${startTime} - ${endTime}<br>
      Lab: ${this.formatLab(schedule.lab_room)}
    `;
    
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;
    tooltip.classList.add('show');
  }

  hideTooltip() {
    const tooltip = document.getElementById('gantt-tooltip');
    if (tooltip) {
      tooltip.classList.remove('show');
    }
  }

  showError(message) {
    const ganttBody = document.getElementById('gantt-chart-body');
    if (ganttBody) {
      ganttBody.innerHTML = `<div class="gantt-empty">${message}</div>`;
    }
  }

  // Public method to refresh data
  refresh() {
    this.loadSchedules();
  }
}

// Initialize the Gantt chart when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on admin page
  if (document.getElementById('gantt-chart-container')) {
    window.labGantt = new LabScheduleGantt();
  }
});

// Make it available globally for integration with existing code
window.refreshGanttChart = function() {
  if (window.labGantt) {
    window.labGantt.refresh();
  }
};
