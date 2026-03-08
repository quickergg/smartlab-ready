/* =========================================
   SmartLab – Shared Table Utilities
   Renderers, filters, and helpers
========================================= */

(() => {
  // Minimal HTML escaping
  function escapeHtml(val) {
    return String(val ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Format date to YYYY-MM-DD
  function formatDate(d) {
    return d ? new Date(d).toISOString().slice(0, 10) : "-";
  }

  // Render a table from rows
  function renderTable(tbodyId, rows, columnsMap, formatters = {}) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!Array.isArray(rows)) {
      tbody.innerHTML = `<tr><td colspan="${Object.keys(columnsMap).length}">Invalid data.</td></tr>`;
      return;
    }
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${Object.keys(columnsMap).length}">No records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const tds = Object.entries(columnsMap)
          .map(([key, header]) => {
            const raw = row[key];
            const formatted = formatters[key] ? formatters[key](raw, row) : escapeHtml(raw);
            return `<td>${formatted}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
  }

  // Setup a filter dropdown for a table column
  function setupFilter(selectId, tableId, columnIndex) {
    const filterSelect = document.getElementById(selectId);
    const table = document.getElementById(tableId);
    if (!filterSelect || !table) return;

    filterSelect.addEventListener("change", (e) => {
      const filterValue = e.target.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cellText = row.cells[columnIndex]?.innerText.toLowerCase() || "";
        row.style.display = filterValue === "all" || cellText.includes(filterValue) ? "" : "none";
      });
    });
  }

  // Status pill CSS class helper
  function statusClass(statusName = "") {
    const s = String(statusName).toLowerCase();
    if (s.includes("approve")) return "status-approved";
    if (s.includes("decline")) return "status-declined";
    if (s.includes("cancel")) return "status-cancelled";
    return "status-pill";
  }

  // Export
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.TableUtils = {
    escapeHtml,
    formatDate,
    renderTable,
    setupFilter,
    statusClass
  };
})();
