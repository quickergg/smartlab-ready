/* =========================================
   SmartLab – Admin: Users Management
   Account modal, role filter, table rendering
========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const qs = (sel) => document.querySelector(sel);
  const addAccountBtn = qs('#tab-users #open-add-modal') || qs('#tab-users .btn-primary') || qs('#add-user-btn');
  const modalAddAccount = document.getElementById('modal-add-account');
  const closeModalBtn = qs('#modal-add-account .close-modal');
  const cancelModalBtn = document.getElementById('cancel-modal');
  const addAccountForm = document.getElementById('add-account-form');
  const studentFields = document.getElementById('student-extra-fields');
  const roleSelect = document.getElementById('role-select');
  const roleHelp = document.getElementById('role-help');
  const programSelect = document.getElementById('program-select');
  const yearSelect = document.getElementById('year-select');
  const departmentSelect = document.getElementById('department-select');
  const usersTbody = document.getElementById('users-tbody');
  const filter = document.getElementById('account-filter');

  // Edit modal elements
  const editUserModal = document.getElementById('modal-edit-user');
  const editUserForm = document.getElementById('edit-user-form');
  const editCloseBtn = document.querySelector('.close-modal-edit-user');
  const editCancelBtn = document.getElementById('cancel-edit-modal');
  const editRoleSelect = document.getElementById('edit-role');
  const editStatusSelect = document.getElementById('edit-status');
  const editFacultyFields = document.getElementById('edit-faculty-fields');
  const editStudentFields = document.getElementById('edit-student-fields');

  // Modal helpers
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

  // Role-specific field toggle
  function getRoleName() {
    const option = roleSelect?.options[roleSelect.selectedIndex];
    return option?.text?.toLowerCase() || "";
  }

  function toggleRoleFields() {
    const roleName = getRoleName();
    const isStudent = roleName === "student";
    const isFaculty = roleName === "faculty";

    // Show/hide blocks
    if (studentFields) studentFields.classList.toggle("hidden", !isStudent);
    if (facultyFields) facultyFields.classList.toggle("hidden", !isFaculty);

    // Toggle required attributes
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

  // Load roles into select
  async function loadRoles() {
    if (!roleSelect) return;
    try {
      const response = await fetch('/api/users-role');
      const roles = await response.json();
      
      if (!response.ok) {
        throw new Error(roles.message || 'Failed to load roles');
      }
      
      roleSelect.innerHTML = '<option value="">-- Select Role --</option>';
      roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.role_id;
        opt.textContent = r.role_name;
        roleSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  }

  // Load users into tables
  async function loadUsers() {
    if (!usersTbody) return;
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      
      if (!response.ok) {
        throw new Error(users.message || 'Failed to load users');
      }
      
      // Clear and populate unified users table
      usersTbody.innerHTML = '';
      
      users.forEach(u => {
        const role = (u.role_name || "").toLowerCase();
        
        // Simple escape function to avoid XSS
        const esc = (text) => String(text || '').replace(/[&<>"']/g, 
          m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
        
        const pill = (txt) => `<span class="pill">${esc(txt)}</span>`;
        
        // Determine additional info based on role
        let additionalInfo = '—';
        if (role === "student") {
          additionalInfo = u.program && u.year_level ? `${u.program}-${u.year_level}` : "—";
        } else if (role === "faculty") {
          additionalInfo = u.department || "—";
        } else if (role === "admin") {
          additionalInfo = "Administration";
        }
        
        usersTbody.insertAdjacentHTML('beforeend', `
          <tr data-role="${role}">
            <td>${esc(u.role_name || "—")}</td>
            <td>${esc(u.full_name || "—")}</td>
            <td>${esc(u.gmail)}</td>
            <td>${pill(additionalInfo)}</td>
            <td>${esc(u.status_name || "—")}</td>
            <td>
              <button class="btn btnSmall" data-action="edit" data-id="${esc(u.user_id)}">Edit</button>
              ${u.status_name && u.status_name.toLowerCase() === 'active' 
                ? `<button class="btn btnSmall btn-danger" data-action="deactivate" data-id="${esc(u.user_id)}">Deactivate</button>`
                : `<button class="btn btnSmall btn-success" data-action="activate" data-id="${esc(u.user_id)}">Activate</button>`
              }  
            </td>
          </tr>
        `);
      });
    } catch (err) {
      console.error('Failed to load users', err);
      alert('Failed to load users: ' + err.message);
    }
  }

  // Filter by role
  function applyFilter(filterRole) {
    const rows = document.querySelectorAll('#users-tbody tr');
    rows.forEach(row => {
      const role = row.dataset.role || '';
      row.style.display = filterRole === 'all' || role === filterRole ? '' : 'none';
    });
  }

  // Handle edit user form submission
  async function handleEditUserSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(editUserForm);
    const data = Object.fromEntries(formData.entries());
    
    // Manually add role_id since disabled fields don't submit
    const roleSelect = document.getElementById('edit-role');
    if (roleSelect && roleSelect.value) {
      data.role_id = roleSelect.value;
    }
    
    try {
      const response = await fetch(`/api/users/${data.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      alert('User updated successfully!');
      hideEditUserModal();
      loadUsers(); // Refresh the table
    } catch (err) {
      console.error('Failed to update user:', err);
      alert('Failed to update user: ' + err.message);
    }
  }

  // Event bindings
  addAccountBtn?.addEventListener('click', (e) => {
    console.log('Add account button clicked:', e.target);
    console.log('Modal element:', modalAddAccount);
    
    // If we're not on the users tab, switch to it first
    const usersTab = document.querySelector('[data-tab="users"]');
    const currentTab = document.querySelector('.tab-content.active');
    
    if (currentTab && currentTab.id !== 'tab-users') {
      console.log('Switching to users tab first');
      usersTab?.click();
      
      // Wait for tab to load, then open modal
      setTimeout(() => {
        showAddAccountModal();
      }, 200);
    } else {
      showAddAccountModal();
    }
  });
  closeModalBtn?.addEventListener('click', hideAddAccountModal);
  cancelModalBtn?.addEventListener('click', hideAddAccountModal);
  roleSelect?.addEventListener('change', toggleRoleFields);
  filter?.addEventListener('change', () => applyFilter(filter.value));

  // Edit modal event listeners
  editCloseBtn?.addEventListener('click', hideEditUserModal);
  editCancelBtn?.addEventListener('click', hideEditUserModal);
  editRoleSelect?.addEventListener('change', toggleEditRoleFields);
  editUserForm?.addEventListener('submit', handleEditUserSubmit);

  // Handle user action buttons (edit, activate, deactivate)
  usersTbody?.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const userId = button.dataset.id;
    
    if (!userId) {
      console.error('No user ID found on button');
      return;
    }

    try {
      switch (action) {
        case 'edit':
          handleEditUser(userId);
          break;
        case 'activate':
          await handleActivateUser(userId);
          break;
        case 'deactivate':
          await handleDeactivateUser(userId);
          break;
        default:
          console.warn('Unknown action:', action);
      }
    } catch (err) {
      console.error('Error handling user action:', err);
      alert('Error: ' + err.message);
    }
  });

  // Handle user action functions
  async function handleEditUser(userId) {
    try {
      // Fetch user data
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const userData = await response.json();

      // Populate form with user data
      document.getElementById('edit-user-id').value = userData.user_id;
      document.getElementById('edit-full-name').value = userData.full_name || '';
      document.getElementById('edit-gmail').value = userData.gmail || '';
      document.getElementById('edit-role').value = userData.role_id || '';
      document.getElementById('edit-status').value = userData.status_id || '';
      document.getElementById('edit-department').value = userData.department || '';
      document.getElementById('edit-program').value = userData.program || '';
      document.getElementById('edit-year').value = userData.year_level || '';

      // Show/hide role-specific fields
      toggleEditRoleFields();

      // Show modal
      showEditUserModal();
    } catch (err) {
      console.error('Failed to load user data:', err);
      alert('Failed to load user data: ' + err.message);
    }
  }

  // Edit modal helpers
  function showEditUserModal() {
    if (!editUserModal) return;
    editUserModal.classList.remove('hidden');
    editUserModal.classList.add('flex-display');
  }

  function hideEditUserModal() {
    if (!editUserModal) return;
    editUserModal.classList.add('hidden');
    editUserModal.classList.remove('flex-display');
    editUserForm?.reset();
  }

  function toggleEditRoleFields() {
    const roleName = getEditRoleName();
    if (!editFacultyFields || !editStudentFields) return;
    
    if (roleName === "student") {
      editStudentFields.classList.remove('hidden');
      editFacultyFields.classList.add('hidden');
    } else if (roleName === "faculty") {
      editStudentFields.classList.add('hidden');
      editFacultyFields.classList.remove('hidden');
    } else {
      editStudentFields.classList.add('hidden');
      editFacultyFields.classList.add('hidden');
    }
  }

  function getEditRoleName() {
    const option = editRoleSelect?.options[editRoleSelect.selectedIndex];
    return option?.text?.toLowerCase() || "";
  }

  async function loadEditRolesAndStatus() {
    try {
      // Load roles
      const rolesResponse = await fetch('/api/users-role');
      const roles = await rolesResponse.json();
      editRoleSelect.innerHTML = '<option value="">-- Select Role --</option>';
      roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.role_id;
        opt.textContent = r.role_name;
        editRoleSelect.appendChild(opt);
      });

      // Load status
      const statusResponse = await fetch('/api/users-status');
      const status = await statusResponse.json();
      editStatusSelect.innerHTML = '<option value="">-- Select Status --</option>';
      status.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.status_id;
        opt.textContent = s.status_name;
        editStatusSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load edit form data:', err);
    }
  }

  async function handleActivateUser(userId) {
    if (!confirm('Are you sure you want to activate this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}/activate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to activate user');
      }

      alert('User activated successfully!');
      loadUsers(); // Refresh the table
    } catch (err) {
      console.error('Failed to activate user:', err);
      alert('Failed to activate user: ' + err.message);
    }
  }

  async function handleDeactivateUser(userId) {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}/deactivate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to deactivate user');
      }

      alert('User deactivated successfully!');
      loadUsers(); // Refresh the table
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      alert('Failed to deactivate user: ' + err.message);
    }
  }

  // Submit new account
  addAccountForm?.addEventListener('submit', async (e) => {
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
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification("Please fill in all required fields.", "error");
      } else {
        alert("Please fill in all required fields.");
      }
      return;
    }

    // Role-specific required (based on text label, not numeric IDs)
    if (roleName === "student" && (!program || !year)) {
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification("Please select program and year.", "error");
      } else {
        alert("Please select program and year.");
      }
      return;
    }
    if (roleName === "faculty" && !department) {
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification("Please select a department.", "error");
      } else {
        alert("Please select a department.");
      }
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
        const errorMsg = data.message || `Failed to create account (HTTP ${res.status})`;
        if (window.SmartLab?.Utils?.showNotification) {
          window.SmartLab.Utils.showNotification(errorMsg, "error");
        } else {
          alert(errorMsg);
        }
        return;
      }

      const successMsg = data.message || "Account created successfully";
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification(successMsg, "success");
      } else {
        alert(successMsg);
      }

      // Refresh user table
      loadUsers();

      // Reset form and close modal
      addAccountForm.reset();
      toggleRoleFields(); // re-hide fields + remove required flags correctly
      hideAddAccountModal();
      
    } catch (err) {
      console.error('Error creating account:', err);
      if (window.SmartLab?.Utils?.showNotification) {
        window.SmartLab.Utils.showNotification("Server error. Try again.", "error");
      } else {
        alert("Server error. Try again.");
      }
    }
  });

  // Init
  loadRoles();
  loadEditRolesAndStatus();
  loadUsers();

  // Notification functionality
  const notificationBtn = document.getElementById('notification-btn');
  const notificationCount = document.getElementById('notification-count');

  notificationBtn?.addEventListener('click', () => {
    // Placeholder for notification panel functionality
    alert('Notifications panel coming soon!');
    
    // Clear notification count when clicked
    notificationCount.textContent = '0';
    notificationCount.style.display = 'none';
  });

  // Export
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminUsers = { loadUsers };

  // Auto-initialize if DOM is ready, otherwise wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadRoles();
      loadEditRolesAndStatus();
      loadUsers();
    });
  } else {
    // DOM is already ready
    loadRoles();
    loadEditRolesAndStatus();
    loadUsers();
  }
});
