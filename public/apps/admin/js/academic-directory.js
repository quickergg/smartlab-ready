class AcademicDirectoryPage {
  constructor() {
    this.buildings = [];
    this.rooms = [];
    this.programs = [];
    this.subjects = [];
    this.departments = [];
    this.summaryEls = {
      buildings: document.getElementById('summary-buildings'),
      rooms: document.getElementById('summary-rooms'),
      programs: document.getElementById('summary-programs'),
      subjects: document.getElementById('summary-subjects'),
      departments: document.getElementById('summary-departments')
    };

    this.tables = {
      buildings: document.getElementById('table-buildings'),
      rooms: document.getElementById('table-rooms'),
      programs: document.getElementById('table-programs'),
      subjects: document.getElementById('table-subjects'),
      departments: document.getElementById('table-departments')
    };

    this.attachButtonHandlers();
    this.loadData();
  }

  openDepartmentModal(department = null) {
    const modal = window.modalManager || window.ModalManager;
    if (!modal || typeof modal.show !== 'function') {
      SmartLab?.Core?.UI?.showToast?.('Modal system unavailable.', 'error');
      return;
    }
    const type = department ? 'edit-department' : 'add-department';
    modal.show(type, {
      department,
      onSuccess: () => this.loadData()
    });
  }

  renderPrograms(rows) {
    const tbody = this.tables.programs;
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="placeholder">No programs found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${this.esc(row.program_code)}</td>
        <td>${this.esc(row.program_name)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-action="edit-program" data-id="${row.program_id}" title="Edit Program">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  renderSubjects(rows) {
    const tbody = this.tables.subjects;
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="placeholder">No subjects found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${this.esc(row.subject_code)}</td>
        <td>${this.esc(row.subject_name)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-action="edit-subject" data-id="${row.subject_id}" title="Edit Subject">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  renderDepartments(rows) {
    const tbody = this.tables.departments;
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="placeholder">No departments found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${this.esc(row.department_code)}</td>
        <td>${this.esc(row.department_name)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-action="edit-department" data-id="${row.department_id}" title="Edit Department">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  openProgramModal(program = null) {
    const modal = window.modalManager || window.ModalManager;
    if (!modal || typeof modal.show !== 'function') {
      SmartLab?.Core?.UI?.showToast?.('Modal system unavailable.', 'error');
      return;
    }
    const type = program ? 'edit-program' : 'add-program';
    modal.show(type, {
      program,
      onSuccess: () => this.loadData()
    });
  }

  openSubjectModal(subject = null) {
    const modal = window.modalManager || window.ModalManager;
    if (!modal || typeof modal.show !== 'function') {
      SmartLab?.Core?.UI?.showToast?.('Modal system unavailable.', 'error');
      return;
    }
    const type = subject ? 'edit-subject' : 'add-subject';
    modal.show(type, {
      subject,
      onSuccess: () => this.loadData()
    });
  }

  attachButtonHandlers() {
    document.querySelectorAll('[data-action="add-entity"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entity = btn.dataset.entity;
        if (!entity) return;
        if (entity === 'building') return this.openBuildingModal();
        if (entity === 'room') return this.openRoomModal();
        if (entity === 'program') return this.openProgramModal();
        if (entity === 'subject') return this.openSubjectModal();
        if (entity === 'department') return this.openDepartmentModal();
        this.showComingSoon(entity);
      });
    });

    const buildingTable = this.tables.buildings;
    if (buildingTable) {
      buildingTable.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-building"]');
        if (!editBtn) return;
        const id = Number(editBtn.dataset.id);
        const name = editBtn.dataset.name || '';
        if (!id) return;
        this.openBuildingModal({ building_id: id, building_name: name });
      });
    }

    const roomTable = this.tables.rooms;
    if (roomTable) {
      roomTable.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-room"]');
        if (!editBtn) return;
        const id = Number(editBtn.dataset.id);
        if (!id) return;
        const room = this.rooms?.find(r => r.room_id === id) || null;
        this.openRoomModal(room);
      });
    }

    const programTable = this.tables.programs;
    if (programTable) {
      programTable.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-program"]');
        if (!editBtn) return;
        const id = Number(editBtn.dataset.id);
        if (!id) return;
        const program = this.programs?.find(p => p.program_id === id) || null;
        this.openProgramModal(program);
      });
    }

    const subjectTable = this.tables.subjects;
    if (subjectTable) {
      subjectTable.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-subject"]');
        if (!editBtn) return;
        const id = Number(editBtn.dataset.id);
        if (!id) return;
        const subject = this.subjects?.find(s => s.subject_id === id) || null;
        this.openSubjectModal(subject);
      });
    }

    const departmentTable = this.tables.departments;
    if (departmentTable) {
      departmentTable.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-department"]');
        if (!editBtn) return;
        const id = Number(editBtn.dataset.id);
        if (!id) return;
        const department = this.departments?.find(d => d.department_id === id) || null;
        this.openDepartmentModal(department);
      });
    }
  }

  openBuildingModal(building = null) {
    const modal = window.modalManager || window.ModalManager;
    if (!modal || typeof modal.show !== 'function') {
      SmartLab?.Core?.UI?.showToast?.('Modal system unavailable.', 'error');
      return;
    }
    const type = building ? 'edit-building' : 'add-building';
    modal.show(type, {
      building,
      onSuccess: () => this.loadData()
    });
  }

  openRoomModal(room = null) {
    const modal = window.modalManager || window.ModalManager;
    if (!modal || typeof modal.show !== 'function') {
      SmartLab?.Core?.UI?.showToast?.('Modal system unavailable.', 'error');
      return;
    }
    const type = room ? 'edit-room' : 'add-room';
    modal.show(type, {
      room,
      buildings: this.buildings,
      onSuccess: () => this.loadData()
    });
  }

  async loadData() {
    try {
      const res = await fetch('/api/academic-directory', {
        headers: SmartLab.Core.Auth.getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.buildings = data.buildings || [];
      this.rooms = data.rooms || [];
      this.programs = data.programs || [];
      this.subjects = data.subjects || [];
      this.departments = data.departments || [];
      this.renderSummary(data.summary || {});
      this.renderBuildings(this.buildings);
      this.renderRooms(this.rooms);
      this.renderPrograms(this.programs);
      this.renderSubjects(this.subjects);
      this.renderDepartments(this.departments);
    } catch (error) {
      console.error('AcademicDirectoryPage loadData error:', error);
      SmartLab.Core.UI.showToast('Failed to load Academic Directory data.', 'error');
    }
  }

  renderSummary(summary) {
    Object.entries(this.summaryEls).forEach(([key, el]) => {
      if (!el) return;
      const value = summary[key] ?? 0;
      el.textContent = value;
    });
  }

  renderBuildings(rows) {
    const tbody = this.tables.buildings;
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="placeholder">No buildings found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${row.building_id}</td>
        <td>${this.esc(row.building_name)}</td>
        <td>${row.room_count || 0}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-action="edit-building" data-id="${row.building_id}" data-name="${this.esc(row.building_name)}" title="Edit Building">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  renderRooms(rows) {
    const tbody = this.tables.rooms;
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="placeholder">No rooms found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${this.esc(row.room_number)}</td>
        <td>${this.esc(row.room_name)}</td>
        <td>${this.esc(row.building_name || '-')}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-action="edit-room" data-id="${row.room_id}" title="Edit Room">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  showComingSoon(entity) {
    const label = entity.charAt(0).toUpperCase() + entity.slice(1);
    SmartLab?.Core?.UI?.showToast?.(`${label} form coming soon.`, 'info');
  }

  showComingSoon(entity) {
    const label = entity.charAt(0).toUpperCase() + entity.slice(1);
    SmartLab?.Core?.UI?.showToast?.(`${label} form coming soon.`, 'info');
  }

  esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      || '-';
  }
}

window.initAcademicDirectoryPage = () => new AcademicDirectoryPage();
