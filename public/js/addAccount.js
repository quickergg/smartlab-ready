(() => {
  const form = document.getElementById("add-account-form");
  const roleSelect = document.getElementById("role-select");
  const roleHelp = document.getElementById("role-help");

  const studentFields = document.getElementById("student-extra-fields");
  const facultyFields = document.getElementById("faculty-extra-fields");

  const programSelect = document.getElementById("program-select");
  const yearSelect = document.getElementById("year-select");
  const departmentSelect = document.getElementById("department-select");

  // If this script is included on pages without the modal/form, do nothing.
  if (!form || !roleSelect) return;

  const getRoleName = () => {
    return (
      roleSelect.options[roleSelect.selectedIndex]?.textContent
        ?.trim()
        .toLowerCase() || ""
    );
  };

  async function loadRoles() {
    if (roleHelp) roleHelp.textContent = "Loading roles...";
    roleSelect.disabled = true;

    try {
      const res = await fetch("/api/users-role");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const roles = await res.json();

      // Keep the first placeholder option only
      roleSelect.length = 1;

      roles.forEach((role) => {
        const opt = document.createElement("option");
        opt.value = String(role.role_id); // stored value
        opt.textContent = role.role_name; // shown label
        roleSelect.appendChild(opt);
      });

      if (roleHelp) roleHelp.textContent = "";
    } catch (err) {
      console.error("Error fetching user roles:", err);
      if (roleHelp) roleHelp.textContent = "Failed to load roles. Please refresh.";
    } finally {
      roleSelect.disabled = false;
    }
  }

  function updateExtraFields() {
    const roleName = getRoleName();
    const isStudent = roleName === "student";
    const isFaculty = roleName === "faculty";

    // Show/hide blocks
    if (studentFields) studentFields.classList.toggle("hidden", !isStudent);
    if (facultyFields) facultyFields.classList.toggle("hidden", !isFaculty);

    // Toggle required fields
    if (programSelect) programSelect.required = isStudent;
    if (yearSelect) yearSelect.required = isStudent;
    if (departmentSelect) departmentSelect.required = isFaculty;

    // Clear values when switching away
    if (!isStudent) {
      if (programSelect) programSelect.value = "";
      if (yearSelect) yearSelect.value = "";
    }
    if (!isFaculty) {
      if (departmentSelect) departmentSelect.value = "";
    }
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    loadRoles().then(() => {
      // After roles load, re-evaluate fields (handles pre-selected values)
      updateExtraFields();
    });

    roleSelect.addEventListener("change", updateExtraFields);
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const roleId = roleSelect.value;
    const roleName = getRoleName();

    const fullName = document.getElementById("full-name")?.value.trim() || "";
    const gmail = document.getElementById("gmail")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";

    const program = programSelect?.value || "";
    const year = yearSelect?.value || "";
    const department = departmentSelect?.value || "";

    // Base required
    if (!roleId || !fullName || !gmail || !password) {
      alert("Please fill in all required fields.");
      return;
    }

    // Role-specific required (based on text label, not numeric IDs)
    if (roleName === "student" && (!program || !year)) {
      alert("Please select program and year.");
      return;
    }
    if (roleName === "faculty" && !department) {
      alert("Please select a department.");
      return;
    }

    const payload = {
      role_id: Number(roleId),
      full_name: fullName,
      gmail,
      password
    };

    if (roleName === "student") {
      payload.program = program;
      payload.year = Number(year);
    } else if (roleName === "faculty") {
      payload.department = department;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Read response safely (even if server returns non-JSON)
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) {}

      if (!res.ok) {
        alert(data.message || `Failed to create account (HTTP ${res.status})`);
        return;
      }

      alert(data.message || "Account created successfully");
      window.loadUsers?.(); // refresh tables

      form.reset();
      updateExtraFields(); // re-hide fields + remove required flags correctly

      const modal = document.getElementById("modal-add-account");
      if (modal) modal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert("Server error. Try again.");
    }
  });
})();
