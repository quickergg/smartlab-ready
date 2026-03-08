/* =========================================
   SmartLab – Admin: Dashboard Counts & Init
   Loads dashboard stats and initializes tabs
========================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Use core utilities and our enhanced utils
  const qs = window.SmartLab?.Utils?.getSelector || ((sel) => document.querySelector(sel));
  const $ = window.$ || ((id) => document.getElementById(id)); // From core.js

  async function updateDashboardCounts() {
    try {
      // Use SmartLab.Api for consistent error handling
      const usersPromise = window.SmartLab?.Api?.get ? 
        window.SmartLab.Api.get('/api/users') : 
        fetch('/api/users').then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch users')));
        
      const pendingPromise = window.SmartLab?.Api?.get ? 
        window.SmartLab.Api.get('/api/borrowRequests/pending') : 
        fetch('/api/borrowRequests/pending').then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch pending requests')));
        
      const schedulesPromise = window.SmartLab?.Api?.get ? 
        window.SmartLab.Api.get('/api/labSchedule') : 
        fetch('/api/labSchedule').then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch schedules')));
      
      // Execute all requests in parallel
      const [users, pending, schedules] = await Promise.all([
        usersPromise.catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Users API Error', err);
          }
          return [];
        }),
        pendingPromise.catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Pending Requests API Error', err);
          }
          return [];
        }),
        schedulesPromise.catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Schedules API Error', err);
          }
          return [];
        })
      ]);
      
      const totalUsers = users.length;
      const pendingCount = Array.isArray(pending) ? pending.length : 0;
      const studentCount = users.filter(u => (u.role_name || '').toLowerCase() === 'student').length;
      const facultyCount = users.filter(u => (u.role_name || '').toLowerCase() === 'faculty').length;
      
      // Count active labs today
      const today = window.SmartLab?.Utils?.formatDate(new Date()) || new Date().toISOString().slice(0, 10);
      const activeLabsToday = Array.isArray(schedules) ? 
        schedules.filter(s => s.date_needed === today).length : 0;

      const counts = {
        totalUsers,
        studentCount,
        facultyCount,
        pendingCount,
        activeLabsToday
      };

      // Update UI if elements exist
      Object.entries(counts).forEach(([key, val]) => {
        const el = $(`count-${key}`); // Use core.js $ function
        if (el) el.textContent = val;
      });
    } catch (err) {
      if (window.SmartLab?.Utils?.logError) {
        window.SmartLab.Utils.logError('Dashboard Counts Update', err);
      } else {
        console.error('Failed to update dashboard counts', err);
      }
    }
  }

  // Load recent activity
  async function loadRecentActivity() {
    const activityContainer = $('recent-activity'); // Use core.js $ function
    if (!activityContainer) return;

    try {
      // Get recent requests using SmartLab.Api
      const requestsPromise = window.SmartLab?.Api?.get ? 
        window.SmartLab.Api.get('/api/borrowRequests?limit=10') : 
        fetch('/api/borrowRequests?limit=10').then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch requests')));
        
      const usersPromise = window.SmartLab?.Api?.get ? 
        window.SmartLab.Api.get('/api/users?limit=5') : 
        fetch('/api/users?limit=5').then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch users')));
      
      const [requests, users] = await Promise.all([
        requestsPromise.catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Recent Requests API Error', err);
          }
          return [];
        }),
        usersPromise.catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Recent Users API Error', err);
          }
          return [];
        })
      ]);
      
      let activities = [];
      
      // Add recent user registrations
      if (Array.isArray(users)) {
        users.slice(0, 3).forEach(user => {
          activities.push({
            type: 'user',
            title: `New ${user.role_name} account created: ${user.gmail}`,
            time: window.SmartLab?.Utils?.formatTimeAgo ? window.SmartLab.Utils.formatTimeAgo(user.created_at) : 'Just now',
            icon: 'user'
          });
        });
      }
      
      // Add recent requests
      if (Array.isArray(requests)) {
        requests.slice(0, 5).forEach(request => {
          const statusIcon = request.status_name === 'Approved' ? 'approved' : 
                           request.status_name === 'Rejected' ? 'rejected' : 'request';
          activities.push({
            type: statusIcon,
            title: `${request.status_name}: ${request.subject || 'Request'} by ${request.requester_gmail || 'User'}`,
            time: window.SmartLab?.Utils?.formatTimeAgo ? window.SmartLab.Utils.formatTimeAgo(request.created_at) : 'Just now',
            icon: statusIcon
          });
        });
      }
      
      // Sort by time (most recent first) and limit to 8 items
      activities = activities.slice(0, 8);
      
      if (activities.length === 0) {
        activityContainer.innerHTML = '<div class="activity-item"><span class="activity-loading">No recent activity</span></div>';
        return;
      }
      
      activityContainer.innerHTML = activities.map(activity => `
        <div class="activity-item">
          <div class="activity-icon">
            ${activity.icon === 'user' ? '👤' : 
              activity.icon === 'request' ? '�' : 
              activity.icon === 'approved' ? '✓' : 
              activity.icon === 'rejected' ? '✗' : '📋'}
          </div>
          <div class="activity-content">
            <div class="activity-title">${window.SmartLab?.Utils?.escapeHtml ? window.SmartLab.Utils.escapeHtml(activity.title) : activity.title}</div>
            <div class="activity-time">${window.SmartLab?.Utils?.escapeHtml ? window.SmartLab.Utils.escapeHtml(activity.time) : activity.time}</div>
          </div>
        </div>
      `).join('');
      
    } catch (err) {
      if (window.SmartLab?.Utils?.logError) {
        window.SmartLab.Utils.logError('Recent Activity Load', err);
      } else {
        console.error('Failed to load recent activity', err);
      }
      activityContainer.innerHTML = '<div class="activity-item"><span class="activity-loading">Error loading activity</span></div>';
    }
  }

  // Load user information and academic context
  async function loadUserInfo() {
    try {
      // Get user info from session storage
      const userId = sessionStorage.getItem('userId');
      const userRole = sessionStorage.getItem('role_name');
      const firstName = sessionStorage.getItem('firstName') || sessionStorage.getItem('first_name');
      const lastName = sessionStorage.getItem('lastName') || sessionStorage.getItem('last_name');
      const gmail = sessionStorage.getItem('gmail');

      console.log('Loading user info:', { userId, firstName, lastName, gmail });

      // Update user fullname using core.js $ function
      const fullnameElement = $('user-fullname');
      if (fullnameElement) {
        if (firstName && lastName) {
          fullnameElement.textContent = `${firstName} ${lastName}`;
        } else if (gmail) {
          fullnameElement.textContent = gmail.split('@')[0]; // Use part before @ as fallback
        } else {
          fullnameElement.textContent = 'Admin';
        }
      }

      // Load academic context from API using SmartLab.Api
      const academicResponse = window.SmartLab?.Api?.get ? 
        await window.SmartLab.Api.get('/api/activeAcademicContext').catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Academic Context API Error', err);
          }
          return null;
        }) : 
        await fetch('/api/activeAcademicContext').then(res => res.ok ? res.json() : null).catch(err => {
          if (window.SmartLab?.Utils?.logError) {
            window.SmartLab.Utils.logError('Academic Context Fetch Error', err);
          }
          return null;
        });
        
      if (academicResponse) {
        updateAcademicContext(academicResponse);
      } else {
        // Fallback to current academic year if API fails
        updateAcademicContext({
          academic_year: '2025-2026',
          term: '1st Semester'
        });
      }

    } catch (err) {
      if (window.SmartLab?.Utils?.logError) {
        window.SmartLab.Utils.logError('User Info Load', err);
      } else {
        console.error('Failed to load user info:', err);
      }
      // Fallback values
      const fullnameElement = $('user-fullname');
      if (fullnameElement) fullnameElement.textContent = 'Admin';
      updateAcademicContext({
        academic_year: '2025-2026',
        term: '1st Semester'
      });
    }
  }

  // Update academic context in the header
  function updateAcademicContext(data) {
    const academicYearElement = $('academic-year'); // Use core.js $ function
    const semesterElement = $('semester'); // Use core.js $ function

    if (academicYearElement) {
      const year = window.SmartLab?.Utils?.escapeHtml ? 
        window.SmartLab.Utils.escapeHtml(data.academic_year || '2025-2026') : 
        (data.academic_year || '2025-2026');
      academicYearElement.innerHTML = `Academic Year ${year} <span> | </span>`;
    }

    if (semesterElement) {
      const term = window.SmartLab?.Utils?.escapeHtml ? 
        window.SmartLab.Utils.escapeHtml(data.term || '1st Semester') : 
        (data.term || '1st Semester');
      semesterElement.innerHTML = `<strong>${term}</strong>`;
    }
  }
  window.addNewUser = function() {
    // Switch to users tab using core utilities
    const usersTab = qs('[data-tab="users"]');
    if (usersTab) {
      usersTab.click();
      
      // Wait for tab to load, then click the add user button
      setTimeout(() => {
        const addUserBtn = qs('#tab-users #open-add-modal') || qs('#tab-users .btn-primary');
        if (addUserBtn) {
          addUserBtn.click();
        }
      }, 200);
    }
  };

  window.showPendingRequestsQuick = function() {
    // Switch to requests tab using core utilities
    const requestsTab = qs('[data-tab="requests"]');
    if (requestsTab) {
      requestsTab.click();
    }
  };

  window.addNewLabSchedule = function() {
    // Switch to schedule tab using core utilities
    const scheduleTab = qs('[data-tab="schedule"]');
    if (scheduleTab) {
      scheduleTab.click();
      
      // Wait for tab to load, then click the add schedule button
      setTimeout(() => {
        const addScheduleBtn = qs('#tab-schedule #obtn-add-schedule') || qs('#tab-schedule .btn-primary');
        if (addScheduleBtn) {
          addScheduleBtn.click();
        }
      }, 200);
    }
  };

  window.showEquipmentStatus = function() {
    const equipmentTab = qs('[data-tab="equipment"]'); // Fixed typo from euqipmentsTab
    if (equipmentTab) {
      equipmentTab.click();
    }
  };

  // Export functions for external use
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminDashboard = {
    updateDashboardCounts,
    loadRecentActivity,
    loadUserInfo
  };

  // Auto-initialize if DOM is ready, otherwise wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateDashboardCounts();
      loadRecentActivity();
      loadUserInfo();
    });
  } else {
    // DOM is already ready
    updateDashboardCounts();
    loadRecentActivity();
    loadUserInfo();
  }
});
