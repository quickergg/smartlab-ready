// Role check
const currentUserRole = sessionStorage.getItem("role") || "";
const isAdmin = currentUserRole.toLowerCase() === "admin";

// Global cache
let allSchedules = [];

function getScheduleTbodyId() {
  const adminTbody = document.getElementById("lab-schedule-body-admin");
  const normalTbody = document.getElementById("lab-schedule-body");

  if (isAdmin && adminTbody) return "lab-schedule-body-admin";
  if (normalTbody) return "lab-schedule-body";
  if (adminTbody) return "lab-schedule-body-admin";
  return null;
}

function getCreatedBy() {
  const id = sessionStorage.getItem("user_id");
  return id ? Number(id) : null;
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text || "Unexpected server response" }; }
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
      time_start: document.getElementById("sched-start")?.value,
      time_end: document.getElementById("sched-end")?.value,
      created_by
    };

    if (!payload.lab_room || !payload.faculty_id || !payload.subject || !payload.day_of_week || !payload.time_start || !payload.time_end) {
      alert("Please complete all required fields.");
      return;
    }

    if (payload.time_end <= payload.time_start) {
      alert("End time must be after start time.");
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

// --------------------------
// Faculty Dropdown (Admin Modal)
// --------------------------
async function loadFacultyDropdown() {
  const sel = document.getElementById("sched-faculty-id");
  if (!sel) return;

  try {
    const res = await fetch("/api/faculty-list");
    const data = await safeJson(res);

    if (!res.ok) throw new Error(data.message || "Failed to load faculty list");

    sel.length = 1;

    data.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.user_id;
      opt.textContent = f.gmail || "Unknown";
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load faculty list:", err);
  }
}

// --------------------------
// Load Lab Schedules
// --------------------------
async function loadLabSchedules() {
  try {
    const res = await fetch("/api/labSchedule");
    const data = await safeJson(res);

    if (!res.ok) throw new Error(data.message || "Failed to load schedules");

    allSchedules = Array.isArray(data) ? data : [];

    const tbodyId = getScheduleTbodyId();
    if (!tbodyId) return;

    renderLabScheduleTable(allSchedules, tbodyId);
  } catch (err) {
    console.error(err);
    alert("Unable to load lab schedules.");
  }
}

// --------------------------
// Render Table
// --------------------------
function renderLabScheduleTable(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

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
    return;
  }

  data.forEach((row) => {
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
        await SmartLab.Api.delete(`/api/labSchedule/${id}`);
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
      time_start: document.getElementById("edit-sched-start")?.value,
      time_end: document.getElementById("edit-sched-end")?.value
    };

    try {
      await SmartLab.Api.put(`/api/labSchedule/${id}`, payload);
      alert("Schedule updated.");
      const modal = document.getElementById("modal-edit-schedule");
      if (modal) modal.classList.add("hidden");
      await loadLabSchedules();
    } catch (err) {
      console.error(err);
      alert("Failed to update schedule.");
    }
  });
})();

// --------------------------
// Init
// --------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadFacultyDropdown();
  setupLabFilter();
  loadLabSchedules();
  setupScheduleActions();
});
