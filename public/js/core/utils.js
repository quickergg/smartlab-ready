/* =========================================
   SmartLab – Core Utilities
   Shared functions, helpers, and constants
========================================= */

(() => {
  'use strict';

  // =========================================================
  // STRING UTILITIES
  // =========================================================
  
  // Minimal HTML escaping to prevent XSS
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

  // Safe JSON parsing with error handling
  function safeJson(res) {
    const text = res.text ? res.text() : res;
    if (typeof text === 'string') {
      try { return JSON.parse(text); }
      catch { return { message: text || "Unexpected server response" }; }
    }
    return text;
  }

  // =========================================================
  // REQUEST STATUS CONSTANTS & HELPERS
  // =========================================================
  
  const REQUEST_STATUS = {
    PENDING: 1,
    APPROVED: 2,
    DECLINED: 3,
    CANCELLED: 4,
    RETURNED: 5
  };

  const REQUEST_STATUS_TEXT = {
    1: 'Pending',
    2: 'Approved', 
    3: 'Declined',
    4: 'Cancelled',
    5: 'Returned'
  };

  const REQUEST_STATUS_CLASS = {
    1: 'status-pending',
    2: 'status-approved',
    3: 'status-declined',
    4: 'status-cancelled',
    5: 'status-returned'
  };

  function getStatusText(statusId) {
    return REQUEST_STATUS_TEXT[statusId] || 'Unknown';
  }

  function getStatusClass(statusId) {
    return REQUEST_STATUS_CLASS[statusId] || 'status-unknown';
  }

  // =========================================================
  // TABLE RENDERING UTILITIES
  // =========================================================
  
  // Render a table from rows data
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

    tbody.innerHTML = rows.map(row => {
      const cells = Object.entries(columnsMap).map(([key, header]) => {
        let value = row[key];
        
        // Apply formatter if exists
        if (formatters[key] && typeof formatters[key] === 'function') {
          value = formatters[key](value, row);
        } else {
          value = escapeHtml(value ?? '-');
        }
        
        return `<td>${value}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');
  }

  // =========================================================
  // NOTIFICATION SYSTEM
  // =========================================================
  
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      ${type === 'success' ? 'background: #28a745;' : ''}
      ${type === 'error' ? 'background: #dc3545;' : ''}
      ${type === 'info' ? 'background: #17a2b8;' : ''}
      ${type === 'warning' ? 'background: #ffc107; color: #212529;' : ''}
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // =========================================================
  // ERROR HANDLING UTILITIES
  // =========================================================
  
  function handleApiError(error, context = 'API call') {
    console.error(`${context} error:`, error);
    
    if (error.message) {
      showNotification(error.message, 'error');
    } else {
      showNotification(`${context} failed. Please try again.`, 'error');
    }
  }

  function logError(context, error, additionalInfo = {}) {
    console.error(`=== ${context} ERROR ===`);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    if (Object.keys(additionalInfo).length > 0) {
      console.error('Additional Info:', additionalInfo);
    }
    console.error(`=== END ${context} ERROR ===`);
  }

  // =========================================================
  // DOM UTILITIES
  // =========================================================
  
  // Safe DOM element getters (complementary to core.js $ function)
  function getSelector(selector) {
    return document.querySelector(selector);
  }

  function getSelectorAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  // Safe form value extraction
  function getFormValue(form, fieldName, defaultValue = '') {
    return form?.querySelector(`[name="${fieldName}"]`)?.value?.trim() || defaultValue;
  }

  // Safe element value getter
  function getElementValue(elementId, defaultValue = '') {
    const element = document.getElementById(elementId);
    return element ? (element.value || '').trim() : defaultValue;
  }

  // =========================================================
  // TIME UTILITIES
  // =========================================================
  
  // Format time (HH:MM from time strings)
  function formatTime(timeStr) {
    return timeStr ? String(timeStr).slice(0, 5) : "-";
  }

  // Format time ago (from adminDashboard.js - moved here for reuse)
  function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown time';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  // Combine date and time for datetime inputs
  function combineDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const timePart = timeStr || '00:00';
    return `${dateStr}T${timePart}:00`;
  }

  // =========================================================
  // VALIDATION UTILITIES
  // =========================================================
  
  // Required field validation
  function validateRequired(fields) {
    const missing = [];
    fields.forEach(({ name, value, label }) => {
      if (!value || !value.trim()) {
        missing.push(label || name);
      }
    });
    return {
      isValid: missing.length === 0,
      missing,
      message: missing.length > 0 ? `Please fill in: ${missing.join(', ')}` : ''
    };
  }

  // Email validation
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // =========================================================
  // MODAL UTILITIES
  // =========================================================
  
  // Standard modal show/hide
  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
    }
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex-display");
    }
  }

  function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      const isHidden = modal.classList.contains("hidden");
      if (isHidden) {
        showModal(modalId);
      } else {
        hideModal(modalId);
      }
    }
  }

  // Custom confirmation modal
  function showConfirmation(options) {
    return new Promise((resolve) => {
      const {
        title = "Confirm Action",
        message = "Are you sure you want to proceed?",
        confirmText = "Confirm",
        cancelText = "Cancel",
        type = "warning", // 'warning', 'danger', 'info'
        requireCheckbox = false,
        checkboxText = "I understand that this action cannot be undone",
        details = null // Array of {label, value} objects
      } = options;
      
      // Create modal if it doesn't exist
      let modal = document.getElementById("confirmation-modal");
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmation-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-card" style="max-width: 450px;">
            <div class="cardHeader">
              <h3 id="confirmation-title"></h3>
              <button class="close-confirmation">&times;</button>
            </div>
            <div style="padding: 20px;">
              <div class="confirmation-content">
                <div id="confirmation-message" style="margin-bottom: 15px;"></div>
                <div id="confirmation-details" style="margin-bottom: 15px;"></div>
                <div id="confirmation-warning" style="margin-bottom: 20px; display: none;"></div>
                <div id="confirmation-checkbox-container" style="margin-bottom: 20px; display: none;">
                  <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="confirmation-checkbox" style="margin-right: 8px;">
                    <span id="confirmation-checkbox-text"></span>
                  </label>
                </div>
              </div>
              <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary cancel-confirmation" style="padding: 8px 16px;">
                  <span id="confirmation-cancel-text"></span>
                </button>
                <button class="btn btn-primary confirm-confirmation" style="padding: 8px 16px;">
                  <span id="confirmation-confirm-text"></span>
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      
      // Get elements
      const titleElement = modal.querySelector("#confirmation-title");
      const messageElement = modal.querySelector("#confirmation-message");
      const detailsElement = modal.querySelector("#confirmation-details");
      const warningElement = modal.querySelector("#confirmation-warning");
      const checkboxContainer = modal.querySelector("#confirmation-checkbox-container");
      const checkboxTextElement = modal.querySelector("#confirmation-checkbox-text");
      const checkbox = modal.querySelector("#confirmation-checkbox");
      const confirmBtn = modal.querySelector(".confirm-confirmation");
      const cancelBtn = modal.querySelector(".cancel-confirmation");
      const closeBtn = modal.querySelector(".close-confirmation");
      const confirmTextElement = modal.querySelector("#confirmation-confirm-text");
      const cancelTextElement = modal.querySelector("#confirmation-cancel-text");
      
      // Set content
      if (titleElement) titleElement.textContent = title;
      if (messageElement) messageElement.textContent = message;
      if (confirmTextElement) confirmTextElement.textContent = confirmText;
      if (cancelTextElement) cancelTextElement.textContent = cancelText;
      
      // Set details if provided
      if (details && details.length > 0) {
        detailsElement.innerHTML = details.map(detail => 
          `<div style="margin-bottom: 5px;"><strong>${detail.label}:</strong> ${detail.value}</div>`
        ).join('');
        detailsElement.style.display = 'block';
      } else {
        detailsElement.style.display = 'none';
      }
      
      // Set warning based on type
      const warningMessages = {
        warning: "⚠️ Warning: This action may have important consequences.",
        danger: "🚨 Danger: This action cannot be undone and will permanently change data.",
        info: "ℹ️ Information: Please review the details before proceeding."
      };
      
      if (type && warningMessages[type]) {
        warningElement.textContent = warningMessages[type];
        warningElement.style.display = 'block';
        warningElement.style.color = type === 'danger' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8';
      } else {
        warningElement.style.display = 'none';
      }
      
      // Set checkbox if required
      if (requireCheckbox) {
        checkboxContainer.style.display = 'block';
        if (checkboxTextElement) checkboxTextElement.textContent = checkboxText;
        if (checkbox) checkbox.checked = false;
      } else {
        checkboxContainer.style.display = 'none';
      }
      
      // Set button styles based on type
      if (confirmBtn) {
        confirmBtn.className = `btn ${type === 'danger' ? 'btnDanger' : type === 'warning' ? 'btn-warning' : 'btn-primary'}`;
        confirmBtn.disabled = requireCheckbox;
      }
      
      // Show modal
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
      
      // Handle checkbox change
      const handleCheckboxChange = () => {
        if (confirmBtn && requireCheckbox) {
          confirmBtn.disabled = !checkbox.checked;
        }
      };
      
      // Handle confirm
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      
      // Handle cancel
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      // Cleanup function
      const cleanup = () => {
        if (checkbox) checkbox.removeEventListener('change', handleCheckboxChange);
        if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
        
        modal.classList.add("hidden");
        modal.classList.remove("flex-display");
      };
      
      // Add event listeners
      if (checkbox && requireCheckbox) checkbox.addEventListener('change', handleCheckboxChange);
      if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
      if (closeBtn) closeBtn.addEventListener('click', handleCancel);
      
      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      });
    });
  }

  // =========================================================
  // EXPORT TO GLOBAL SCOPE
  // =========================================================
  
  // Create SmartLab namespace if it doesn't exist
  window.SmartLab = window.SmartLab || {};
  
  try {
    window.SmartLab.Utils = {
      // Only export functions that definitely exist
      escapeHtml,
      formatDate,
      safeJson,
      handleApiError,
      logError,
      showNotification,
      $,
      getSelector,
      getSelectorAll,
      getFormValue,
      getElementValue,
      validateRequired,
      isValidEmail,
      showModal,
      hideModal,
      toggleModal,
      showConfirmation
    };
  } catch (error) {
    console.error('Error creating SmartLab.Utils:', error);
  }

  // Also export individual functions for backward compatibility
  window.escapeHtml = escapeHtml;
  window.formatDate = formatDate;
  window.safeJson = safeJson;
  window.showNotification = showNotification;
  window.formatTime = formatTime;
  window.formatTimeAgo = formatTimeAgo;
  window.validateRequired = validateRequired;
  window.isValidEmail = isValidEmail;
  window.showModal = showModal;
  window.hideModal = hideModal;
  window.toggleModal = toggleModal;
  window.showConfirmation = showConfirmation;
})();
