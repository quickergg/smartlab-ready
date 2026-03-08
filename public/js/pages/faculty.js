/* =========================================
   SmartLab – Faculty Panel Script (Updated)
   - Lab checkbox + dropdown
   - Multi equipment selection
========================================= */

(() => {
  // ---------- Core init ----------
  window.SmartLab.Auth.guardRole("Faculty");
  window.SmartLab.Auth.setWho();
  window.SmartLab.Auth.logoutSetup();
  setupTabs();
  
  // Load equipment and faculty profile dynamically
  loadEquipment();
  loadFacultyProfile();

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
  // FACULTY PROFILE LOADING
  // =========================
  async function loadFacultyProfile() {
    const facultyInChargeInput = document.getElementById("facultyInCharge");
    if (!facultyInChargeInput) return;

    try {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) {
        console.error("No user_id found in session");
        return;
      }

      const res = await fetch(`/api/users/${userId}`);
      const userData = await res.json();

      if (!res.ok) {
        throw new Error(userData.message || "Failed to load faculty profile");
      }

      // Set the faculty name from the profile
      if (userData.full_name) {
        facultyInChargeInput.value = userData.full_name;
      } else {
        facultyInChargeInput.value = "Loading...";
        console.warn("No full_name found for faculty user");
      }
    } catch (err) {
      console.error("Failed to load faculty profile:", err);
      facultyInChargeInput.value = "Error loading name";
    }
  }

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

  // Make functions globally available
  window.toggleEquipmentQuantity = function(equipmentId) {
    const checkbox = document.querySelector(`input[name="equipment_ids[]"][value="${equipmentId}"]`);
    const requestedInput = document.getElementById(`requested-${equipmentId}`);
    
    if (checkbox && requestedInput) {
      if (checkbox.checked) {
        requestedInput.disabled = false;
        requestedInput.value = "1"; // Default to 1
      } else {
        requestedInput.disabled = true;
        requestedInput.value = "";
      }
    }
  };

  window.validateRequestedQuantity = function(equipmentId, availableQty) {
    const requestedInput = document.getElementById(`requested-${equipmentId}`);
    const requestedValue = parseInt(requestedInput.value) || 0;
    
    if (requestedValue < 1) {
      requestedInput.value = "1";
    } else if (requestedValue > availableQty) {
      requestedInput.value = availableQty;
      showNotification(`Cannot request more than ${availableQty} available units.`, 'warning');
    }
  };

  // =========================
  // A) SUBMIT REQUEST FORM
  // =========================
  const form = document.getElementById("facultyRequestForm");
  if (!form) return;

  const labChk = document.getElementById("labChk");
  const labSelectWrap = document.getElementById("labSelectWrap");
  const labSelect = document.getElementById("labSelect");

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

  // Load faculty options and auto-fill for faculty users
  async function loadFacultyOptions() {
    if (!facultyIdSelect) {
      console.log('❌ facultyIdSelect element not found');
      return;
    }
    
    try {
      const response = await fetch('/api/faculty-list');
      const faculty = await response.json();
      
      const currentUserId = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
      const currentUserRole = sessionStorage.getItem("role_name") || sessionStorage.getItem("user_role");
      
      console.log('🔍 Faculty Debug:', {
        currentUserId,
        currentUserRole,
        facultyIdSelect: !!facultyIdSelect,
        facultyListLength: faculty?.length,
        sessionKeys: {
          userId: sessionStorage.getItem("userId"),
          user_id: sessionStorage.getItem("user_id"),
          role_name: sessionStorage.getItem("role_name"),
          user_role: sessionStorage.getItem("user_role"),
          role: sessionStorage.getItem("role")  // Add this key
        }
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

      console.log('📋 Faculty list loaded:', faculty);

      // Check if current user is faculty and auto-fill
      await autoFillFacultyForCurrentUser(faculty);
    } catch (err) {
      console.error('Failed to load faculty options:', err);
    }
  }

  // Auto-fill faculty field if current user is a faculty member
  async function autoFillFacultyForCurrentUser(facultyList) {
    const currentUserId = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
    const currentUserRole = sessionStorage.getItem("role_name") || 
                           sessionStorage.getItem("user_role") || 
                           sessionStorage.getItem("role");  // Add this fallback
    
    console.log('🔍 Auto-fill Debug:', {
      currentUserId,
      currentUserRole,
      facultyIdSelect: !!facultyIdSelect,
      facultyListLength: facultyList?.length
    });
    
    if (!currentUserId) {
      console.log('❌ No user_id in session storage');
      return;
    }
    
    if (!currentUserRole) {
      console.log('❌ No user_role in session storage');
      return;
    }
    
    if (!facultyIdSelect) {
      console.log('❌ facultyIdSelect element not found');
      return;
    }
    
    // Check if current user is faculty
    const isFaculty = currentUserRole === "Faculty" || 
                     currentUserRole === "faculty" || 
                     currentUserRole === "2" || // role_id for faculty
                     currentUserRole.toLowerCase().includes("faculty");
    
    console.log('🔍 Role check:', { currentUserRole, isFaculty });
    
    if (!isFaculty) {
      console.log('❌ Current user is not faculty');
      return;
    }
    
    // Find current faculty in the list
    const currentFaculty = facultyList.find(f => f.faculty_id === currentUserId);
    console.log('🔍 Faculty found:', currentFaculty);
    
    if (currentFaculty) {
      console.log('✅ Auto-filling faculty field');
      // Auto-select and disable the faculty dropdown
      facultyIdSelect.value = currentFaculty.faculty_id;
      facultyIdSelect.disabled = true;
      
      // Add visual indicator that it's auto-filled
      const label = facultyIdSelect.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        label.textContent = 'Faculty in charge (You)';
        label.style.color = '#28a745';
        label.style.fontWeight = 'bold';
        console.log('✅ Label updated');
      } else {
        console.log('❌ Label element not found');
      }
    } else {
      console.log('❌ Current faculty not found in faculty list');
      console.log('🔍 Looking for faculty_id:', currentUserId, 'in list:', facultyList.map(f => f.faculty_id));
    }
  }

  // Load faculty options on initialization
  loadFacultyOptions();

  function toggleLab() {
    const on = !!labChk?.checked;
    if (!labSelectWrap) return;

    labSelectWrap.classList.toggle("hidden", !on);
    if (!on && labSelect) labSelect.value = "";
    
    // Handle location field based on lab selection
    if (locationInput) {
      if (on) {
        // Lab is selected - disable location and populate with lab value
        locationInput.disabled = true;
        if (labSelect?.value) {
          locationInput.value = labSelect.value;
        } else {
          locationInput.value = ""; // Clear if no lab selected yet
        }
      } else {
        // Lab is not selected - enable location and clear it
        locationInput.disabled = false;
        locationInput.value = "";
      }
    }
  }

  // Add event listener for lab selection changes
  labSelect?.addEventListener("change", () => {
    if (labChk?.checked && locationInput) {
      locationInput.value = labSelect.value || "";
    }
  });

  labChk?.addEventListener("change", toggleLab);
  toggleLab();

  function resetForm() {
    form.reset();
    toggleLab();
    
    // Re-apply faculty auto-fill if user is faculty
    if (facultyIdSelect && facultyIdSelect.disabled) {
      // Keep the faculty selection for faculty users
      const currentUserId = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
      if (currentUserId) {
        facultyIdSelect.value = currentUserId;
      }
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

    const requested_by = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
    const currentUserRole = sessionStorage.getItem("role_name") || 
                           sessionStorage.getItem("user_role") || 
                           sessionStorage.getItem("role");  // Add this fallback
    if (!requested_by) {
      showNotification("Session missing user_id. Please log in again.", 'error');
      return;
    }

    // Check for lab schedule conflicts before submission
    if (labChk?.checked) {
      const labConflictError = document.getElementById("lab-conflict-error");
      if (labConflictError && labConflictError.textContent.trim() !== "") {
        // Conflict detected - show detailed alert and prevent submission
        alert(`Lab schedule conflict detected!\n\n${labConflictError.textContent}\n\nPlease choose a different time or lab to continue.`);
        return;
      }
    }

    const program = programSelect?.value?.trim() || "";
    const year_level_raw = yearSelect?.value?.trim() || "";
    const year_level = year_level_raw ? Number(year_level_raw) : null;

    let facultyId = facultyIdSelect?.value ? Number(facultyIdSelect.value) : null;
    let selectedFacultyName = facultyIdSelect?.options[facultyIdSelect?.selectedIndex]?.text || "";
    
    // If current user is faculty and no faculty is selected, auto-set it
    const isFaculty = currentUserRole === "Faculty" || 
                     currentUserRole === "faculty" || 
                     currentUserRole === "2" || // role_id for faculty
                     currentUserRole.toLowerCase().includes("faculty");
                     
    if (isFaculty && requested_by && !facultyId) {
      facultyId = requested_by;
      selectedFacultyName = "You (Current User)";
    }
    const subj = subject?.value?.trim() || "";
    const date = dateNeeded?.value || "";
    const start = timeStart?.value || "";
    const end = timeEnd?.value || "";
    const contact = contactDetails?.value?.trim() || "";
    const purposeText = purpose?.value?.trim() || "";

    const chosenLab = labChk?.checked ? (labSelect?.value || "") : "";
    const manualLocation = locationInput?.value?.trim() || "";
    const location = chosenLab || manualLocation;

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
    console.log('🔍 Validation Debug:', {
      subj: !!subj,
      date: !!date,
      start: !!start,
      end: !!end,
      contact: !!contact,
      purposeText: !!purposeText,
      isFaculty,
      facultyId,
      program: !!program,
      year_level: !!year_level,
      location: !!location
    });
    
    if (!subj || !date || !start || !end || !contact || !purposeText) {
      showNotification("Please fill in all required fields.", 'warning');
      return;
    }
    
    // Faculty validation - only required for non-faculty users
    if (!isFaculty && !facultyId) {
      showNotification("Please select a faculty in charge.", 'warning');
      return;
    }
    if (!program) {
      showNotification("Please select a program.", 'warning');
      return;
    }
    if (!year_level) {
      showNotification("Please select a year level.", 'warning');
      return;
    }
    if (labChk?.checked && !chosenLab) {
      showNotification("Please select a laboratory room.", 'warning');
      return;
    }
    if (!location) {
      showNotification("Please provide a Room / Location (or select a Lab).", 'warning');
      return;
    }

    // Faculty validation - only required for non-faculty users
    if (!isFaculty && !facultyId) {
      showNotification("Please select a faculty in charge.", 'warning');
      return;
    }

    const combinedPurpose =
      `${purposeText}` +
      (chosenLab ? `\nRequested Lab: ${chosenLab}` : "") +
      (selectedFacultyName ? `\nFaculty In Charge: ${selectedFacultyName}` : "");

    const payload = {
      requested_by,
      lab_schedule_id: null,
      faculty_id: facultyId,
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
      equipment_details: selectedEquipment // Include equipment with quantities
    };

    try {
      const res = await fetch("/api/borrowRequests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showNotification(data.message || "Failed to submit request.", 'error');
        console.error("Request error:", data);
        return;
      }

      showNotification(data.message || "Request submitted successfully.", 'success');
      resetForm();

      // refresh history automatically
      await loadMyRequests();
    } catch (err) {
      console.error("Network error:", err);
      showNotification("Network error. Please check your connection and try again.", 'error');
    }
  });

  // =========================
  // B) LOAD MY REQUESTS TABLE
  // =========================
  async function loadMyRequests() {
    const tbody = document.getElementById("my-requests-tbody");
    if (!tbody) return;
  
    const userId = Number(sessionStorage.getItem("user_id"));
    if (!userId) {
      tbody.innerHTML = `<tr><td colspan="7">Session expired. Please log in again.</td></tr>`;
      return;
    }
  
    tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;
  
    try {
      const res = await fetch(`/api/myBorrowRequests/my/${userId}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error:", errorData);
        tbody.innerHTML = `<tr><td colspan="7">Error: ${errorData.message || 'Server error'}</td></tr>`;
        return;
      }
      
      const rows = await res.json().catch(() => []);
    
      console.log('🔍 Faculty Requests Debug:', {
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
    
      if (!Array.isArray(rows)) {
        console.error("Invalid response format:", rows);
        tbody.innerHTML = `<tr><td colspan="7">Invalid server response.</td></tr>`;
        return;
      }
    
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No requests found.</td></tr>`;
        return;
      }
    
      tbody.innerHTML = rows
        .map((r) => {
          // Extract time information (same as admin requests)
          const start = (r.time_start || r.time_of_use) ? String(r.time_start || r.time_of_use).slice(0, 5) : "-";
          const end = r.time_end ? String(r.time_end).slice(0, 5) : "";
          const timeRange = end ? `${start} - ${end}` : start;
          
          // Extract room/location information
          const room = r.location || "-";
          
          // Extract equipment information (same as admin requests)
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
          fullnameElement.textContent = 'Faculty';
        }
      }

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
      document.getElementById('user-fullname').textContent = 'Faculty';
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
  
  // Call once on load
  document.addEventListener("DOMContentLoaded", loadMyRequests);
  loadUserInfo();

  console.log("Faculty Script Loaded (submit + my requests).");
})();
