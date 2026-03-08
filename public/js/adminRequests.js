/* =========================================
   SmartLab – Admin: Pending Requests
   Load, approve, reject with reason
========================================= */

// Helper functions
const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "-");
const escapeHtml = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById("pending-requests-tbody");
  if (!tbody) return;

  async function loadPendingRequests() {
    tbody.innerHTML = `<tr><td colspan="5">Loading pending requests...</td></tr>`;
    try {
      const res = await fetch("/api/borrowRequests/pending");
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="5">Failed to load requests.</td></tr>`;
        return;
      }
      const rows = await res.json();
      if (!Array.isArray(rows)) {
        tbody.innerHTML = `<tr><td colspan="5">Invalid data.</td></tr>`;
        return;
      }
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No pending requests.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const start = (r.time_start || r.time_of_use) ? String(r.time_start || r.time_of_use).slice(0, 5) : "-";
        const end = r.time_end ? String(r.time_end).slice(0, 5) : "";
        const timeRange = end ? `${start} - ${end}` : start;

        const requesterEmail = r.requester_gmail || r.gmail || "-";
        const particulars = (r.particulars && String(r.particulars).trim())
          ? String(r.particulars).trim()
          : (r.subject && String(r.subject).trim())
          ? String(r.subject).trim()
          : (r.purpose && String(r.purpose).trim())
          ? String(r.purpose).trim()
          : "-";

        const dateText = formatDate(r.date_needed);
        
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
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5">Server error.</td></tr>`;
    }
  }

  async function updateRequestStatus(id, status_id, rejection_reason = null) {
    try {
      const res = await fetch(`/api/borrowRequests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id, rejection_reason })
      });
      if (!res.ok) {
        alert("Failed to update status.");
        return false;
      }
      alert("Status updated.");
      return true;
    } catch (err) {
      console.error(err);
      alert("Server error. Try again.");
      return false;
    }
  }

  // Event delegation for approve/reject
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

  // Export
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminRequests = { loadPendingRequests };
  
  // Auto-load pending requests
  loadPendingRequests();
});
