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
