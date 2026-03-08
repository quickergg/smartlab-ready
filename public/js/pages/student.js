/* =========================================
   SmartLab – Faculty Panel Script (Updated)
   - Lab checkbox + dropdown
   - Multi equipment selection
========================================= */

(() => {
  try {
    // ---------- Core init ----------
    window.SmartLab.Auth.guardRole("Student");
    window.SmartLab.Auth.setWho();
    window.SmartLab.Auth.logoutSetup();
    setupTabs();

    // Load equipment and faculty profile dynamically
    loadEquipment();

    // ---------- Helpers ----------
    const formatDate = (d) => {
    if (window.SmartLab?.Utils?.formatDate) {
      return window.SmartLab.Utils.formatDate(d);
    }
    return d ? new Date(d).toISOString().slice(0, 10) : "-";
  };

  const escapeHtml = (v) => {
    if (window.SmartLab?.Utils?.escapeHtml) {
      return window.SmartLab.Utils.escapeHtml(v);
    }
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

    const showNotification = (message, type = 'info') => {
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification(message, type);
    } else {
      // Fallback to alert
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
    };

    // Format equipment display with quantities
  const formatEquipment = (equipmentList) => {
    if (!equipmentList || equipmentList.trim() === "") return "-";
    
    // The backend should already provide equipment in format "ItemName(quantity)"
    // But let's ensure it's displayed nicely
    const items = equipmentList.split(', ');
    const formattedItems = items.map(item => {
      // If item already has quantity in parentheses, keep it as is
      if (item.includes('(') && item.includes(')')) {
        return item;
      }
      // If no quantity, add (1) to show it's 1 unit
      return `${item}(1)`;
    });
    
    return formattedItems.join(', ');
  };

  const statusClass = (statusName = "") => {
      const s = String(statusName).toLowerCase();
      if (s.includes("approve")) return "status-approved";
      if (s.includes("decline")) return "status-declined";
      if (s.includes("cancel")) return "status-cancelled";
      return "status-pending";
    };

  // =========================
  // EQUIPMENT LOADING
  // =========================
  async function loadEquipment() {
    const container = document.getElementById("equipment-container");
    if (!container) return;

    try {
      const res = await fetch("/api/equipment");
      const equipment = await res.json();

      if (!res.ok) {
        throw new Error(equipment.message || "Failed to load equipment");
      }

      renderEquipment(equipment);
    } catch (err) {
      console.error("Failed to load equipment:", err);
      container.innerHTML = `
        <div class="error-message" style="color: red; padding: 10px;">
          Failed to load equipment. Please refresh the page.
        </div>
      `;
    }
  }

  function renderEquipment(equipment) {
    const container = document.getElementById("equipment-container");
    if (!container) return;

    if (!equipment || equipment.length === 0) {
      container.innerHTML = `
        <div class="no-equipment" style="padding: 10px; color: #666;">
          No equipment available at the moment.
        </div>
      `;
      return;
    }

    const equipmentHtml = equipment.map(item => {
      const isDisabled = item.available_qty <= 0;
      const disabledAttr = isDisabled ? 'disabled' : '';
      const disabledClass = isDisabled ? 'disabled' : '';
      const checkboxStyle = isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : '';
      
      return `
      <div class="equipment-item ${disabledClass}" style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; display: flex; align-items: center; justify-content: space-between; ${isDisabled ? 'background: #f9f9f9;' : ''}">
        <div style="display: flex; align-items: center; flex: 1;">
          <input type="checkbox" name="equipment_ids[]" value="${item.equipment_id}" 
                 onchange="toggleEquipmentQuantity(${item.equipment_id})" 
                 ${disabledAttr}
                 style="margin-right: 10px; ${checkboxStyle}" />
          <strong style="${isDisabled ? 'color: #999;' : ''}">${escapeHtml(item.equipment_name)}</strong>
          ${isDisabled ? '<span style="margin-left: 10px; color: #999; font-size: 12px;">(Out of Stock)</span>' : ''}
        </div>
        
        <div class="equipment-quantities" style="display: flex; align-items: center; gap: 15px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <label style="font-size: 12px; color: #666;">Available:</label>
            <input type="number" id="available-${item.equipment_id}" 
                   value="${item.available_qty}" disabled 
                   style="width: 60px; padding: 2px 4px; background: #f5f5f5; color: ${item.available_qty <= 0 ? '#ff4444;' : '#666;'}; border: 1px solid #ddd; font-size: 12px;" />
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <label style="font-size: 12px; color: #666;">Requested:</label>
            <input type="number" id="requested-${item.equipment_id}" 
                   name="requested_quantities[]" min="1" max="${item.available_qty}" 
                   placeholder="0" disabled
                   style="width: 60px; padding: 2px 4px; border: 1px solid #ddd; font-size: 12px;" 
                   onchange="validateRequestedQuantity(${item.equipment_id}, ${item.available_qty})" />
          </div>
        </div>
      </div>
    `;
    }).join("");

    container.innerHTML = equipmentHtml;
  }

  // =========================
  // C) LOAD FACULTY OPTIONS
  // =========================
  async function loadFacultyOptions() {
    if (!facultyIdSelect) {
      console.log('❌ facultyIdSelect element not found');
      return;
    }
    
    try {
      const response = await fetch('/api/faculty-list');
      const faculty = await response.json();
      
      console.log('🔍 Student Faculty Debug:', {
        facultyIdSelect: !!facultyIdSelect,
        facultyListLength: faculty?.length
      });
      
      // Clear existing options except the default
      facultyIdSelect.innerHTML = '<option value="">-- Select Faculty --</option>';
      
      // Add faculty options
      faculty.forEach(fac => {
        const option = document.createElement('option');
        option.value = fac.faculty_id;
        option.textContent = fac.full_name || `Faculty ${fac.faculty_id}`;
        facultyIdSelect.appendChild(option);
      });

      console.log('📋 Faculty list loaded for student:', faculty);
    } catch (err) {
      console.error('Failed to load faculty options:', err);
    }
  }

  // =========================
  // D) SUBMIT REQUEST FORM
  // =========================
  const form = document.getElementById("studentRequestForm");
  if (!form) return;

  const facultyInCharge = document.getElementById("facultyInCharge");
  const facultyIdSelect = document.getElementById("facultyIdSelect");
  const programSelect = document.getElementById("program-select");
  const yearSelect = document.getElementById("year-select");

  const subject = document.getElementById("subject");
  const dateNeeded = document.getElementById("dateNeeded");
  const locationInput = document.getElementById("location");
  const timeStart = document.getElementById("timeStart");
  const timeEnd = document.getElementById("timeEnd");
  const contactDetails = document.getElementById("contactDetails");
  const purpose = document.getElementById("purpose");

  const newBtn = document.getElementById("newRequestBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  function resetForm() {
    // Store auto-filled values before reset
    const programValue = programSelect?.value;
    const yearValue = yearSelect?.value;
    const isProgramDisabled = programSelect?.disabled;
    const isYearDisabled = yearSelect?.disabled;
    
    // Reset the form
    form.reset();
    
    // Restore auto-filled values if they were disabled (auto-filled)
    if (isProgramDisabled && programValue) {
      programSelect.value = programValue;
      programSelect.disabled = true;
      programSelect.style.backgroundColor = '#f5f5f5';
      programSelect.style.cursor = 'not-allowed';
    }
    
    if (isYearDisabled && yearValue) {
      yearSelect.value = yearValue;
      yearSelect.disabled = true;
      yearSelect.style.backgroundColor = '#f5f5f5';
      yearSelect.style.cursor = 'not-allowed';
    }
  }

  newBtn?.addEventListener("click", () => {
    if (confirm("Start a new request?")) resetForm();
  });

  cancelBtn?.addEventListener("click", () => {
    if (confirm("Cancel this request?")) resetForm();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const requested_by = Number(sessionStorage.getItem("user_id"));
    if (!requested_by) {
      alert("Session missing user_id. Please log in again.");
      return;
    }

    const program = programSelect?.value?.trim() || "";
    const year_level_raw = yearSelect?.value?.trim() || "";
    const year_level = year_level_raw ? Number(year_level_raw) : null;

    const fullName = facultyInCharge?.value?.trim() || "";
    const subj = subject?.value?.trim() || "";
    const date = dateNeeded?.value || "";
    const start = timeStart?.value || "";
    const end = timeEnd?.value || "";
    const contact = contactDetails?.value?.trim() || "";
    const purposeText = purpose?.value?.trim() || "";

    const manualLocation = locationInput?.value?.trim() || "";
    const location = manualLocation;

    // Get selected faculty
    let facultyId = facultyIdSelect?.value ? Number(facultyIdSelect.value) : null;
    let selectedFacultyName = facultyIdSelect?.options[facultyIdSelect?.selectedIndex]?.text || "";

    // Get selected equipment with requested quantities
    const selectedEquipment = Array.from(
      document.querySelectorAll('input[name="equipment_ids[]"]:checked')
    ).map(checkbox => {
      const equipmentId = Number(checkbox.value);
      const requestedQty = parseInt(document.getElementById(`requested-${equipmentId}`).value) || 0;
      return {
        equipment_id: equipmentId,
        requested_quantity: requestedQty
      };
    }).filter(item => item.requested_quantity > 0);

    const equipment_ids = selectedEquipment.map(item => item.equipment_id);

    // Validation
    if (!subj || !date || !start || !end || !contact || !purposeText) {
      alert("Please fill in all required fields.");
      return;
    }
    // Note: Program and year level are auto-filled from student profile, no validation needed
    if (!location) {
      alert("Please provide a Room / Location.");
      return;
    }
    if (!facultyId) {
      alert("Please select a faculty in charge.");
      return;
    }
    if (selectedEquipment.length === 0) {
      alert("Please select at least one equipment item.");
      return;
    }

    const combinedPurpose = `${purposeText}` + `\nFaculty In Charge: ${selectedFacultyName}`;

    const payload = {
      requested_by,
      lab_schedule_id: null,
      subject: subj,
      program,
      year_level,
      date_needed: date,
      location,
      time_of_use: start,
      time_start: start,
      time_end: end,
      contact_details: contact,
      purpose: combinedPurpose,
      status_id: 1,
      academic_year_id: null,
      term_id: null,
      equipment_ids,
      equipment_details: selectedEquipment, // Include equipment with quantities
      faculty_id: facultyId
    };

    try {
      const res = await fetch("/api/borrowRequests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Failed to submit request.");
        console.error("Request error:", data);
        return;
      }

      alert(data.message || "Request submitted successfully.");
      resetForm();

      // refresh history automatically
      await loadMyRequests();

      // Load academic context
      async function loadAcademicContext() {
        try {
          const academicResponse = await fetch('/api/activeAcademicContext');
          if (academicResponse.ok) {
            const academicData = await academicResponse.json();
            updateAcademicContext(academicData);
          } else {
            // Fallback to current academic year if API fails
            updateAcademicContext({
              academic_year: '2025-2026',
              term: '1st Semester'
            });
          }
        } catch (err) {
          console.error('Failed to load academic context:', err);
          // Fallback values
          updateAcademicContext({
            academic_year: '2025-2026',
            term: '1st Semester'
          });
        }
      }

      // Update academic context in the header
      function updateAcademicContext(data) {
        const academicYearElement = document.getElementById('academic-year');
        const semesterElement = document.getElementById('semester');

        if (academicYearElement) {
          academicYearElement.innerHTML = `Academic Year ${data.academic_year || '2025-2026'} <span> | </span>`;
        }

        if (semesterElement) {
          semesterElement.innerHTML = `<strong>${data.term || '1st Semester'}</strong>`;
        }
      }

      // Initialize
      loadAcademicContext();
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error. Please check your connection and try again.");
    }
  });

  // =========================
  // B) LOAD MY REQUESTS TABLE
  // =========================
  async function loadMyRequests() {
    const tbody = document.getElementById("my-requests-tbody");
    if (!tbody) return;
  
    const userId = Number(sessionStorage.getItem("user_id"));
    console.log("Loading requests for user_id:", userId);
    
    if (!userId) {
      tbody.innerHTML = `<tr><td colspan="7">Session expired. Please log in again.</td></tr>`;
      return;
    }
  
    tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;
  
    try {
      const res = await fetch(`/api/myBorrowRequests/my/${userId}`);
      console.log("API response status:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error:", errorData);
        tbody.innerHTML = `<tr><td colspan="7">Error: ${errorData.message || 'Server error'}</td></tr>`;
        return;
      }
      
      const rows = await res.json().catch(() => []);
      console.log("API response data:", rows);
    
      if (!Array.isArray(rows)) {
        console.error("Invalid response format:", rows);
        tbody.innerHTML = `<tr><td colspan="7">Invalid server response.</td></tr>`;
        return;
      }
    
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No requests found.</td></tr>`;
        return;
      }
    
      console.log('🔍 Student Requests Debug:', {
        userId,
        requestsCount: rows.length,
        sampleRequest: rows[0] ? {
          borrow_request_id: rows[0].borrow_request_id,
          equipment_list: rows[0].equipment_list,
          particulars: rows[0].particulars,
          location: rows[0].location,
          date_needed: rows[0].date_needed,
          time_start: rows[0].time_start,
          time_end: rows[0].time_end,
          note: rows[0].note,
          status_name: rows[0].status_name
        } : 'No requests'
      });
    
      tbody.innerHTML = rows
        .map((r) => {
          // Extract time information (same as faculty)
          const start = (r.time_start || r.time_of_use) ? String(r.time_start || r.time_of_use).slice(0, 5) : "-";
          const end = r.time_end ? String(r.time_end).slice(0, 5) : "";
          const timeRange = end ? `${start} - ${end}` : start;
          
          // Extract room/location information
          const room = r.location || "-";
          
          // Extract equipment information (same as faculty)
          let equipment = "-";
          if (r.equipment_list && r.equipment_list.trim()) {
            equipment = formatEquipment(r.equipment_list);
            console.log('🔍 Equipment from equipment_list:', equipment);
          } else if (r.particulars) {
            // Extract equipment from particulars if equipment_list is empty
            const parts = r.particulars.split(', ');
            if (parts.length > 1) {
              equipment = formatEquipment(parts.slice(1).join(', ')); // Skip location, get equipment
              console.log('🔍 Equipment from particulars:', equipment);
            }
          }
          
          // Extract note information
          const note = r.note && String(r.note).trim() ? String(r.note).trim() : "-";
          
          // Get status information
          const statusName = r.status_name || "Pending";
        
          return `
            <tr>
              <td>${escapeHtml(formatDate(r.created_at))}</td>
              <td>${escapeHtml(room)}</td>
              <td>${escapeHtml(equipment)}</td>
              <td>${escapeHtml(formatDate(r.date_needed))}</td>
              <td>${escapeHtml(timeRange)}</td>
              <td>${escapeHtml(note)}</td>
              <td>
                <span class="pill ${escapeHtml(statusClass(statusName))}">
                  ${escapeHtml(statusName)}
                </span>
              </td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      console.error("Network error:", err);
      tbody.innerHTML = `<tr><td colspan="7">Network error. Please check your connection.</td></tr>`;
    }
  }

  // Load academic context
  async function loadAcademicContext() {
    try {
      const academicResponse = await fetch('/api/activeAcademicContext');
      if (academicResponse.ok) {
        const academicData = await academicResponse.json();
        updateAcademicContext(academicData);
      } else {
        // Fallback to current academic year if API fails
        updateAcademicContext({
          academic_year: '2025-2026',
          term: '1st Semester'
        });
      }
    } catch (err) {
      console.error('Failed to load academic context:', err);
      // Fallback values
      updateAcademicContext({
        academic_year: '2025-2026',
        term: '1st Semester'
      });
    }
  }

  // Update academic context in the header
  function updateAcademicContext(data) {
    const academicYearElement = document.getElementById('academic-year');
    const semesterElement = document.getElementById('semester');

    if (academicYearElement) {
      academicYearElement.innerHTML = `Academic Year ${data.academic_year || '2025-2026'} <span> | </span>`;
    }

    if (semesterElement) {
      semesterElement.innerHTML = `<strong>${data.term || '1st Semester'}</strong>`;
    }
  }
  
  // Load user information and academic context
  async function loadUserInfo() {
    try {
      // Get user info from session storage
      const userId = sessionStorage.getItem('userId');
      const userRole = sessionStorage.getItem('role_name');
      const firstName = sessionStorage.getItem('firstName') || sessionStorage.getItem('first_name');
      const lastName = sessionStorage.getItem('lastName') || sessionStorage.getItem('last_name');
      const gmail = sessionStorage.getItem('gmail');

      console.log('Loading user info:', { userId, firstName, lastName, gmail });

      // Update user fullname
      const fullnameElement = document.getElementById('user-fullname');
      if (fullnameElement) {
        if (firstName && lastName) {
          fullnameElement.textContent = `${firstName} ${lastName}`;
        } else if (gmail) {
          fullnameElement.textContent = gmail.split('@')[0]; // Use part before @ as fallback
        } else {
          fullnameElement.textContent = 'Student';
        }
      }

  // =========================
  // F) EQUIPMENT QUANTITY FUNCTIONS
  // =========================
  function toggleEquipmentQuantity(equipmentId) {
    const requestedInput = document.getElementById(`requested-${equipmentId}`);
    if (requestedInput) {
      const checkbox = document.querySelector(`input[name="equipment_ids[]"][value="${equipmentId}"]`);
      requestedInput.disabled = !checkbox.checked;
      if (!checkbox.checked) {
        requestedInput.value = '';
      }
    }
  }

  function validateRequestedQuantity(equipmentId, availableQty) {
    const requestedInput = document.getElementById(`requested-${equipmentId}`);
    const requestedQty = parseInt(requestedInput.value) || 0;
    
    if (requestedQty < 1) {
      requestedInput.value = 1;
    } else if (requestedQty > availableQty) {
      requestedInput.value = availableQty;
      alert(`Only ${availableQty} units available for this equipment.`);
    }
  }

  // Make functions globally accessible for onclick handlers
  window.toggleEquipmentQuantity = toggleEquipmentQuantity;
  window.validateRequestedQuantity = validateRequestedQuantity;

  // Auto-fill program and year level for student users
  await autoFillProgramAndYearForCurrentUser();

  // Load academic context from API
  const academicResponse = await fetch('/api/activeAcademicContext');
  if (academicResponse.ok) {
    const academicData = await academicResponse.json();
    updateAcademicContext(academicData);
  } else {
    // Fallback to current academic year if API fails
    updateAcademicContext({
      academic_year: '2025-2026',
      term: '1st Semester'
    });
  }
    } catch (err) {
      console.error('Failed to load user info:', err);
      // Fallback values
      document.getElementById('user-fullname').textContent = 'Student';
      updateAcademicContext({
        academic_year: '2025-2026',
        term: '1st Semester'
      });
    }
  }

  // Auto-fill program and year level for current student user
  async function autoFillProgramAndYearForCurrentUser() {
    try {
      const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
      
      if (!userId) {
        console.log('🔍 No user ID found for auto-fill');
        return;
      }

      console.log('🔍 Auto-filling program and year for student user:', userId);

      // Fetch user profile (includes student profile data)
      const profileResponse = await fetch(`/api/users/${userId}`);
      
      if (!profileResponse.ok) {
        console.log('🔍 User profile not found');
        return;
      }

      const profileData = await profileResponse.json();
      console.log('🔍 User profile data:', profileData);

      // Get program and year level from student profile
      const program = profileData.program;
      const yearLevel = profileData.year_level;

      // Auto-fill and disable program dropdown
      if (program && programSelect) {
        programSelect.value = program;
        programSelect.disabled = true;
        programSelect.style.backgroundColor = '#f5f5f5';
        programSelect.style.cursor = 'not-allowed';
        console.log('🔍 Auto-filled program:', program);
      }

      // Auto-fill and disable year level dropdown
      if (yearLevel && yearSelect) {
        yearSelect.value = yearLevel.toString();
        yearSelect.disabled = true;
        yearSelect.style.backgroundColor = '#f5f5f5';
        yearSelect.style.cursor = 'not-allowed';
        console.log('🔍 Auto-filled year level:', yearLevel);
      }

      // Add visual indicators
      if (program && yearLevel) {
        const programLabel = programSelect.previousElementSibling;
        const yearLabel = yearSelect.previousElementSibling;
        
        if (programLabel) {
          programLabel.innerHTML += ' <span style="color: #666; font-size: 12px;">(Auto-filled from profile)</span>';
        }
        if (yearLabel) {
          yearLabel.innerHTML += ' <span style="color: #666; font-size: 12px;">(Auto-filled from profile)</span>';
        }
      }

    } catch (err) {
      console.error('🔍 Error auto-filling program and year:', err);
    }
  }

  // Update academic context in the header
  function updateAcademicContext(data) {
    const academicYearElement = document.getElementById('academic-year');
    const semesterElement = document.getElementById('semester');

    if (academicYearElement) {
      academicYearElement.innerHTML = `Academic Year ${data.academic_year || '2025-2026'} <span> | </span>`;
    }

    if (semesterElement) {
      semesterElement.innerHTML = `<strong>${data.term || '1st Semester'}</strong>`;
    }
  }

  // Call once on load
    loadEquipment();
    loadFacultyOptions();
    loadMyRequests();
    loadAcademicContext();
    loadUserInfo();
    
  } catch (err) {
    console.error("Student script error:", err);
    alert("An error occurred while loading the student dashboard. Please refresh the page.");
  }
})();
