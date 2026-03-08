/* =========================================
   SmartLab – Admin: Request Management System
   Load, filter, approve, reject with reason
   =========================================
*/

// Helper functions - using core utilities when available
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
    .replaceAll("'", "&#39;");
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch (err) {
    console.error('Failed to parse JSON response:', err);
    return {};
  }
};

const showNotification = (message, type = 'info') => {
  if (window.SmartLab?.Utils?.showNotification) {
    window.SmartLab.Utils.showNotification(message, type);
  } else {
    // Fallback to alert
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

// =========================================================
// REQUEST FILTERING SYSTEM
// =========================================================
let allRequests = [];
let currentRequestFilter = 'all';

async function loadAllRequests() {
  const tbody = document.getElementById('pending-requests-tbody');
  if (!tbody) {
    console.error('pending-requests-tbody not found!');
    return;
  }
  
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading requests...</td></tr>`;
  
  try {
    let res = await fetch('/api/borrowRequests/all');
    let data = await safeJson(res);
    
    console.log('🔍 Admin Requests Debug - Initial API call:', {
      url: '/api/borrowRequests/all',
      status: res.status,
      ok: res.ok,
      dataType: typeof data,
      isArray: Array.isArray(data),
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      sampleData: Array.isArray(data) && data.length > 0 ? data[0] : 'No data'
    });
    
    if (!res.ok) {
      console.log('/api/borrowRequests/all not available, falling back to pending requests');
      // Fallback to pending requests if "all" endpoint doesn't exist
      console.log('Trying fallback /api/borrowRequests/pending...');
      res = await fetch('/api/borrowRequests/pending');
      console.log('Fallback API Response status:', res.status);
      
      data = await safeJson(res);
      console.log('Fallback API Response data:', data);
      
      if (!res.ok) {
        console.error('Failed to load pending requests:', data);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: red;">Failed to load requests. Please refresh the page.</td></tr>`;
        allRequests = [];
        return;
      }
      
      // Convert pending requests to the expected format
      allRequests = Array.isArray(data) ? data.map(req => ({...req, status_id: 1})) : [];
    } else {
      allRequests = Array.isArray(data) ? data : [];
    }
    
    console.log('🔍 Admin Requests Debug - Final data:', {
      allRequestsLength: allRequests.length,
      sampleRequest: allRequests.length > 0 ? allRequests[0] : 'No requests'
    });
    
    // Initial render with "all" filter
    filterAndRenderRequests();
    
  } catch (err) {
    console.error('Error in loadAllRequests:', err);
    console.error('Error stack:', err.stack);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: red;">Error loading requests: ${err.message}</td></tr>`;
    allRequests = [];
  }
}

function filterAndRenderRequests() {
  const tbody = document.getElementById('pending-requests-tbody');
  if (!tbody) {
    console.error('pending-requests-tbody not found');
    return;
  }

  console.log('🔍 Admin Filter Debug:', {
    allRequestsLength: allRequests.length,
    currentFilter: currentRequestFilter
  });

  let filteredRequests = allRequests;
  
  // Apply status filter
  if (currentRequestFilter !== 'all') {
    filteredRequests = allRequests.filter(request => {
      const status = getStatusText(request.status_id);
      return status === currentRequestFilter;
    });
  }
  
  console.log('🔍 Admin Filter Debug - After filtering:', {
    filteredRequestsLength: filteredRequests.length,
    filterApplied: currentRequestFilter !== 'all'
  });
  
  if (filteredRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px;">
          ${currentRequestFilter === 'all' 
            ? 'No requests found' 
            : `No ${currentRequestFilter.toLowerCase()} requests found`}
        </td>
      </tr>
    `;
    console.log('Rendered empty state');
    return;
  }

  tbody.innerHTML = filteredRequests.map(request => {
    const start = (request.time_start || request.time_of_use) ? String(request.time_start || request.time_of_use).slice(0, 5) : "-";
    const end = request.time_end ? String(request.time_end).slice(0, 5) : "";
    const timeRange = end ? `${start} - ${end}` : start;

    // Extract user information
    const role = request.role_name || "Faculty";
    const fullName = request.full_name || "-";
    const room = request.location || "-";
    
    // Extract equipment information
    let equipment = "-";
    if (request.equipment_list && request.equipment_list.trim()) {
      equipment = request.equipment_list;
    } else if (request.particulars) {
      // Extract equipment from particulars if equipment_list is empty
      const parts = request.particulars.split(', ');
      if (parts.length > 1) {
        equipment = parts.slice(1).join(', '); // Skip location, get equipment
      }
    }

    const dateText = formatDate(request.date_needed);
    const status = getStatusText(request.status_id);
    const statusClass = getStatusClass(request.status_id);

    return `
      <tr data-id="${request.borrow_request_id}">
        <td>${escapeHtml(role)}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(room)}</td>
        <td>${escapeHtml(equipment)}</td>
        <td>${escapeHtml(dateText)}</td>
        <td>${escapeHtml(timeRange)}</td>
        <td>
          <span class="status-badge ${statusClass}">${status}</span>
        </td>
        <td>
          ${request.status_id === 1 ? `
            <button class="btn btnSmall btnPrimary btn-approve">Approve</button>
            <button class="btn btnSmall btnDanger btn-reject">Reject</button>
          ` : ''}
          ${request.status_id === 2 ? `
            <button class="btn btnSmall btnSuccess btn-returned">Returned</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join("");
}

function getStatusText(statusId) {
  const statusMap = {
    1: 'Pending',
    2: 'Approved', 
    3: 'Cancelled',
    4: 'Declined',
    5: 'Returned'
  };
  return statusMap[statusId] || 'Unknown';
}

function getStatusClass(statusId) {
  const classMap = {
    1: 'status-pending',
    2: 'status-approved',
    3: 'status-cancelled', 
    4: 'status-declined',
    5: 'status-returned'
  };
  return classMap[statusId] || 'status-unknown';
}

function attachRequestEventListeners() {
  // This will be called after each render to re-attach event listeners
  console.log('Attaching event listeners for approve/reject buttons');
}

// =========================================================
// LEGACY PENDING REQUESTS (DISABLED)
// =========================================================
// async function loadPendingRequests() { ... }

document.addEventListener('DOMContentLoaded', () => {
  
  // Initialize filter dropdown
  const filterSelect = document.getElementById('request-status-filter');
  if (filterSelect) {
    // Set default value to "all"
    filterSelect.value = 'all';    
    filterSelect.addEventListener('change', function(e) {
      currentRequestFilter = e.target.value;
      filterAndRenderRequests();
    });
  } else {
    console.log('Filter dropdown not found!');
  }
  
  // Load requests immediately
  loadAllRequests();
  
  // Define updateRequestStatus function first
  async function updateRequestStatus(id, status_id, rejection_reason = null) {
    console.log('=== UPDATE REQUEST STATUS START ===');
    console.log('Updating request ID:', id, 'to status_id:', status_id);
    console.log('Rejection reason:', rejection_reason);
    
    try {
      const requestBody = { status_id, rejection_reason };
      console.log('Request body:', requestBody);
      
      const res = await fetch(`/api/borrowRequests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('API Response status:', res.status);
      console.log('API Response ok:', res.ok);
      
      if (!res.ok) {
        const data = await res.json();
        console.error('API Error Response:', data);
        showNotification(`❌ ${data.message || "Failed to update status."}`, 'error');
        return false;
      }
      
      const data = await res.json();
      console.log('API Success Response:', data);
      console.log('=== UPDATE REQUEST STATUS END ===');
      return true;
    } catch (err) {
      console.error('Network error in updateRequestStatus:', err);
      console.error('Error stack:', err.stack);
      showNotification("🔌 Server error. Try again.", 'error');
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
      console.log('Approve button clicked for request:', id);
      
      const confirmed = window.showConfirmation ? 
        await window.showConfirmation({
          title: "✅ Approve Request",
          message: "Are you sure you want to approve this request?",
          type: "info",
          confirmText: "Approve",
          cancelText: "Cancel"
        }) :
        confirm("Approve this request?");
        
      if (!confirmed) {
        console.log('User cancelled approval');
        return;
      }
      console.log('User confirmed approval, calling updateRequestStatus...');
      const ok = await updateRequestStatus(id, 2);
      console.log('updateRequestStatus returned:', ok);
      if (ok) {
        await loadAllRequests();
        showNotification('✅ Request approved successfully!', 'success');
      }
      return;
    }

    if (e.target.classList.contains("btn-returned")) {
      console.log('Returned button clicked for request:', id);
      
      const confirmed = window.showConfirmation ? 
        await window.showConfirmation({
          title: "🔄 Mark as Returned",
          message: "Are you sure you want to mark this request as returned?",
          type: "info",
          confirmText: "Mark Returned",
          cancelText: "Cancel"
        }) :
        confirm("Mark this request as returned?");
        
      if (!confirmed) {
        console.log('User cancelled return');
        return;
      }
      console.log('User confirmed return, calling updateRequestStatus...');
      const ok = await updateRequestStatus(id, 5); // 5 = Returned (per seeders)
      console.log('updateRequestStatus returned:', ok);
      if (ok) {
        await loadAllRequests();
        showNotification('🔄 Request marked as returned!', 'success');
      }
      return;
    }

    if (e.target.classList.contains("btn-reject")) {
      console.log('Reject button clicked for request:', id);
      const noteDiv = e.target.nextElementSibling;
      if (noteDiv && noteDiv.classList.contains("rejection-note")) {
        noteDiv.classList.toggle("hidden");
        return;
      }

      const confirmed = window.showConfirmation ? 
        await window.showConfirmation({
          title: "❌ Reject Request",
          message: "Are you sure you want to reject this request?",
          type: "warning",
          confirmText: "Reject",
          cancelText: "Cancel"
        }) :
        confirm("Reject this request?");
        
      if (!confirmed) {
        console.log('User cancelled rejection');
        return;
      }
      console.log('User confirmed rejection, calling updateRequestStatus...');
      const ok = await updateRequestStatus(id, 4); // 4 = Declined (per seeders)
      console.log('updateRequestStatus returned:', ok);
      if (ok) {
        await loadAllRequests();
        showNotification('❌ Request declined', 'success');
      }
      return;
    }

    if (e.target.classList.contains("btn-cancel-reject")) {
      row.querySelector(".reject-reason").value = "";
      row.querySelector(".rejection-note")?.classList.add("hidden");
      return;
    }

    if (e.target.classList.contains("btn-reject-confirm")) {
      const reason = row.querySelector(".reject-reason")?.value?.trim() || "";
      if (!reason) {
        showNotification("⚠️ Please provide a reason for rejection.", 'warning');
        return;
      }
      
      const confirmed = window.showConfirmation ? 
        await window.showConfirmation({
          title: "❌ Reject with Reason",
          message: `Reject this request with the following reason?\n\n"${reason}"`,
          type: "warning",
          confirmText: "Reject",
          cancelText: "Cancel"
        }) :
        confirm(`Reject this request? Reason: ${reason}`);

      if (!confirmed) return;

      const ok = await updateRequestStatus(id, 3, reason); // 3 = Declined (per seeders)
      if (ok) {
        await loadAllRequests();
        showNotification('❌ Request rejected with reason', 'success');
      }
    }
  });

  // Export
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminRequests = { 
    loadAllRequests,
    filterAndRenderRequests,
    getStatusText,
    getStatusClass,
    updateRequestStatus, // Export for testing
    testStatusUpdate: async function(requestId, statusId) {
      console.log(`Testing status update: Request ${requestId} → Status ${statusId}`);
      const result = await updateRequestStatus(requestId, statusId);
      console.log('Test result:', result);
      return result;
    }
  };
});
