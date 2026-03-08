(function () {
  const facultyTbody = document.getElementById("faculty-tbody");
  const studentTbody = document.getElementById("student-tbody");
  const filter = document.getElementById("account-filter");

  const viewFaculty = document.getElementById("view-faculty");
  const viewStudents = document.getElementById("view-students");

  if (!facultyTbody || !studentTbody) {
    console.warn("Missing tbody targets: #faculty-tbody or #student-tbody");
    return;
  }

  const esc = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const pill = (text) => `<span class="pill">${esc(text)}</span>`;

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to load users");

      // Clear existing rows
      facultyTbody.innerHTML = "";
      studentTbody.innerHTML = "";

      data.forEach((u) => {
        const role = (u.role_name || "").toLowerCase();

        // Students table
        if (role === "student") {
          const courseYear =
            u.program && u.year_level ? `${u.program}-${u.year_level}` : "—";

          studentTbody.insertAdjacentHTML(
            "beforeend",
            `
            <tr data-role="student">
              <td>${esc(u.role_name || "Student")}</td>
              <td>${esc(u.full_name || "—")}</td>
              <td>${esc(u.gmail)}</td>
              <td>${pill(courseYear)}</td>
              <td>${esc(u.status_name || "—")}</td>
              <td>
                <button class="btn btnSmall" data-action="edit" data-id="${esc(u.user_id)}">Edit</button>
              </td>
            </tr>
            `
          );
          return;
        }

        // Admin + Faculty table (shared)
        const dept = role === "faculty" ? (u.department || "—") : "—";

        facultyTbody.insertAdjacentHTML(
          "beforeend",
          `
          <tr data-role="${esc(role || "unknown")}">
            <td>${esc(u.role_name || "—")}</td>
            <td>${esc(u.full_name || "—")}</td>
            <td>${esc(u.gmail)}</td>
            <td>${pill(dept)}</td>
            <td>${esc(u.status_name || "—")}</td>
            <td>
              <button class="btn btnSmall" data-action="edit" data-id="${esc(u.user_id)}">Edit</button>
            </td>
          </tr>
          `
        );
      });

      applyFilter();
    } catch (e) {
      console.error(e);
      alert(e.message || "Server error while loading users.");
    }
  }

  function applyFilter() {
    const value = (filter?.value || "all").toLowerCase();

    // default: show both
    viewFaculty?.classList.remove("hidden");
    viewStudents?.classList.remove("hidden");

    if (value === "student") {
      viewFaculty?.classList.add("hidden");
      viewStudents?.classList.remove("hidden");
      return;
    }

    if (value === "admin" || value === "faculty") {
      viewStudents?.classList.add("hidden");
      viewFaculty?.classList.remove("hidden");

      // within the shared table, hide non-matching role rows
      facultyTbody.querySelectorAll("tr").forEach((tr) => {
        const r = (tr.getAttribute("data-role") || "").toLowerCase();
        tr.style.display = r === value ? "" : "none";
      });
      return;
    }

    // show all rows
    facultyTbody.querySelectorAll("tr").forEach((tr) => (tr.style.display = ""));
  }

  // Filter listener
  filter?.addEventListener("change", applyFilter);

  // Load on page ready
  document.addEventListener("DOMContentLoaded", loadUsers);
  window.SmartLabReloadUsers = loadUsers;
})();
