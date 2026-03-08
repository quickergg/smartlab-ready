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

  // ---------- Helpers ----------
  const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

  const escapeHtml = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const statusClass = (statusName = "") => {
    const s = String(statusName).toLowerCase();
    if (s.includes("approve")) return "status-approved";
    if (s.includes("decline")) return "status-declined";
    if (s.includes("cancel")) return "status-cancelled";
    return "status-pending";
  };

  // =========================
  // A) SUBMIT REQUEST FORM
  // =========================
  const form = document.getElementById("facultyRequestForm");
  if (!form) return;

  const labChk = document.getElementById("labChk");
  const labSelectWrap = document.getElementById("labSelectWrap");
  const labSelect = document.getElementById("labSelect");

  const facultyInCharge = document.getElementById("facultyInCharge");
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

  function toggleLab() {
    const on = !!labChk?.checked;
    if (!labSelectWrap) return;

    labSelectWrap.classList.toggle("hidden", !on);
    if (!on && labSelect) labSelect.value = "";
  }

  labChk?.addEventListener("change", toggleLab);
  toggleLab();

  function resetForm() {
    form.reset();
    toggleLab();
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

    const chosenLab = labChk?.checked ? (labSelect?.value || "") : "";
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

    const combinedPurpose =
      `${purposeText}` +
      (chosenLab ? `\nRequested Lab: ${chosenLab}` : "") +
      `\nFaculty In Charge: ${fullName}`;

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
      equipment_ids
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
    if (!userId) {
      tbody.innerHTML = `<tr><td colspan="5">Session expired. Please log in again.</td></tr>`;
      return;
    }
  
    tbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;
  
    try {
      const res = await fetch(`/api/myBorrowRequests/my/${userId}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error:", errorData);
        tbody.innerHTML = `<tr><td colspan="5">Error: ${errorData.message || 'Server error'}</td></tr>`;
        return;
      }
      
      const rows = await res.json().catch(() => []);
    
      if (!Array.isArray(rows)) {
        console.error("Invalid response format:", rows);
        tbody.innerHTML = `<tr><td colspan="5">Invalid server response.</td></tr>`;
        return;
      }
    
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No requests found.</td></tr>`;
        return;
      }
    
      tbody.innerHTML = rows
        .map((r) => {
          const particulars =
            r.particulars && String(r.particulars).trim()
              ? String(r.particulars).trim()
              : "-";
        
          const note =
            r.note && String(r.note).trim()
              ? String(r.note).trim()
              : "-";
        
          const statusName = r.status_name || "Pending";
        
          return `
            <tr>
              <td>${escapeHtml(formatDate(r.created_at))}</td>
              <td>${escapeHtml(particulars)}</td>
              <td>${escapeHtml(formatDate(r.date_needed))}</td>
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
      tbody.innerHTML = `<tr><td colspan="5">Network error. Please check your connection.</td></tr>`;
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
