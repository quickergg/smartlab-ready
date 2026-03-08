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

    // Load faculty options into dropdown
    async function loadFacultyOptions() {
      if (!facultyIdSelect) return;
      
      try {
        const response = await fetch('/api/faculty-list');
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
      const currentUserId = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
      const currentUserRole = sessionStorage.getItem("role_name") || sessionStorage.getItem("user_role");
      
      console.log('🔍 Auto-fill Debug:', {
        currentUserId,
        currentUserRole,
        facultyIdSelect: !!facultyIdSelect,
        facultyListLength: facultyList?.length,
        sessionKeys: {
          userId: sessionStorage.getItem("userId"),
          user_id: sessionStorage.getItem("user_id"),
          role_name: sessionStorage.getItem("role_name"),
          user_role: sessionStorage.getItem("user_role")
        }
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
      
      // Check different possible role values
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
        }
      } else {
        console.log('❌ Current faculty not found in faculty list');
      }
    }

    // Load faculty options on initialization
    loadFacultyOptions();
    
    // Add manual trigger for debugging (remove in production)
    window.debugFacultyAutoFill = () => {
      console.log('🔧 Manual debug trigger');
      console.log('Current session:', {
        userId: sessionStorage.getItem("userId"),
        user_id: sessionStorage.getItem("user_id"),
        role_name: sessionStorage.getItem("role_name"),
        user_role: sessionStorage.getItem("user_role")
      });
      
      fetch('/api/faculty-list')
        .then(r => r.json())
        .then(faculty => {
          console.log('📋 Faculty list:', faculty);
          autoFillFacultyForCurrentUser(faculty);
        });
    };
    
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

    // Lab checkbox toggle (faculty only)
    function toggleLab() {
      if (!labChk || !labSelectWrap) return;
      const on = !!labChk.checked;
      labSelectWrap.classList.toggle("hidden", !on);
      if (!on && labSelect) labSelect.value = "";
    }

    if (labChk) {
      labChk.addEventListener("change", toggleLab);
      toggleLab();
    }

    function resetForm() {
      form.reset();
      if (labChk) toggleLab();
      
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

    // Submit handler
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const requested_by = Number(sessionStorage.getItem("userId") || sessionStorage.getItem("user_id"));
      const currentUserRole = sessionStorage.getItem("role_name") || sessionStorage.getItem("user_role");
      const currentUserId = requested_by;
      
      if (!requested_by) {
        alert("Session missing user_id. Please log in again.");
        return;
      }

      const program = programSelect?.value?.trim() || "";
      const year_level_raw = yearSelect?.value?.trim() || "";
      const year_level = year_level_raw ? Number(year_level_raw) : null;

      const fullName = facultyInCharge?.value?.trim() || "";
      let facultyId = facultyIdSelect?.value ? Number(facultyIdSelect.value) : null;
      let selectedFacultyName = facultyIdSelect?.options[facultyIdSelect?.selectedIndex]?.text || "";
      
      // Check if current user is faculty (unified role checking)
      const isFaculty = currentUserRole === "Faculty" || 
                       currentUserRole === "faculty" || 
                       currentUserRole === "2" || // role_id for faculty
                       currentUserRole.toLowerCase().includes("faculty");
                       
      // If current user is faculty and no faculty is selected, auto-set it
      if (isFaculty && currentUserId && !facultyId) {
        facultyId = currentUserId;
        selectedFacultyName = "You (Current User)";
      }
      const subj = subject?.value?.trim() || "";
      const date = dateNeeded?.value || "";
      const start = timeStart?.value || "";
      const end = timeEnd?.value || "";
      const contact = contactDetails?.value?.trim() || "";
      const purposeText = purpose?.value?.trim() || "";

      const chosenLab = (labChk?.checked && labSelect) ? labSelect.value : "";
      const manualLocation = locationInput?.value?.trim() || "";
      const location = chosenLab || manualLocation;

      const equipment_ids = Array.from(
        document.querySelectorAll('input[name="equipment_ids[]"]:checked')
      )
        .map((cb) => Number(cb.value))
        .filter(Boolean);

      // Validation
      if (!fullName || !subj || !date || !start || !end || !contact || !purposeText) {
        alert("Please fill in all required fields.");
        return;
      }
      if (!program) {
        alert("Please select a program.");
        return;
      }
      if (!year_level) {
        alert("Please select a year level.");
        return;
      }
      if (labChk?.checked && !chosenLab) {
        alert("Please select a laboratory room.");
        return;
      }
      if (!location) {
        alert("Please provide a Room / Location (or select a Lab).");
        return;
      }
      
      // Faculty validation - only required for non-faculty users                       
      if (!isFaculty && !facultyId) {
        alert("Please select a faculty in charge.");
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
        equipment_ids
      };

      try {
        const data = await SmartLab.Api.post("/api/borrowRequests", payload);
        alert(data.message || "Request submitted successfully.");
        resetForm();
        // Notify parent page to refresh history
        window.dispatchEvent(new CustomEvent("borrowRequestSubmitted"));
      } catch (err) {
        console.error(err);
        alert("Server error. Try again.");
      }
    });
  }

  // Export
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.BorrowForm = { init };
})();
