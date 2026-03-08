/* =========================================
   SmartLab – Admin Panel Script (Updated)
   - Core init (guardRole, tabs, logout)
   - Manage Accounts modal open/close
   - Account filter toggle (faculty/student)
   - Lab schedule modal + add/edit/delete (front-end table)
   - Dashboard counts
   - Pending Requests: load, approve, reject (API)
========================================= */

(() => {
  // ---------- Core init ----------
  window.SmartLab.Auth.guardRole("Admin");
  window.SmartLab.Auth.setWho();
  window.SmartLab.Auth.logoutSetup();
  setupTabs();

  console.log("Admin panel initialized.");

  // ---------- Helpers ----------
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

  // =========================================================
  // 1) MANAGE ACCOUNTS: MODAL + FILTER VIEW
  // =========================================================
  const addAccountBtn = qs('#tab-users #open-add-modal') || qs('#tab-users .btn-primary');
  const modalAddAccount = document.getElementById('modal-add-account');
  const closeModalBtn = qs('#modal-add-account .close-modal');
  const cancelModalBtn = document.getElementById('cancel-modal');
  const addAccountForm = document.getElementById('add-account-form');
  const studentFields = document.getElementById('student-extra-fields');

  function hideAddAccountModal() {
    if (!modalAddAccount) return;
    modalAddAccount.classList.add('hidden');
    modalAddAccount.classList.remove('flex-display');
    addAccountForm?.reset();
    studentFields?.classList.add('hidden');
  }

  function showAddAccountModal() {
    if (!modalAddAccount) return;
    modalAddAccount.classList.remove('hidden');
    modalAddAccount.classList.add('flex-display');
  }

  if (addAccountBtn) addAccountBtn.addEventListener('click', showAddAccountModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', hideAddAccountModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideAddAccountModal);

  window.addEventListener('click', (e) => {
    if (modalAddAccount && e.target === modalAddAccount) hideAddAccountModal();
  });

  // Filter logic (faculty/admin table vs student table)
  const accountFilter = document.getElementById('account-filter');
  const facultyView = document.getElementById('view-faculty');
  const studentView = document.getElementById('view-students');

  function applyAccountFilter(value) {
    const v = String(value || "").toLowerCase();

    // Your dropdown values are: all | admin | faculty | student
    if (v === "student") {
      facultyView?.classList.add("hidden");
      studentView?.classList.remove("hidden");
      return;
    }

    if (v === "faculty" || v === "admin") {
      studentView?.classList.add("hidden");
      facultyView?.classList.remove("hidden");
      return;
    }

    // all
    facultyView?.classList.remove("hidden");
    studentView?.classList.remove("hidden");
  }

  if (accountFilter) {
    accountFilter.addEventListener("change", (e) => applyAccountFilter(e.target.value));
    applyAccountFilter(accountFilter.value);
  }

  // =========================================================
  // 2) LAB SCHEDULE MODAL (FRONT-END TABLE ONLY)
  // =========================================================
  let currentRow = null;

  const schedModal = document.getElementById('modal-add-schedule');
  const openSchedBtn = qs('#tab-schedule .btn-primary');
  const closeSchedBtns = qsa('.close-modal-sched');
  const schedForm = document.getElementById('add-schedule-form');
  const scheduleTableBody = qs('#tab-schedule tbody');

  const modalTitle = document.getElementById('modal-title');
  const saveBtn = document.getElementById('save-btn');

  function openScheduleModal(mode = "add", row = null) {
    if (!schedModal || !schedForm) return;

    currentRow = row;
    schedForm.setAttribute("data-mode", mode);

    if (mode === "edit" && row) {
      modalTitle && (modalTitle.innerText = "Edit Lab Schedule");
      saveBtn && (saveBtn.innerText = "Update Schedule");

      document.getElementById('sched-lab').value = row.cells[0].innerText.trim();
      document.getElementById('sched-faculty').value = row.cells[1].innerText.trim();
      document.getElementById('sched-section').value = row.cells[2].innerText.trim();
      document.getElementById('sched-year').value = row.cells[3].innerText.trim();
      document.getElementById('sched-day').value = row.cells[4].innerText.trim();
      document.getElementById('sched-start').value = row.cells[5].innerText.trim();
      document.getElementById('sched-end').value = row.cells[6].innerText.trim();
    } else {
      modalTitle && (modalTitle.innerText = "Add New Lab Schedule");
      saveBtn && (saveBtn.innerText = "Save Schedule");
      schedForm.reset();
    }

    schedModal.classList.remove('hidden');
    schedModal.classList.add('flex-display');
  }

  function closeScheduleModal() {
    if (!schedModal || !schedForm) return;
    schedModal.classList.add('hidden');
    schedModal.classList.remove('flex-display');
    schedForm.reset();
    schedForm.setAttribute('data-mode', 'add');
    modalTitle && (modalTitle.innerText = "Add New Lab Schedule");
    saveBtn && (saveBtn.innerText = "Save Schedule");
    currentRow = null;
  }

  if (openSchedBtn) openSchedBtn.addEventListener('click', () => openScheduleModal("add"));
  closeSchedBtns.forEach(btn => btn.addEventListener('click', closeScheduleModal));

  // Edit/Delete using event delegation on schedule table
  if (scheduleTableBody) {
    scheduleTableBody.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      if (!row) return;

      // Delete
      if (e.target.classList.contains("btnDanger")) {
        if (confirm("Are you sure you want to delete this schedule?")) {
          row.remove();
          updateDashboardCounts();
        }
        return;
      }

      // Edit
      if (e.target.innerText.trim() === "Edit") {
        openScheduleModal("edit", row);
      }
    });
  }

  // Save / Update schedule row (front-end only)
  if (schedForm && scheduleTableBody) {
    schedForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const data = {
        lab: document.getElementById('sched-lab').value,
        faculty: document.getElementById('sched-faculty').value,
        section: document.getElementById('sched-section').value,
        year: document.getElementById('sched-year').value,
        day: document.getElementById('sched-day').value,
        start: document.getElementById('sched-start').value,
        end: document.getElementById('sched-end').value
      };

      const mode = schedForm.getAttribute("data-mode");

      if (mode === "edit" && currentRow) {
        currentRow.cells[0].innerText = data.lab;
        currentRow.cells[1].innerText = data.faculty;
        currentRow.cells[2].innerText = data.section;
        currentRow.cells[3].innerText = data.year;
        currentRow.cells[4].innerText = data.day;
        currentRow.cells[5].innerText = data.start;
        currentRow.cells[6].innerText = data.end;
        alert("Schedule updated!");
      } else {
        const newRowHtml = `
          <tr>
            <td>${data.lab}</td>
            <td>${data.faculty}</td>
            <td>${data.section}</td>
            <td>${data.year}</td>
            <td>${data.day}</td>
            <td>${data.start}</td>
            <td>${data.end}</td>
            <td>
              <button class="btn btnSmall">Edit</button>
              <button class="btn btnSmall btnDanger">Delete</button>
            </td>
          </tr>
        `;
        scheduleTableBody.insertAdjacentHTML("beforeend", newRowHtml);
        alert("Schedule added successfully!");
      }

      closeScheduleModal();
      updateDashboardCounts();
    });
  }

  // =========================================================
  // 3) DASHBOARD COUNTS
  // =========================================================
  function updateDashboardCounts() {
    // Total users (counts table rows)
    const facultyCount = document.querySelectorAll('#view-faculty tbody tr').length;
    const studentCount = document.querySelectorAll('#view-students tbody tr').length;
    const totalUsers = facultyCount + studentCount;

    // Schedules count
    const scheduleCount = document.querySelectorAll('#tab-schedule tbody tr').length;

    // Pending requests count (pending table rows)
    const pendingCount = document.querySelectorAll('#pending-requests-tbody tr[data-id]').length;

    const statsNumbers = document.querySelectorAll('.stats-number');
    if (statsNumbers.length >= 3) {
      statsNumbers[0].innerText = totalUsers;
      statsNumbers[1].innerText = scheduleCount;
      statsNumbers[2].innerText = pendingCount;
    }
  }

   // =========================================================
  // MANAGE EQUIPMENT MODAL
  // =========================================================
    let currentEquipmentRow = null;

    const equipmentModal = document.getElementById('modal-add-equipment');
    const openEquipmentBtn = qs('#tab-equipment .btn-primary');
    const closeEquipmentBtns = qsa('.close-modal-equipment');
    const equipmentForm = document.getElementById('add-equipment-form');
    const equipmentTableBody = qs('#tab-equipment tbody');

    function openEquipmentModal(mode = "add", row = null) {
      if (!equipmentModal || !equipmentForm) return;

      currentEquipmentRow = row;
      equipmentForm.setAttribute("data-mode", mode);

      const modalTitle = qs('#modal-add-equipment #modal-title');
      const saveBtn = qs('#modal-add-equipment #save-btn');

      if (mode === "edit" && row) {
        modalTitle && (modalTitle.innerText = "Edit Equipment");
        saveBtn && (saveBtn.innerText = "Update Equipment");

        document.getElementById('equipment-name').value = row.cells[0].innerText.trim();
        document.getElementById('equipment-category').value = row.cells[1].innerText.trim();
        document.getElementById('equipment-quantity').value = row.cells[2].innerText.trim();
        document.getElementById('equipment-status').value = row.cells[3].innerText.trim().toLowerCase();
      } else {
        modalTitle && (modalTitle.innerText = "Add New Equipment");
        saveBtn && (saveBtn.innerText = "Save Equipment");
        equipmentForm.reset();
      }

      equipmentModal.classList.remove('hidden');
      equipmentModal.classList.add('flex-display');
    }

    function closeEquipmentModal() {
      if (!equipmentModal || !equipmentForm) return;
      equipmentModal.classList.add('hidden');
      equipmentModal.classList.remove('flex-display');
      equipmentForm.reset();
      equipmentForm.setAttribute('data-mode', 'add');

      const modalTitle = qs('#modal-add-equipment #modal-title');
      const saveBtn = qs('#modal-add-equipment #save-btn');
      modalTitle && (modalTitle.innerText = "Add New Equipment");
      saveBtn && (saveBtn.innerText = "Save Equipment");
      currentEquipmentRow = null;
    }

    if (openEquipmentBtn) openEquipmentBtn.addEventListener('click', () => openEquipmentModal("add"));
    closeEquipmentBtns.forEach(btn => btn.addEventListener('click', closeEquipmentModal));

    // Edit/Delete using event delegation on equipment table
    if (equipmentTableBody) {
      equipmentTableBody.addEventListener("click", (e) => {
        const row = e.target.closest("tr");
        if (!row) return;

        // Delete
        if (e.target.classList.contains("btnDanger")) {
          if (confirm("Are you sure you want to delete this equipment?")) {
            row.remove();
            updateDashboardCounts();
          }
          return;
        }

        // Edit
        if (e.target.innerText.trim() === "Edit") {
          openEquipmentModal("edit", row);
        }
      });
    }

    // Save / Update equipment row (front-end only)
    if (equipmentForm && equipmentTableBody) {
      equipmentForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const data = {
          name: document.getElementById('equipment-name').value,
          category: document.getElementById('equipment-category').value,
          quantity: document.getElementById('equipment-quantity').value,
          status: document.getElementById('equipment-status').value
        };

        const mode = equipmentForm.getAttribute("data-mode");

        if (mode === "edit" && currentEquipmentRow) {
          currentEquipmentRow.cells[0].innerText = data.name;
          currentEquipmentRow.cells[1].innerText = data.category;
          currentEquipmentRow.cells[2].innerText = data.quantity;
          currentEquipmentRow.cells[3].innerText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
          alert("Equipment updated!");
        } else {
          const newRowHtml = `
            <tr>
              <td>${data.name}</td>
              <td>${data.category}</td>
              <td>${data.quantity}</td>
              <td>${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</td>
              <td>
                <button class="btn btnSmall">Edit</button>
                <button class="btn btnSmall btnDanger">Delete</button>
              </td>
            </tr>
          `;
          equipmentTableBody.insertAdjacentHTML("beforeend", newRowHtml);
          alert("Equipment added successfully!");
        }

        closeEquipmentModal();
        updateDashboardCounts();
      });
    }


// =========================================================
// 4) ADMIN: PENDING REQUESTS (Populate Table)
// =========================================================
async function loadPendingRequests() {
  const tbody = document.getElementById("pending-requests-tbody");
  if (!tbody) return;

  console.log("Admin: Loading pending requests...");
  tbody.innerHTML = `<tr><td colspan="5">Loading pending requests...</td></tr>`;

  async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { message: text || "Unexpected server response" }; }
  }

  // safe call, avoids "is not defined" crashes
  function safeUpdateCounts() {
    if (typeof updateDashboardCounts === "function") updateDashboardCounts();
  }

  try {
    const res = await fetch("/api/borrowRequests/pending");
    console.log("Admin: API response status:", res.status);
    const data = await safeJson(res);
    console.log("Admin: API response data:", data);

    if (!res.ok) {
      console.error("Pending requests fetch failed:", data);
      tbody.innerHTML = `<tr><td colspan="5">${data.message || "Failed to load pending requests."}</td></tr>`;
      safeUpdateCounts();
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    console.log("Admin: Processed rows:", rows);
    
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">No pending requests.</td></tr>`;
      safeUpdateCounts();
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const start = (r.time_start || r.time_of_use) ? String(r.time_start || r.time_of_use).slice(0, 5) : "-";
      const end = r.time_end ? String(r.time_end).slice(0, 5) : "";
      const timeRange = end ? `${start} - ${end}` : start;

      const requesterEmail = r.requester_gmail || r.gmail || "-";

      const particulars =
        (r.particulars && String(r.particulars).trim()) ? String(r.particulars).trim()
        : (r.subject && String(r.subject).trim()) ? String(r.subject).trim()
        : (r.purpose && String(r.purpose).trim()) ? String(r.purpose).trim()
        : "-";

      const dateText =
        (typeof formatDate === "function")
          ? formatDate(r.date_needed)
          : (r.date_needed || "");

      return `
        <tr data-id="${r.borrow_request_id}">
          <td>${escapeHtml(requesterEmail)}</td>
          <td>${escapeHtml(particulars)}</td>
          <td>${escapeHtml(dateText)}</td>
          <td>${escapeHtml(timeRange)}</td>
          <td>
            <button class="btn btnSmall btnPrimary btn-approve">Approve</button>
            <button class="btn btnSmall btnDanger btn-reject">Reject</button>

            <div class="rejection-note hidden" style="margin-top:8px;">
              <textarea class="reject-reason" placeholder="Reason for rejection..."></textarea>
              <div style="margin-top:6px; display:flex; gap:8px;">
                <button class="btn btnSmall btnDanger btn-reject-confirm">Confirm Reject</button>
                <button class="btn btnSmall btn-cancel-reject">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    safeUpdateCounts();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5">Server error.</td></tr>`;
    if (typeof updateDashboardCounts === "function") updateDashboardCounts();
  }
}

// Minimal HTML escaping to avoid accidental markup injection from DB values
function escapeHtml(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function updateRequestStatus(id, status_id, rejection_reason = null) {
  async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { message: text || "Unexpected server response" }; }
  }

  try {
    const res = await fetch(`/api/borrowRequests/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_id, rejection_reason })
    });

    const data = await safeJson(res);

    if (!res.ok) {
      alert(data.message || "Failed to update status.");
      console.error("Status update error:", data);
      return false;
    }

    alert(data.message || "Status updated.");
    return true;
  } catch (err) {
    console.error(err);
    alert("Server error. Try again.");
    return false;
  }
}

// Event delegation for Approve/Reject
document.addEventListener("click", async (e) => {
  const row = e.target.closest("#pending-requests-tbody tr[data-id]");
  if (!row) return;

  const id = Number(row.dataset.id);
  if (!id) return;

  if (e.target.classList.contains("btn-approve")) {
    if (!confirm("Approve this request?")) return;
    const ok = await updateRequestStatus(id, 2);
    if (ok) loadPendingRequests();
    return;
  }

  if (e.target.classList.contains("btn-reject")) {
    row.querySelector(".rejection-note")?.classList.remove("hidden");
    return;
  }

  if (e.target.classList.contains("btn-cancel-reject")) {
    row.querySelector(".reject-reason").value = "";
    row.querySelector(".rejection-note")?.classList.add("hidden");
    return;
  }

  if (e.target.classList.contains("btn-reject-confirm")) {
    const reason = row.querySelector(".reject-reason")?.value?.trim() || "";
    if (!reason) return alert("Please provide a reason for rejection.");
    if (!confirm("Reject this request?")) return;

    const ok = await updateRequestStatus(id, 3, reason);
    if (ok) loadPendingRequests();
  }
});

// PRINT REPORTS
    const printReportsBtn = qs('#tab-reports .btn-primary');

    if (printReportsBtn) {
      printReportsBtn.addEventListener('click', async () => {
        await PrintReports.printUsageReports('#tab-reports tbody');
      });
    }

document.addEventListener("DOMContentLoaded", () => {
  loadPendingRequests();
  if (typeof updateDashboardCounts === "function") updateDashboardCounts();
});

})();
