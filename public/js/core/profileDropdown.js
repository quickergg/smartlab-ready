// =========================================================
// PROFILE DROPDOWN
// =========================================================
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const profileEmail = document.getElementById('profile-email');
const dropdownProfileEmail = document.getElementById('dropdown-profile-email');
const profileSettingsBtn = document.getElementById('profile-settings-btn');
const changePasswordBtn = document.getElementById('change-password-btn');
const profileSignoutBtn = document.getElementById('profile-signout-btn');

// Load and display user email
function loadUserProfile() {
  const gmail = sessionStorage.getItem('gmail') || '';
  
  if (profileEmail) {
    profileEmail.textContent = gmail || 'No email';
  }

  if (dropdownProfileEmail) {
    dropdownProfileEmail.textContent = gmail || 'No email';
  }
}

// Toggle profile dropdown
function toggleProfileDropdown() {
  if (!profileDropdown) return;
  
  const isHidden = profileDropdown.classList.contains('hidden');
  
  if (isHidden) {
    profileDropdown.classList.remove('hidden');
    profileTrigger?.classList.add('active');
  } else {
    profileDropdown.classList.add('hidden');
    profileTrigger?.classList.remove('active');
  }
}

// Close dropdown when clicking outside
function closeProfileDropdown(e) {
  if (!profileTrigger?.contains(e.target) && !profileDropdown?.contains(e.target)) {
    profileDropdown?.classList.add('hidden');
    profileTrigger?.classList.remove('active');
  }
}

// Event listeners
if (profileTrigger) {
  profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleProfileDropdown();
    loadUserProfile();
  });
}

document.addEventListener('click', closeProfileDropdown);

// Profile Settings button
if (profileSettingsBtn) {
  profileSettingsBtn.addEventListener('click', () => {
    alert('Profile Settings - Coming Soon!');
    // You can open a profile settings modal here
  });
}

// Change Password button
if (changePasswordBtn) {
  changePasswordBtn.addEventListener('click', () => {
    alert('Change Password - Coming Soon!');
    // You can open a change password modal here
  });
}

// Sign Out button
if (profileSignoutBtn) {
  profileSignoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', loadUserProfile);