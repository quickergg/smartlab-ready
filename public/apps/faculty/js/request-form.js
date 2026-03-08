/* =========================================
   SmartLab – Shared Borrow Request Form Logic
   Used by faculty.js and student.js
========================================= */

(() => {
  // Initialize a borrow request form with role-specific tweaks
  function init(formId, role = "faculty") {
    const form = document.getElementById(formId);
    if (!form) return;

    // Elements (some may not exist on student page)
    const labChk = document.getElementById("labChk");
    const labSelectWrap = document.getElementById("labSelectWrap");
    const labSelect = document.getElementById("labSelect");
    const facultyInCharge = document.getElementById("facultyInCharge");
    const facultyIdSelect = document.getElementById("facultyIdSelect");
    const programSelect = document.getElementById("program-select");
    const subjectSelect = document.getElementById("subject-select");
    const yearSelect = document.getElementById("year-select");
    const dateNeeded = document.getElementById("dateNeeded");
    const locationSelect = document.getElementById("location");
    const locationCustomWrap = document.getElementById("locationCustomWrap");
    const locationCustomInput = document.getElementById("locationCustom");
    const timeStart = document.getElementById("timeStart");
    const timeEnd = document.getElementById("timeEnd");
    const contactDetails = document.getElementById("contactDetails");
    const purpose = document.getElementById("purpose");
    const newBtn = document.getElementById("newRequestBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const submitBtn = document.getElementById("submitRequestBtn");
    const subjectSelectWasDisabled = subjectSelect ? subjectSelect.disabled : false;
    const programSelectWasDisabled = programSelect ? programSelect.disabled : false;
    let cachedRooms = [];
    const LOCATION_CUSTOM_VALUE = "__custom__";
    const LAB_ROOM_NAMES = [
      'Computer Laboratory 1',
      'Computer Laboratory 2',
      'Computer Laboratory 3'
    ];

    const parsePositiveInt = (value) => {
      if (value === undefined || value === null) return null;
      const num = Number(value);
      return Number.isInteger(num) && num > 0 ? num : null;
    };

    // Load faculty options into dropdown
    async function loadFacultyOptions() {
      if (!facultyIdSelect) return;
      
      try {
        const response = await fetch('/api/faculty-list', { headers: SmartLab.Core.Auth.getAuthHeaders() });
        const faculty = await response.json();
        
        // Clear existing options except the default
        facultyIdSelect.innerHTML = '<option value="">-- Select Faculty --</option>';
        
        // Add faculty options
        faculty.forEach(fac => {
          const option = document.createElement('option');
          option.value = fac.faculty_id;
          option.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
          facultyIdSelect.appendChild(option);
        });

        // Check if current user is faculty and auto-fill
        await autoFillFacultyForCurrentUser(faculty);
      } catch (err) {
        console.error('Failed to load faculty options:', err);
      }
    }

    // Auto-fill faculty field if current user is a faculty member
    async function autoFillFacultyForCurrentUser(facultyList) {
      const currentUserId = Number(sessionStorage.getItem("user_id"));
      const currentUserRole = sessionStorage.getItem("role");
      
      if (!currentUserId) {
        return;
      }
      
      if (!currentUserRole) {
        return;
      }
      
      if (!facultyIdSelect) {
        return;
      }
      
      // Check different possible role values
      const isFaculty = currentUserRole === "Faculty" || 
                       currentUserRole === "faculty" || 
                       currentUserRole === "2" || // role_id for faculty
                       currentUserRole.toLowerCase().includes("faculty");
      
      if (!isFaculty) {
        return;
      }
      
      // Find current faculty in the list
      const currentFaculty = facultyList.find(f => f.faculty_id === currentUserId);
      
      if (currentFaculty) {
        // Auto-select and disable the faculty dropdown
        facultyIdSelect.value = currentFaculty.faculty_id;
        facultyIdSelect.disabled = true;
        
        // Add visual indicator that it's auto-filled
        const label = facultyIdSelect.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
          label.textContent = 'Faculty in charge (You)';
          label.style.color = '#28a745';
          label.style.fontWeight = 'bold';
        }
      }
    }

    async function loadProgramOptions() {
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
          programSelect.appendChild(option);
        });

        if (previousValue) {
          programSelect.value = previousValue;
        }
      } catch (err) {
        console.error('Failed to load programs:', err);
        programSelect.innerHTML = '<option value="">Unable to load programs</option>';
      } finally {
        programSelect.disabled = programSelectWasDisabled ? true : wasDisabled;
      }
    }

    async function loadSubjectOptions() {
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
          option.value = subject.subject_id;
          option.textContent = subject.subject_code
            ? `${subject.subject_code} — ${subject.subject_name}`
            : (subject.subject_name || 'Unnamed Subject');
          option.dataset.subjectName = subject.subject_name || '';
          option.dataset.subjectCode = subject.subject_code || '';
          subjectSelect.appendChild(option);
        });

        if (previousValue) {
          subjectSelect.value = previousValue;
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
        subjectSelect.innerHTML = '<option value="">Unable to load subjects</option>';
      } finally {
        subjectSelect.disabled = subjectSelectWasDisabled ? true : wasDisabled;
      }
    }

    function buildRoomLabels(room) {
      const name = room.room_name?.trim();
      const number = room.room_number?.trim();
      const building = room.building_name?.trim();
      const displayParts = [];
      if (number) displayParts.push(number);
      if (name && name !== number) displayParts.push(name);
      if (building) displayParts.push(building);
      const displayLabel = displayParts.join(' • ') || number || name || `Room ${room.room_id}`;
      const locationValue = number || name || displayLabel;
      return { displayLabel, locationValue };
    }

    async function loadRoomOptions() {
      if (!labSelect && !locationSelect) return;

      const previousLocationValue = locationSelect ? locationSelect.value : '';

      if (labSelect) {
        labSelect.disabled = true;
        labSelect.innerHTML = '<option value="">Loading lab rooms...</option>';
      }
      if (locationSelect) {
        locationSelect.disabled = true;
        locationSelect.innerHTML = '<option value="">Loading rooms...</option>';
      }

      try {
        const res = await fetch('/api/academic-directory/rooms', { headers: SmartLab.Core.Auth.getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load rooms');
        const rooms = await res.json();
        cachedRooms = Array.isArray(rooms) ? rooms : [];

        if (labSelect) {
          populateLabOptions();
        }

        if (locationSelect) {
          renderLocationOptions({ previousValue: previousLocationValue });
          locationSelect.disabled = false;
        }
      } catch (err) {
        console.error('Failed to load rooms:', err);
        if (labSelect) {
          labSelect.innerHTML = '<option value="">Unable to load lab rooms</option>';
          labSelect.disabled = false;
        }
        if (locationSelect) {
          locationSelect.innerHTML = '<option value="">Unable to load rooms</option>';
          locationSelect.disabled = false;
          handleLocationSelectChange();
        }
      }
    }

    function populateLabOptions() {
      if (!labSelect) return;
      const labOptions = LAB_ROOM_NAMES.map((name) => {
        const match = cachedRooms.find((room) => {
          const normalized = (room.room_name || room.room_number || '').trim().toLowerCase();
          return normalized === name.toLowerCase();
        });
        if (match) {
          const { displayLabel, locationValue } = buildRoomLabels(match);
          return {
            label: displayLabel,
            roomId: match.room_id ? String(match.room_id) : '',
            locationValue
          };
        }
        return { label: name, roomId: '', locationValue: name };
      });

      labSelect.innerHTML = '<option value="">Select Laboratory</option>';
      labOptions.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.roomId || '';
        opt.textContent = option.label;
        if (option.locationValue) {
          opt.dataset.locationValue = option.locationValue;
        }
        if (option.roomId) {
          opt.dataset.roomId = option.roomId;
        } else {
          opt.disabled = true;
        }
        labSelect.appendChild(opt);
      });
      labSelect.disabled = false;
    }

    function renderLocationOptions({ previousValue = '' } = {}) {
      if (!locationSelect) return;
      const valueToRestore = previousValue || locationSelect.value;
      locationSelect.innerHTML = '<option value="">Select Location</option>';
      cachedRooms.forEach((room) => {
        const { displayLabel, locationValue } = buildRoomLabels(room);
        const option = document.createElement('option');
        option.value = room.room_id ? String(room.room_id) : '';
        option.textContent = displayLabel;
        option.dataset.roomId = room.room_id || '';
        option.dataset.locationValue = locationValue;
        locationSelect.appendChild(option);
      });

      if (valueToRestore) {
        const hasValue = Array.from(locationSelect.options || []).some((opt) => opt.value === valueToRestore);
        if (hasValue) {
          locationSelect.value = valueToRestore;
        }
      }

      handleLocationSelectChange();
    }

    function syncLocationWithLabSelection() {
      if (!labChk?.checked || !labSelect || !locationSelect) return;
      const selectedRoomId = labSelect.value || '';
      if (!selectedRoomId) {
        locationSelect.value = '';
        return;
      }

      const hasMatch = Array.from(locationSelect.options || []).some((opt) => opt.value === selectedRoomId);
      if (hasMatch) {
        locationSelect.value = selectedRoomId;
      }
    }

    // Load faculty/subject/program options on initialization
    loadFacultyOptions();
    loadProgramOptions();
    loadSubjectOptions();
    loadRoomOptions();

    // Lab checkbox toggle (faculty only)
    function handleLocationSelectChange() {
      if (!locationSelect || !locationCustomWrap) return;
      const isCustomSelected = !locationSelect.disabled && locationSelect.value === LOCATION_CUSTOM_VALUE;
      locationCustomWrap.classList.toggle("hidden", !isCustomSelected);
      if (locationCustomInput) {
        locationCustomInput.disabled = !isCustomSelected;
        if (!isCustomSelected) {
          locationCustomInput.value = "";
        }
      }
    }

    function toggleLab() {
      if (!labChk || !labSelectWrap) return;
      const on = !!labChk.checked;
      labSelectWrap.classList.toggle("hidden", !on);
      if (!on && labSelect) {
        labSelect.value = "";
      }
      if (locationSelect) {
        locationSelect.disabled = on;
        if (on) {
          syncLocationWithLabSelection();
        } else {
          renderLocationOptions();
        }
      }
      if (locationCustomInput) {
        locationCustomInput.disabled = true;
        locationCustomInput.value = "";
      }
      if (locationCustomWrap) {
        locationCustomWrap.classList.add("hidden");
      }
      if (!on) {
        handleLocationSelectChange();
      }
    }

    if (labChk) {
      labChk.addEventListener("change", () => {
        toggleLab();
        syncLocationWithLabSelection();
      });
      toggleLab();
    }

    labSelect?.addEventListener('change', () => {
      if (labChk?.checked) {
        syncLocationWithLabSelection();
      }
    });

    locationSelect?.addEventListener("change", handleLocationSelectChange);
    handleLocationSelectChange();

    function resetForm() {
      form.reset();
      if (labChk) toggleLab();
      if (subjectSelect && !subjectSelectWasDisabled) {
        subjectSelect.value = '';
      }
      if (programSelect && !programSelectWasDisabled) {
        programSelect.value = '';
      }
      
      // Re-apply faculty auto-fill if user is faculty
      if (facultyIdSelect && facultyIdSelect.disabled) {
        // Keep the faculty selection for faculty users
        const currentUserId = Number(sessionStorage.getItem("user_id"));
        if (currentUserId) {
          facultyIdSelect.value = currentUserId;
        }
      }
    }

    newBtn?.addEventListener("click", async () => {
      const ok = await SmartLab.Core.UI.confirm('Start a new request? Current form data will be cleared.', 'New Request', { type: 'info', confirmText: 'Start New' });
      if (ok) resetForm();
    });

    cancelBtn?.addEventListener("click", async () => {
      const ok = await SmartLab.Core.UI.confirm('Cancel this request? All entered data will be lost.', 'Cancel Request', { type: 'warning', confirmText: 'Yes, Cancel' });
      if (ok) resetForm();
    });

    // ===============================
    // Conflict checking (lab use)
    // ===============================
    let conflictChecker = null;
    const conflictContainerId = 'conflict-display';

    function setSubmitDisabled(blocked, reason = '') {
      if (!submitBtn) return;
      submitBtn.disabled = !!blocked;
      if (blocked && reason) submitBtn.title = reason; else submitBtn.removeAttribute('title');
    }

    function renderConflictClearFallback() {
      const container = document.getElementById(conflictContainerId);
      if (!container) return;
      container.style.display = 'block';
      container.innerHTML = '<div class="conflict-clear"><span>No conflicts found for the selected lab and time.</span></div>';
    }

    async function runConflictCheck() {
      const container = document.getElementById(conflictContainerId);
      if (!container) return;

      // Disable conflict checking for student role
      if (role === 'student') {
        container.style.display = 'none';
        container.innerHTML = '';
        setSubmitDisabled(false);
        return;
      }

      const useLab = !!labChk?.checked;
      const roomId = labSelect?.value || '';
      const labLabel = labSelect?.options?.[labSelect.selectedIndex]?.textContent || '';
      const date = dateNeeded?.value || '';
      const start = timeStart?.value || '';
      const end = timeEnd?.value || '';

      // Require lab selection + date + times
      if (!useLab || !roomId || !date || !start || !end) {
        container.style.display = 'none';
        container.innerHTML = '';
        setSubmitDisabled(false);
        return;
      }

      if (typeof ConflictChecker === 'undefined') {
        renderConflictClearFallback();
        return;
      }

      if (!conflictChecker || conflictChecker.container !== container) {
        conflictChecker = new ConflictChecker(conflictContainerId);
      }

      // Update loading state and disable submit until result
      conflictChecker.renderLoading();
      setSubmitDisabled(true, 'Checking for conflicts...');

      const result = await conflictChecker.checkDebounced({
        lab_room: labLabel || 'Selected Laboratory',
        room_id: roomId,
        date_needed: date,
        time_start: `${start}:00`,
        time_end: `${end}:00`,
        include_pending_requests: false,
        include_requests: false
      });

      if (!result || result.error) {
        setSubmitDisabled(false);
        return;
      }

      if (result.hasConflict) {
        const count = Array.isArray(result.conflicts) ? result.conflicts.length : 1;
        setSubmitDisabled(true, `${count} conflict${count > 1 ? 's' : ''} detected. Resolve before submitting.`);
      } else {
        setSubmitDisabled(false);
      }
    }

    // Watch relevant fields
    ['change', 'input'].forEach(evt => {
      [labChk, labSelect, dateNeeded, timeStart, timeEnd].forEach(el => {
        el?.addEventListener(evt, runConflictCheck);
      });
    });

    // Initial check after options load
    setTimeout(runConflictCheck, 300);
  }

  // Expose init globally for faculty and student pages
  window.RequestForm = {
    init
  };
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.BorrowForm = { init };
})();
