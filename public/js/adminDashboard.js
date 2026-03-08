/* =========================================
   SmartLab – Admin: Dashboard Counts & Init
   Loads dashboard stats and initializes tabs
========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const qs = (sel) => document.querySelector(sel);

  async function updateDashboardCounts() {
    try {
      const usersRes = await fetch('/api/users');
      const pendingRes = await fetch('/api/borrowRequests/pending');
      const schedulesRes = await fetch('/api/labSchedule');
      
      if (!usersRes.ok || !pendingRes.ok || !schedulesRes.ok) {
        console.error('Failed to fetch dashboard data');
        return;
      }
      
      const users = await usersRes.json();
      const pending = await pendingRes.json();
      const schedules = await schedulesRes.json();
      
      const totalUsers = users.length;
      const pendingCount = Array.isArray(pending) ? pending.length : 0;
      const studentCount = users.filter(u => (u.role_name || '').toLowerCase() === 'student').length;
      const facultyCount = users.filter(u => (u.role_name || '').toLowerCase() === 'faculty').length;
      
      // Count active labs today
      const today = new Date().toISOString().slice(0, 10);
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
        const el = document.getElementById(`count-${key}`);
        if (el) el.textContent = val;
      });
    } catch (err) {
      console.error('Failed to update dashboard counts', err);
    }
  }

  // Load recent activity
  async function loadRecentActivity() {
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;

    try {
      // Get recent requests
      const requestsRes = await fetch('/api/borrowRequests?limit=10');
      const usersRes = await fetch('/api/users?limit=5');
      
      if (!requestsRes.ok || !usersRes.ok) {
        activityContainer.innerHTML = '<div class="activity-item"><span class="activity-loading">Failed to load activity</span></div>';
        return;
      }

      const requests = await requestsRes.json();
      const users = await usersRes.json();
      
      let activities = [];
      
      // Add recent user registrations
      if (Array.isArray(users)) {
        users.slice(0, 3).forEach(user => {
          activities.push({
            type: 'user',
            title: `New ${user.role_name} account created: ${user.gmail}`,
            time: formatTimeAgo(user.created_at),
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
            time: formatTimeAgo(request.created_at),
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
          <div class="activity-icon ${activity.icon}">
            ${activity.icon === 'user' ? '👤' : 
              activity.icon === 'approved' ? '✓' : 
              activity.icon === 'rejected' ? '✗' : '📋'}
          </div>
          <div class="activity-content">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-time">${activity.time}</div>
          </div>
        </div>
      `).join('');
      
    } catch (err) {
      console.error('Failed to load recent activity', err);
      activityContainer.innerHTML = '<div class="activity-item"><span class="activity-loading">Error loading activity</span></div>';
    }
  }

  // Format time ago
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

      // Update user fullname
      const fullnameElement = document.getElementById('user-fullname');
      if (fullnameElement) {
        if (firstName && lastName) {
          fullnameElement.textContent = `${firstName} ${lastName}`;
        } else if (gmail) {
          fullnameElement.textContent = gmail.split('@')[0]; // Use part before @ as fallback
        } else {
          fullnameElement.textContent = 'Admin';
        }
      }

      // Load academic context from API
      const academicResponse = await fetch('/api/activeAcademicContext');
      if (academicResponse.ok) {
        const academicData = await academicResponse.json();
        updateAcademicContext(academicData);
      } else {
        // Fallback to current academic year if API fails
        updateAcademicContext({
          academic_year: '2025-2026',
          term: '1st Semester'
        });
      }

    } catch (err) {
      console.error('Failed to load user info:', err);
      // Fallback values
      document.getElementById('user-fullname').textContent = 'Admin';
      updateAcademicContext({
        academic_year: '2025-2026',
        term: '1st Semester'
      });
    }
  }

  // Update academic context in the header
  function updateAcademicContext(data) {
    const academicYearElement = document.getElementById('academic-year');
    const semesterElement = document.getElementById('semester');

    if (academicYearElement) {
      academicYearElement.innerHTML = `Academic Year ${data.academic_year || '2025-2026'} <span> | </span>`;
    }

    if (semesterElement) {
      semesterElement.innerHTML = `<strong>${data.term || '1st Semester'}</strong>`;
    }
  }
  window.showPendingRequestsQuick = function() {
    // Switch to requests tab
    const requestsTab = document.querySelector('[data-tab="requests"]');
    if (requestsTab) {
      requestsTab.click();
    }
  };

  window.showEquipmentStatus = function() {
    alert('Equipment status feature coming soon! This will show available vs borrowed equipment.');
  };

  // Initialize dashboard counts, recent activity, and user info
  updateDashboardCounts();
  loadRecentActivity();
  loadUserInfo();
});
