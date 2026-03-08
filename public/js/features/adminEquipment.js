/* =========================================
   SmartLab – Admin Equipment Management
   CRUD operations for equipment inventory
========================================= */

// Global cache
let allEquipment = [];
let equipmentStatusOptions = [];

// Initialize on page load with core utilities
document.addEventListener("DOMContentLoaded", async () => {
  // Use proper DOM element selection
  equipmentTbody = document.getElementById("equipment-tbody");
  addEquipmentForm = document.getElementById("add-equipment-form");
  editEquipmentForm = document.getElementById("edit-equipment-form");

  await loadEquipmentStatus();
  await loadEquipment();
  setupEventListeners();
});

// Load equipment status options
async function loadEquipmentStatus() {
  try {
    // Use SmartLab.Api for consistent error handling
    const data = window.SmartLab?.Api?.get ? 
      await window.SmartLab.Api.get("/api/equipment/status") :
      await fetch("/api/equipment/status").then(res => {
        if (!res.ok) throw new Error("Failed to load equipment status");
        return res.json();
      });
    
    equipmentStatusOptions = data;
    populateStatusDropdowns();
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Equipment Status Load', err);
    } else {
      console.error("Failed to load equipment status:", err);
    }
  }
}

// Populate status dropdowns
function populateStatusDropdowns() {
  const editStatusSelect = document.getElementById("edit-equipment-status");
  
  if (editStatusSelect) {
    editStatusSelect.innerHTML = '<option value="">Select status</option>';
    equipmentStatusOptions.forEach(status => {
      const option = document.createElement("option");
      option.value = status.status_id;
      option.textContent = window.SmartLab?.Utils?.escapeHtml ? 
        window.SmartLab.Utils.escapeHtml(status.status_name) : 
        status.status_name;
      editStatusSelect.appendChild(option);
    });
  }
}

// Load all equipment
async function loadEquipment() {
  try {
    // Use SmartLab.Api for consistent error handling
    const data = window.SmartLab?.Api?.get ? 
      await window.SmartLab.Api.get("/api/equipment") :
      await fetch("/api/equipment").then(res => {
        if (!res.ok) throw new Error("Failed to load equipment");
        return res.json();
      });
    
    allEquipment = Array.isArray(data) ? data : [];
    renderEquipmentTable(allEquipment);
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Equipment Load', err);
    } else {
      console.error("Failed to load equipment:", err);
    }
    if (equipmentTbody) {
      equipmentTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">⚠️ Failed to load equipment. Please refresh the page and try again.</td></tr>`;
    }
  }
}

// Render equipment table
function renderEquipmentTable(equipment) {
  if (!equipmentTbody) return;
  
  if (!equipment || equipment.length === 0) {
    equipmentTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #666;">
          No equipment found
        </td>
      </tr>
    `;
    return;
  }
  
  equipmentTbody.innerHTML = equipment.map(item => `
    <tr>
      <td>${window.SmartLab?.Utils?.escapeHtml ? window.SmartLab.Utils.escapeHtml(item.equipment_name) : (item.equipment_name ?? '')}</td>
      <td>${item.total_qty}</td>
      <td>${item.available_qty}</td>
      <td>${item.borrowed_qty}</td>
      <td>${item.damaged_qty}</td>
      <td>
        <span class="status-badge status-${item.status_name.toLowerCase()}">
          ${window.SmartLab?.Utils?.escapeHtml ? window.SmartLab.Utils.escapeHtml(item.status_name) : (item.status_name ?? '')}
        </span>
      </td>
      <td>
        <button class="btn btnSmall btn-edit" onclick="editEquipment(${item.equipment_id})">
          Edit
        </button>
        <button class="btn btnSmall btnDanger btn-delete" onclick="deleteEquipment(${item.equipment_id})">
          Delete
        </button>
      </td>
    </tr>
  `).join('');
}

// Setup event listeners
function setupEventListeners() {
  const qs = window.SmartLab?.Utils?.getSelector || ((sel) => document.querySelector(sel));
  
  // Add equipment form
  if (addEquipmentForm) {
    addEquipmentForm.addEventListener("submit", handleAddEquipment);
  }
  
  // Edit equipment form
  if (editEquipmentForm) {
    editEquipmentForm.addEventListener("submit", handleEditEquipment);
  }
  
  // Modal buttons using core utilities
  qs("#btn-add-equipment")?.addEventListener("click", showAddEquipmentModal);
  qs(".close-modal-equipment")?.addEventListener("click", hideAddEquipmentModal);
  qs(".close-modal-edit-equipment")?.addEventListener("click", hideEditEquipmentModal);
}

// Show add equipment modal
function showAddEquipmentModal() {
  if (window.SmartLab?.Utils?.showModal) {
    window.SmartLab.Utils.showModal("modal-add-equipment");
    addEquipmentForm?.reset();
  } else {
    // Fallback to manual modal handling
    const modal = document.getElementById("modal-add-equipment");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
      addEquipmentForm?.reset();
    }
  }
}

// Hide add equipment modal
function hideAddEquipmentModal() {
  if (window.SmartLab?.Utils?.hideModal) {
    window.SmartLab.Utils.hideModal("modal-add-equipment");
  } else {
    // Fallback to manual modal handling
    const modal = document.getElementById("modal-add-equipment");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex-display");
    }
  }
}

// Show edit equipment modal
function showEditEquipmentModal(equipment) {
  const $ = window.$ || ((id) => document.getElementById(id));
  
  if (window.SmartLab?.Utils?.showModal) {
    window.SmartLab.Utils.showModal("modal-edit-equipment");
  } else {
    // Fallback to manual modal handling
    const modal = document.getElementById("modal-edit-equipment");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex-display");
    }
  }
  
  // Populate form fields using core utilities
  const editId = document.getElementById("edit-equipment-id");
  const editName = document.getElementById("edit-equipment-name");
  const editTotalQty = document.getElementById("edit-total-qty");
  const editAvailableQty = document.getElementById("edit-available-qty");
  const editStatus = document.getElementById("edit-equipment-status");
  
  if (editId) editId.value = equipment.equipment_id;
  if (editName) editName.value = equipment.equipment_name || '';
  if (editTotalQty) editTotalQty.value = equipment.total_qty || '';
  if (editAvailableQty) editAvailableQty.value = equipment.available_qty || '';
  if (editStatus) editStatus.value = equipment.status_id || '';
  
  // Add real-time validation for total quantity
  setupTotalQuantityValidation(equipment);
}

// Setup real-time validation for total quantity input
function setupTotalQuantityValidation(equipment) {
  const totalQtyInput = document.getElementById("edit-total-qty");
  const equipmentNameInput = document.getElementById("edit-equipment-name");
  const validationMessage = document.getElementById("edit-total-qty-validation") || document.querySelector("#edit-total-qty + small") || document.querySelector('small[for="edit-total-qty"]');
  const submitButton = document.querySelector("#edit-equipment-form button[type='submit']");
  
  if (!totalQtyInput || !validationMessage) return;
  
  // Store equipment data for validation
  const borrowedQty = equipment.borrowed_qty || 0;
  const damagedQty = equipment.damaged_qty || 0;
  const equipmentName = equipment.equipment_name || 'equipment';
  
  // Calculate minimum required total quantity
  const minimumTotal = borrowedQty + damagedQty;
  
  // Validation function
  function validateForm() {
    const currentQty = parseInt(totalQtyInput.value) || 0;
    const currentName = equipmentNameInput ? equipmentNameInput.value.trim() : '';
    let isValid = true;
    let validationMessageText = '';
    
    // Validate equipment name
    if (!currentName) {
      if (equipmentNameInput) {
        equipmentNameInput.style.borderColor = '#dc3545';
      }
      isValid = false;
    } else if (equipmentNameInput) {
      equipmentNameInput.style.borderColor = '';
    }
    
    // Validate total quantity
    if (currentQty < minimumTotal) {
      // Show detailed validation message
      validationMessageText = `You can't go below ${minimumTotal} total quantity value because `;
      const reasons = [];
      
      if (borrowedQty > 0) {
        reasons.push(`${borrowedQty} ${equipmentName} ${borrowedQty === 1 ? 'is' : 'are'} currently borrowed`);
      }
      
      if (damagedQty > 0) {
        reasons.push(`${damagedQty} ${equipmentName} ${damagedQty === 1 ? 'is' : 'are'} currently damaged`);
      }
      
      validationMessageText += reasons.join(' and ') + '.';
      
      validationMessage.textContent = validationMessageText;
      validationMessage.style.color = '#dc3545'; // Red color for error
      validationMessage.style.display = 'block';
      totalQtyInput.style.borderColor = '#dc3545'; // Red border for invalid input
      isValid = false;
    } else {
      // Clear validation message
      validationMessage.textContent = '';
      validationMessage.style.display = 'none';
      totalQtyInput.style.borderColor = ''; // Reset border color
    }
    
    // Enable/disable submit button based on validation
    if (submitButton) {
      submitButton.disabled = !isValid;
      submitButton.style.opacity = isValid ? '1' : '0.6';
      submitButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
      
      // Update button text to indicate state
      if (!isValid) {
        if (!submitButton.getAttribute('data-original-text')) {
          submitButton.setAttribute('data-original-text', submitButton.textContent);
        }
        submitButton.textContent = 'Update Equipment';
      } else {
        const originalText = submitButton.getAttribute('data-original-text');
        if (originalText) {
          submitButton.textContent = originalText;
          submitButton.removeAttribute('data-original-text');
        }
      }
    }
    
    return isValid;
  }
  
  // Add event listeners
  totalQtyInput.addEventListener('input', validateForm);
  totalQtyInput.addEventListener('blur', validateForm); // Add blur event for persistent validation
  totalQtyInput.addEventListener('focus', validateForm); // Add focus event to show validation when returning to field
  if (equipmentNameInput) {
    equipmentNameInput.addEventListener('input', validateForm);
    equipmentNameInput.addEventListener('blur', validateForm); // Add blur event for name field too
    equipmentNameInput.addEventListener('focus', validateForm); // Add focus event for name field too
  }
  
  // Store the validation function for cleanup
  totalQtyInput._validationHandler = validateForm;
  if (equipmentNameInput) {
    equipmentNameInput._validationHandler = validateForm;
  }
  
  // Initial validation check
  validateForm();
}

// Cleanup validation when modal is hidden
function cleanupValidation() {
  const totalQtyInput = document.getElementById("edit-total-qty");
  const equipmentNameInput = document.getElementById("edit-equipment-name");
  const validationMessage = document.getElementById("edit-total-qty-validation") || document.querySelector("#edit-total-qty + small") || document.querySelector('small[for="edit-total-qty"]');
  const submitButton = document.querySelector("#edit-equipment-form button[type='submit']");
  
  if (totalQtyInput && totalQtyInput._validationHandler) {
    totalQtyInput.removeEventListener('input', totalQtyInput._validationHandler);
    totalQtyInput.removeEventListener('blur', totalQtyInput._validationHandler); // Remove blur listener too
    totalQtyInput.removeEventListener('focus', totalQtyInput._validationHandler); // Remove focus listener too
    delete totalQtyInput._validationHandler;
  }
  
  if (equipmentNameInput && equipmentNameInput._validationHandler) {
    equipmentNameInput.removeEventListener('input', equipmentNameInput._validationHandler);
    equipmentNameInput.removeEventListener('blur', equipmentNameInput._validationHandler); // Remove blur listener too
    equipmentNameInput.removeEventListener('focus', equipmentNameInput._validationHandler); // Remove focus listener too
    delete equipmentNameInput._validationHandler;
  }
  
  if (validationMessage) {
    validationMessage.textContent = '';
    validationMessage.style.display = 'none';
  }
  
  if (totalQtyInput) {
    totalQtyInput.style.borderColor = '';
  }
  
  if (equipmentNameInput) {
    equipmentNameInput.style.borderColor = '';
  }
  
  // Reset submit button to original state
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.style.opacity = '1';
    submitButton.style.cursor = 'pointer';
    const originalText = submitButton.getAttribute('data-original-text');
    if (originalText) {
      submitButton.textContent = originalText;
      submitButton.removeAttribute('data-original-text');
    }
  }
}

// Hide edit equipment modal
function hideEditEquipmentModal() {
  // Cleanup validation before hiding modal
  cleanupValidation();
  
  if (window.SmartLab?.Utils?.hideModal) {
    window.SmartLab.Utils.hideModal("modal-edit-equipment");
  } else {
    // Fallback to manual modal handling
    const modal = document.getElementById("modal-edit-equipment");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex-display");
    }
  }
}

// Handle add equipment
async function handleAddEquipment(e) {
  e.preventDefault();
  
  // Use SmartLab.Utils.getFormValue for cleaner form handling
  const equipmentName = window.SmartLab?.Utils?.getFormValue ? 
    window.SmartLab.Utils.getFormValue(addEquipmentForm, "equipment_name") :
    addEquipmentForm?.querySelector("[name='equipment_name']")?.value?.trim() || '';
    
  const totalQty = parseInt(window.SmartLab?.Utils?.getFormValue ? 
    window.SmartLab.Utils.getFormValue(addEquipmentForm, "total_qty") :
    addEquipmentForm?.querySelector("[name='total_qty']")?.value || '0');
  
  // Client-side validation using SmartLab.Utils
  if (!equipmentName) {
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("⚠️ Equipment name is required. Please enter a name for the equipment.", "error");
    } else {
      alert("⚠️ Equipment name is required. Please enter a name for the equipment.");
    }
    return;
  }
  
  if (totalQty < 0) {
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("📊 Total quantity cannot be negative. Please enter a valid quantity (0 or greater).", "error");
    } else {
      alert("📊 Total quantity cannot be negative. Please enter a valid quantity (0 or greater).");
    }
    return;
  }
  
  const data = {
    equipment_name: equipmentName,
    total_qty: totalQty
  };
  
  try {
    // Use SmartLab.Api for consistent error handling
    const result = window.SmartLab?.Api?.post ? 
      await window.SmartLab.Api.post("/api/equipment", data) :
      await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => {
        if (!res.ok) throw new Error("Failed to add equipment");
        return res.json();
      });
    
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("✅ Equipment added successfully! The new equipment has been added to the inventory.", "success");
    } else {
      alert("✅ Equipment added successfully! The new equipment has been added to the inventory.");
    }
    
    hideAddEquipmentModal();
    await loadEquipment();
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Add Equipment', err);
    } else {
      console.error("Failed to add equipment:", err);
    }
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("❌ Failed to add equipment. Please check your connection and try again.", "error");
    } else {
      alert("❌ Failed to add equipment. Please check your connection and try again.");
    }
  }
}

// Handle edit equipment
async function handleEditEquipment(e) {
  e.preventDefault();
  
  const equipmentId = document.getElementById("edit-equipment-id")?.value || '';
  
  // Use SmartLab.Utils.getFormValue for cleaner form handling
  const equipmentName = window.SmartLab?.Utils?.getFormValue ? 
    window.SmartLab.Utils.getFormValue(editEquipmentForm, "equipment_name") :
    editEquipmentForm?.querySelector("[name='equipment_name']")?.value?.trim() || '';
    
  const totalQty = parseInt(window.SmartLab?.Utils?.getElementValue ? 
    window.SmartLab.Utils.getElementValue("edit-total-qty") :
    document.getElementById("edit-total-qty")?.value || '0');
  
  // Client-side validation using SmartLab.Utils
  if (!equipmentName) {
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("⚠️ Equipment name is required. Please enter a name for the equipment.", "error");
    } else {
      alert("⚠️ Equipment name is required. Please enter a name for the equipment.");
    }
    return;
  }
  
  if (totalQty < 0) {
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("📊 Total quantity cannot be negative. Please enter a valid quantity (0 or greater).", "error");
    } else {
      alert("📊 Total quantity cannot be negative. Please enter a valid quantity (0 or greater).");
    }
    return;
  }
  
  const data = {
    equipment_name: equipmentName,
    total_qty: totalQty
  };
  
  try {
    // Use SmartLab.Api for consistent error handling
    const result = window.SmartLab?.Api?.put ? 
      await window.SmartLab.Api.put(`/api/equipment/${equipmentId}`, data) :
      await fetch(`/api/equipment/${equipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => {
        if (!res.ok) throw new Error("Failed to update equipment");
        return res.json();
      });
    
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("✅ Equipment updated successfully! The changes have been saved to the inventory.", "success");
    } else {
      alert("✅ Equipment updated successfully! The changes have been saved to the inventory.");
    }
    
    hideEditEquipmentModal();
    await loadEquipment();
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Edit Equipment', err);
    } else {
      console.error("Failed to update equipment:", err);
    }
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("❌ Failed to update equipment. Please check your connection and try again.", "error");
    } else {
      alert("❌ Failed to update equipment. Please check your connection and try again.");
    }
  }
}

// Edit equipment
async function editEquipment(equipmentId) {
  try {
    // Use SmartLab.Api for consistent error handling
    const data = window.SmartLab?.Api?.get ? 
      await window.SmartLab.Api.get(`/api/equipment/${equipmentId}`) :
      await fetch(`/api/equipment/${equipmentId}`).then(res => {
        if (!res.ok) throw new Error("Failed to load equipment");
        return res.json();
      });
    
    showEditEquipmentModal(data);
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Load Equipment for Edit', err);
    } else {
      console.error("Failed to load equipment:", err);
    }
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("❌ Failed to load equipment details. Please try again.", "error");
    } else {
      alert("❌ Failed to load equipment details. Please try again.");
    }
  }
}

// Delete equipment
async function deleteEquipment(equipmentId) {
  console.log('deleteEquipment called with ID:', equipmentId);
  
  try {
    // Use SmartLab.Api for consistent error handling
    const equipment = window.SmartLab?.Api?.get ? 
      await window.SmartLab.Api.get(`/api/equipment/${equipmentId}`) :
      await fetch(`/api/equipment/${equipmentId}`).then(res => {
        if (!res.ok) throw new Error("Failed to get equipment details");
        return res.json();
      });
    
    // Check if equipment has borrowed or damaged items
    const borrowedQty = equipment.borrowed_qty || 0;
    const damagedQty = equipment.damaged_qty || 0;
    
    if (borrowedQty > 0 || damagedQty > 0) {
      let message = "Cannot delete this equipment because ";
      const reasons = [];
      
      if (borrowedQty > 0) {
        reasons.push(`${borrowedQty} equipment${borrowedQty > 1 ? 's are' : ' is'} currently borrowed`);
      }
      
      if (damagedQty > 0) {
        reasons.push(`${damagedQty} equipment${damagedQty > 1 ? 's are' : ' is'} currently damaged`);
      }
      
      message += reasons.join(' and ') + ". Please return all borrowed equipment and repair damaged items before deleting.";
      
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification("⚠️ " + message, "warning");
      } else {
        alert("⚠️ " + message);
      }
      return;
    }
    
    // If no borrowed or damaged items, proceed with deletion confirmation
    console.log('Attempting to show confirmation modal...');
    console.log('SmartLab available:', !!window.SmartLab);
    console.log('SmartLab.Utils available:', !!window.SmartLab?.Utils);
    console.log('showConfirmation available:', !!window.SmartLab?.Utils?.showConfirmation);
    console.log('Global showConfirmation available:', !!window.showConfirmation);
    console.log('Type of showConfirmation:', typeof window.SmartLab?.Utils?.showConfirmation);
    
    // Use global showConfirmation since SmartLab.Utils is not loading properly
    if (window.showConfirmation) {
      console.log('Using global confirmation modal');
      const confirmed = await window.showConfirmation({
        title: "🗑️ Delete Equipment",
        message: `Are you sure you want to delete "${equipment.equipment_name}"?`,
        type: "danger",
        requireCheckbox: true,
        checkboxText: "I understand that this action is permanent and cannot be undone",
        confirmText: "Delete Equipment",
        cancelText: "Cancel",
        details: [
          { label: "Equipment", value: equipment.equipment_name || 'Unknown' },
          { label: "Total Quantity", value: equipment.total_qty || '0' },
          { label: "Available", value: equipment.available_qty || '0' },
          { label: "Borrowed", value: equipment.borrowed_qty || '0' },
          { label: "Damaged", value: equipment.damaged_qty || '0' }
        ]
      });
      
      if (!confirmed) {
        return;
      }
    } else {
      console.log('Global confirmation not available, using fallback');
      // Fallback to browser confirm
      const confirmed = confirm(`🗑️ Are you sure you want to delete "${equipment.equipment_name}"? This action cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }
    
    // Proceed with deletion using SmartLab.Api
    const deleteResult = window.SmartLab?.Api?.delete ? 
      await window.SmartLab.Api.delete(`/api/equipment/${equipmentId}`) :
      await fetch(`/api/equipment/${equipmentId}`, {
        method: "DELETE"
      }).then(res => {
        if (!res.ok) throw new Error("Failed to delete equipment");
        return res.json();
      });
    
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("✅ Equipment deleted successfully! The equipment has been removed from the inventory.", "success");
    } else {
      alert("✅ Equipment deleted successfully! The equipment has been removed from the inventory.");
    }
    
    await loadEquipment();
  } catch (err) {
    if (window.SmartLab?.Utils?.logError) {
      window.SmartLab.Utils.logError('Delete Equipment', err);
    } else {
      console.error("Failed to delete equipment:", err);
    }
    if (window.SmartLab?.Utils?.showNotification) {
      window.SmartLab.Utils.showNotification("❌ Failed to delete equipment. Please check your connection and try again.", "error");
    } else {
      alert("❌ Failed to delete equipment. Please check your connection and try again.");
    }
  }
}

// Make functions globally available
window.editEquipment = editEquipment;
window.deleteEquipment = deleteEquipment;

// Export functions for external use
window.SmartLab = window.SmartLab || {};
window.SmartLab.AdminEquipment = {
  loadEquipment,
  loadEquipmentStatus,
  renderEquipmentTable,
  editEquipment,
  deleteEquipment
};

// Auto-initialize if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    equipmentTbody = document.getElementById("equipment-tbody");
    addEquipmentForm = document.getElementById("add-equipment-form");
    editEquipmentForm = document.getElementById("edit-equipment-form");

    await loadEquipmentStatus();
    await loadEquipment();
    setupEventListeners();
  });
} else {
  // DOM is already ready, initialize immediately
  (async () => {
    equipmentTbody = document.getElementById("equipment-tbody");
    addEquipmentForm = document.getElementById("add-equipment-form");
    editEquipmentForm = document.getElementById("edit-equipment-form");

    await loadEquipmentStatus();
    await loadEquipment();
    setupEventListeners();
  })();
}
