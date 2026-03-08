// Role check
const currentUserRole = sessionStorage.getItem("role") || "";
const isAdmin = currentUserRole.toLowerCase() === "admin";

console.log('🔍 ManageLabSchedule Debug:', {
  currentUserRole,
  isAdmin,
  pageUrl: window.location.pathname
});

// Global cache
let allSchedules = [];
let currentAcademicContext = null;

// Load current academic context
async function loadAcademicContext() {
  try {
    const res = await fetch('/api/activeAcademicContext');
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'Failed to load academic context');
    }
    
    currentAcademicContext = {
      academic_year_id: data.academic_year_id,
      academic_year: data.academic_year,
      term_id: data.term_id,
      term: data.term
    };
    
    console.log('Academic context loaded:', currentAcademicContext);
  } catch (err) {
    console.error('Failed to load academic context:', err);
    // Set default values if loading fails
    currentAcademicContext = {
      academic_year_id: 1,  // Default ID
      academic_year: '2025-2026',
      term_id: 1,  // Default ID
      term: '1st Semester'
    };
  }
}

// Schedule Conflict Detection
function checkScheduleConflict(newSchedule) {
  console.log('🔍 Checking conflict for new schedule:', newSchedule);
  console.log('📊 Total existing schedules:', allSchedules.length);
  
  return allSchedules.find((existing, index) => {
    console.log(`\n🔍 Checking schedule ${index + 1}:`, existing);
    
    // Check if same laboratory, same day, same academic year, and same term
    if (existing.lab_room !== newSchedule.lab_room) {
      console.log('❌ Different lab - no conflict');
      return false;
    }
    
    if (existing.day_of_week !== newSchedule.day_of_week) {
      console.log('❌ Different day - no conflict');
      return false;
    }
    
    // Handle missing academic context in existing schedules
    const existingAcademicYear = existing.academic_year || currentAcademicContext?.academic_year || '2025-2026';
    const existingTerm = existing.term || currentAcademicContext?.term || '1st Semester';
    
    console.log('📅 Academic Year Comparison:');
    console.log('  Existing:', existingAcademicYear);
    console.log('  New:', newSchedule.academic_year);
    
    console.log('📚 Term Comparison:');
    console.log('  Existing:', existingTerm);
    console.log('  New:', newSchedule.term);
    
    if (existingAcademicYear !== newSchedule.academic_year) {
      console.log('❌ Different academic year - no conflict');
      return false;
    }
    
    if (existingTerm !== newSchedule.term) {
      console.log('❌ Different term - no conflict');
      return false;
    }

    // Convert time strings to minutes for comparison
    const existingStart = timeToMinutes(existing.time_start);
    const existingEnd = timeToMinutes(existing.time_end);
    const newStart = timeToMinutes(newSchedule.time_start);
    const newEnd = timeToMinutes(newSchedule.time_end);

    console.log('⏰ Time Comparison:');
    console.log('  Existing:', existing.time_start, '-', existing.time_end, `(${existingStart}-${existingEnd})`);
    console.log('  New:', newSchedule.time_start, '-', newSchedule.time_end, `(${newStart}-${newEnd})`);

    // Check for time overlap
    const hasConflict = (newStart < existingEnd && newEnd > existingStart);
    console.log('🎯 Time Overlap Result:', hasConflict);
    
    if (hasConflict) {
      console.log('🚨 CONFLICT DETECTED!');
    } else {
      console.log('✅ No time overlap');
    }
    
    return hasConflict;
  });
}

// Check conflicts for edit (exclude current schedule)
function checkEditScheduleConflict(newSchedule, excludeId) {
  return allSchedules.find(existing => {
    // Skip the current schedule being edited
    if (existing.schedule_id === excludeId) {
      return false;
    }

    // Check if same laboratory, same day, same academic year, and same term
    if (existing.lab_room !== newSchedule.lab_room || 
        existing.day_of_week !== newSchedule.day_of_week ||
        existing.academic_year !== newSchedule.academic_year ||
        existing.term !== newSchedule.term) {
      return false;
    }

    // Convert time strings to minutes for comparison
    const existingStart = timeToMinutes(existing.time_start);
    const existingEnd = timeToMinutes(existing.time_end);
    const newStart = timeToMinutes(newSchedule.time_start);
    const newEnd = timeToMinutes(newSchedule.time_end);

    // Check for time overlap
    return (newStart < existingEnd && newEnd > existingStart);
  });
}

// Convert time string (HH:MM AM/PM) to minutes since midnight
function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

function getScheduleTbodyId() {
  const adminTbody = document.getElementById("lab-schedule-body-admin");
  const normalTbody = document.getElementById("lab-schedule-body");

  console.log('🔍 Tbody elements:', {
    adminTbody: !!adminTbody,
    normalTbody: !!normalTbody,
    isAdmin
  });

  if (isAdmin && adminTbody) {
    console.log('✅ Using admin tbody');
    return "lab-schedule-body-admin";
  }
  if (normalTbody) {
    console.log('✅ Using normal tbody');
    return "lab-schedule-body";
  }
  if (adminTbody) {
    console.log('✅ Using admin tbody (fallback)');
    return "lab-schedule-body-admin";
  }
  console.error('❌ No tbody element found');
  return null;
}

function getCreatedBy() {
  const id = sessionStorage.getItem("user_id");
  return id ? Number(id) : null;
}

// --------------------------
// Add Schedule (Admin Only)
// --------------------------
(function () {
  const form = document.getElementById("add-schedule-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const created_by = getCreatedBy();
    if (!created_by || !isAdmin) {
      alert("You must be logged in as admin to create schedules.");
      return;
    }

    const faculty_id_raw = document.getElementById("sched-faculty-id")?.value;

    const payload = {
      lab_room: document.getElementById("sched-lab")?.value,
      faculty_id: faculty_id_raw ? Number(faculty_id_raw) : null,
      program: document.getElementById("sched-section")?.value,
      year_level: Number(document.getElementById("sched-year")?.value),
      subject: document.getElementById("sched-subject")?.value?.trim(),
      day_of_week: document.getElementById("sched-day")?.value,
      time_start: document.getElementById("sched-start")?.value + ":00",  // Add :00 to make it HH:MM:SS
      time_end: document.getElementById("sched-end")?.value + ":00",    // Add :00 to make it HH:MM:SS
      academic_year_id: currentAcademicContext?.academic_year_id || 1,
      term_id: currentAcademicContext?.term_id || 1,
      academic_year: currentAcademicContext?.academic_year || '2025-2026',  // Add for conflict detection
      term: currentAcademicContext?.term || '1st Semester',                // Add for conflict detection
      created_by
    };

    console.log('📝 New schedule payload:', payload);
    console.log('🎓 Current academic context:', currentAcademicContext);

    if (!payload.lab_room || !payload.faculty_id || !payload.subject || !payload.day_of_week || !payload.time_start || !payload.time_end) {
      alert("Please complete all required fields.");
      return;
    }

    if (payload.time_end <= payload.time_start) {
      alert("End time must be after start time.");
      return;
    }

    // Check for schedule conflicts
    console.log('🔍 Checking conflict for new schedule...');
    const conflict = checkScheduleConflict(payload);
    console.log('🔍 Conflict result:', conflict);
    if (conflict) {
      alert(`Schedule conflict detected!\n\nLaboratory: ${conflict.lab_room}\nDay: ${conflict.day_of_week}\nTime: ${conflict.time_start} - ${conflict.time_end}\nSubject: ${conflict.subject}\n\nThis time slot is already booked.`);
      return;
    }

    try {
      const res = await fetch("/api/labSchedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.error("Create schedule failed:", data);
        alert(data.message || "Failed to create schedule");
        return;
      }

      alert("Schedule saved. ID: " + data.schedule_id);

      form.reset();

      const modal = document.getElementById("modal-add-schedule");
      if (modal) modal.classList.add("hidden");

      await loadLabSchedules();
    } catch (err) {
      console.error(err);
      alert("Server error. Try again.");
    }
  });
})();
// Faculty Dropdown (Admin Modal)
async function loadFacultyDropdown() {
  try {
    const res = await fetch("/api/faculty-list");
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log('🔍 Faculty API response:', { status: res.status, data });

    // Handle case where data might be a string instead of array
    let faculty = data;
    if (typeof data === 'string') {
      console.log('🔍 Faculty data is string, parsing JSON...');
      faculty = JSON.parse(data);
    }

    const facultySelect = document.getElementById("sched-faculty-id");
    if (facultySelect) {
      facultySelect.innerHTML = '<option value="">All Faculty</option>';

      faculty.forEach(fac => {
        const option = document.createElement("option");
        option.value = fac.faculty_id;
        option.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
        facultySelect.appendChild(option);
      });
    }

    // Also populate edit modal faculty dropdown
    const editFacultySelect = document.getElementById("edit-sched-faculty-id");
    if (editFacultySelect) {
      editFacultySelect.innerHTML = '<option value="">Select Faculty</option>';
      
      faculty.forEach(fac => {
        const option = document.createElement("option");
        option.value = fac.faculty_id;
        option.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
        editFacultySelect.appendChild(option);
      });
    }

    console.log(`✅ Loaded ${faculty.length} faculty members`);
  } catch (err) {
    console.error("Failed to load faculty list:", err);
    alert("Unable to load faculty list.");
  }
}

// --------------------------
// Load Lab Schedules
// --------------------------
async function loadLabSchedules() {
  try {
    console.log('🔍 Loading lab schedules...');
    const res = await fetch("/api/labSchedule");
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log('🔍 Lab schedules response:', { status: res.status, data });

    // Handle case where data might be a string instead of array
    let schedules = data;
    if (typeof data === 'string') {
      console.log('🔍 Data is string, parsing JSON...');
      schedules = JSON.parse(data);
    }

    allSchedules = Array.isArray(schedules) ? schedules : [];
    console.log('🔍 Schedules loaded:', allSchedules.length, 'schedules');

    const tbodyId = getScheduleTbodyId();
    console.log('🔍 Using tbody ID:', tbodyId);
    if (!tbodyId) {
      console.error('❌ No tbody element found');
      return;
    }

    renderLabScheduleTable(allSchedules, tbodyId);
  } catch (err) {
    console.error('❌ Error loading lab schedules:', err);
    alert("Unable to load lab schedules.");
  }
}

// --------------------------
// Render Table
// --------------------------
function renderLabScheduleTable(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) {
    console.error(`❌ Tbody element not found: ${tbodyId}`);
    return;
  }

  console.log(`🔍 Rendering table with ${data.length} schedules in tbody: ${tbodyId}`);

  tbody.innerHTML = "";

  const showActions = isAdmin && tbodyId === "lab-schedule-body-admin";

  if (!data || data.length === 0) {
    const colSpan = showActions ? 9 : 8;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" style="text-align:center;">
          No schedules found
        </td>
      </tr>
    `;
    console.log('✅ Rendered "No schedules found" message');
    return;
  }

  console.log('🔍 Rendering schedule rows...');
  data.forEach((row, index) => {
    const tr = document.createElement("tr");

    const facultyDisplay = row.faculty_name || "—";

    const actionCell = showActions
      ? `
        <td>
          <button class="btn btnSmall btn-edit" data-id="${row.schedule_id}">Edit</button>
          <button class="btn btnSmall btnDanger btn-delete" data-id="${row.schedule_id}">Delete</button>
        </td>
      `
      : "";

    tr.innerHTML = `
      <td>${row.lab_room ?? ""}</td>
      <td>${facultyDisplay}</td>
      <td>${row.program ?? ""}</td>
      <td>${row.year_level ?? ""}</td>
      <td>${row.subject ?? ""}</td>
      <td>${row.day_of_week ?? ""}</td>
      <td>${formatTime(row.time_start)}</td>
      <td>${formatTime(row.time_end)}</td>
      ${actionCell}
    `;

    tbody.appendChild(tr);
  });
}

function formatTime(time) {
  return time ? String(time).substring(0, 5) : "";
}

// --------------------------
// Filter
// --------------------------
function setupLabFilter() {
  const filter = document.getElementById("lab-filter");
  if (!filter) return;

  filter.addEventListener("change", (e) => {
    const selected = e.target.value; // "Lab 1" | "Lab 2" | "Lab 3" | "all"

    const filtered =
      selected === "all"
        ? allSchedules
        : allSchedules.filter((s) => String(s.lab_room) === String(selected));

    const tbodyId = getScheduleTbodyId();
    if (!tbodyId) return;

    renderLabScheduleTable(filtered, tbodyId);
  });
}

// --------------------------
// Modal open handlers
// --------------------------
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-add-schedule") {
    const modal = document.getElementById("modal-add-schedule");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
    }
  }
  if (e.target.id === "btn-add-equipment") {
    const modal = document.getElementById("modal-add-equipment");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
    }
  }
});

// --------------------------
// Modal close handlers
// --------------------------
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("close-modal-sched")) {
    const modal = document.getElementById("modal-add-schedule");
    if (modal) modal.classList.add("hidden");
  }
  if (e.target.classList.contains("close-modal-edit-sched")) {
    const modal = document.getElementById("modal-edit-schedule");
    if (modal) modal.classList.add("hidden");
  }
  if (e.target.classList.contains("close-modal-equipment")) {
    const modal = document.getElementById("modal-add-equipment");
    if (modal) modal.classList.add("hidden");
  }
});

// --------------------------
// Edit/Delete actions (admin only)
// --------------------------
function setupScheduleActions() {
  document.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".btn-edit");
    const deleteBtn = e.target.closest(".btn-delete");
    if (!editBtn && !deleteBtn) return;

    const id = Number(e.target.dataset.id);
    if (!id) return;

    if (editBtn) {
      // Populate edit modal and show it
      const schedule = allSchedules.find(s => s.schedule_id === id);
      if (!schedule) return;

      const modal = document.getElementById("modal-edit-schedule");
      if (!modal) {
        alert("Edit modal not found.");
        return;
      }

      // Ensure faculty dropdown is populated
      await loadFacultyDropdown();

      // Populate fields
      document.getElementById("edit-sched-id").value = schedule.schedule_id;
      document.getElementById("edit-sched-lab").value = schedule.lab_room || "";
       
      // Debug: Log the faculty_id value
      console.log('🔍 Debug - Schedule data:', schedule);
      console.log('🔍 Debug - faculty_id:', schedule.faculty_id);
      console.log('🔍 Debug - faculty_name:', schedule.faculty_name);
      
      document.getElementById("edit-sched-faculty-id").value = schedule.faculty_id || "";
      document.getElementById("edit-sched-section").value = schedule.program || "";
      document.getElementById("edit-sched-year").value = schedule.year_level || "";
      document.getElementById("edit-sched-subject").value = schedule.subject || "";
      document.getElementById("edit-sched-day").value = schedule.day_of_week || "";
      document.getElementById("edit-sched-start").value = schedule.time_start || "";
      document.getElementById("edit-sched-end").value = schedule.time_end || "";

      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
      return;
    }

    if (deleteBtn) {
      if (!confirm("Delete this schedule? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/labSchedule/${id}`, {
          method: "DELETE"
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || "Failed to delete schedule");
        }
        
        alert("Schedule deleted.");
        await loadLabSchedules();
      } catch (err) {
        console.error(err);
        alert("Failed to delete schedule.");
      }
    }
  });
}

// --------------------------
// Edit schedule form submit
// --------------------------
(function () {
  const form = document.getElementById("edit-schedule-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById("edit-sched-id")?.value);
    if (!id) return;

    const payload = {
      lab_room: document.getElementById("edit-sched-lab")?.value,
      faculty_id: document.getElementById("edit-sched-faculty-id")?.value ? Number(document.getElementById("edit-sched-faculty-id").value) : null,
      program: document.getElementById("edit-sched-section")?.value,
      year_level: Number(document.getElementById("edit-sched-year")?.value),
      subject: document.getElementById("edit-sched-subject")?.value,
      day_of_week: document.getElementById("edit-sched-day")?.value,
      time_start: document.getElementById("edit-sched-start")?.value + ":00",  // Add :00 to make it HH:MM:SS
      time_end: document.getElementById("edit-sched-end")?.value + ":00",    // Add :00 to make it HH:MM:SS
      academic_year_id: currentAcademicContext?.academic_year_id || 1,
      term_id: currentAcademicContext?.term_id || 1,
      academic_year: currentAcademicContext?.academic_year || '2025-2026',  // Add for conflict detection
      term: currentAcademicContext?.term || '1st Semester'                // Add for conflict detection
    };

    // Debug: Log the payload
    console.log('🔍 Debug - Edit payload:', payload);
    console.log('🔍 Debug - faculty_id value:', payload.faculty_id);
    console.log('🔍 Debug - faculty_id type:', typeof payload.faculty_id);
    console.log('🔍 Debug - academic_year_id:', payload.academic_year_id);
    console.log('🔍 Debug - term_id:', payload.term_id);

    // Validate required fields before sending
    const requiredFields = ['lab_room', 'faculty_id', 'subject', 'day_of_week', 'time_start', 'time_end', 'academic_year_id', 'term_id'];
    const missingFields = requiredFields.filter(field => {
      const value = payload[field];
      const isMissing = !value || value === '' || value === null || value === undefined;
      if (isMissing) {
        console.log(`🔍 Debug - Field ${field} is missing:`, value, typeof value);
      }
      return isMissing;
    });
    
    if (missingFields.length > 0) {
      console.error('🔍 Debug - Missing fields:', missingFields);
      alert(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate time
    if (payload.time_end <= payload.time_start) {
      alert("End time must be after start time.");
      return;
    }

    // Check for schedule conflicts (exclude current schedule from check)
    const conflict = checkEditScheduleConflict(payload, id);
    if (conflict) {
      alert(`Schedule conflict detected!\n\nLaboratory: ${conflict.lab_room}\nDay: ${conflict.day_of_week}\nTime: ${conflict.time_start} - ${conflict.time_end}\nSubject: ${conflict.subject}\n\nThis time slot is already booked.`);
      return;
    }

    try {
      console.log('🔍 Debug - Sending payload to backend:', JSON.stringify(payload, null, 2));
      
      const res = await fetch(`/api/labSchedule/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      console.log('🔍 Debug - Update response status:', res.status);
      console.log('🔍 Debug - Update response data:', data);
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to update schedule");
      }
      
      alert("Schedule updated.");
      const modal = document.getElementById("modal-edit-schedule");
      if (modal) modal.classList.add("hidden");
      await loadLabSchedules();
    } catch (err) {
      console.error('🔍 Debug - Update error:', err);
      console.error('🔍 Debug - Error message:', err.message);
      alert("Failed to update schedule: " + err.message);
    }
  });
})();

// Add manual trigger for debugging (remove in production)
window.debugLabSchedules = () => {
  console.log('🔧 Manual lab schedule debug trigger');
  loadLabSchedules();
};

// --------------------------
// Init
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadAcademicContext();  // Load academic context first
  loadFacultyDropdown();
  setupLabFilter();
  loadLabSchedules();
  setupScheduleActions();
});
