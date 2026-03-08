/* =========================================
   SmartLab – Notification Manager (Shared)
   Handles bell icon, dropdown, polling, mark-read
   Used by admin, faculty, and student apps
========================================= */

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.isOpen = false;
    this.pollInterval = null;
    this.POLL_MS = 30000; // Poll every 30 seconds

    this.init();
  }

  // =========================================
  // Initialization
  // =========================================

  init() {
    this.bellBtn = document.getElementById('btn-notifications');
    if (!this.bellBtn) return;

    // Inject badge + dropdown HTML
    this._injectUI();

    // Bind events
    this.bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    document.addEventListener('click', (e) => {
      if (this.isOpen && this.dropdown && !this.dropdown.contains(e.target) && !this.bellBtn.contains(e.target)) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Initial fetch + start polling
    this.fetchUnreadCount();
    this.startPolling();
  }

  // =========================================
  // UI Injection
  // =========================================

  _injectUI() {
    // Add badge to bell button
    this.badge = document.createElement('span');
    this.badge.className = 'notif-badge';
    this.badge.style.display = 'none';
    this.bellBtn.style.position = 'relative';
    this.bellBtn.appendChild(this.badge);

    // Create dropdown container
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'notif-dropdown';
    this.dropdown.innerHTML = `
      <div class="notif-dropdown-header">
        <h4>Notifications</h4>
        <button class="notif-mark-all" id="notif-mark-all-btn" title="Mark all as read">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Mark all read
        </button>
      </div>
      <div class="notif-list" id="notif-list"></div>
      <div class="notif-empty" id="notif-empty" style="display:none;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <p>No notifications</p>
      </div>
    `;

    // Position dropdown relative to header-right
    const headerRight = this.bellBtn.closest('.header-right') || this.bellBtn.parentElement;
    headerRight.style.position = 'relative';
    headerRight.appendChild(this.dropdown);

    // Bind mark-all button
    const markAllBtn = this.dropdown.querySelector('#notif-mark-all-btn');
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.markAllAsRead();
    });

    this.listEl = this.dropdown.querySelector('#notif-list');
    this.emptyEl = this.dropdown.querySelector('#notif-empty');
  }

  // =========================================
  // API Calls
  // =========================================

  _headers() {
    return SmartLab.Core.Auth.getAuthHeaders();
  }

  async fetchUnreadCount() {
    try {
      const res = await fetch('/api/notifications/unread-count', { headers: this._headers() });
      if (!res.ok) return;
      const data = await res.json();
      this.unreadCount = data.count || 0;
      this._updateBadge();
    } catch (err) {
      // Silently fail
    }
  }

  async fetchNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=20', { headers: this._headers() });
      if (!res.ok) return;
      this.notifications = await res.json();
      this._renderList();
    } catch (err) {
      // Silently fail
    }
  }

  async markAsRead(notificationId) {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: this._headers()
      });
      // Update local state
      const notif = this.notifications.find(n => n.notification_id === notificationId);
      if (notif && !notif.is_read) {
        notif.is_read = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this._updateBadge();
        this._renderList();
      }
    } catch (err) {
      // Silently fail
    }
  }

  async markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: this._headers()
      });
      this.notifications.forEach(n => n.is_read = true);
      this.unreadCount = 0;
      this._updateBadge();
      this._renderList();
    } catch (err) {
      // Silently fail
    }
  }

  // =========================================
  // Polling
  // =========================================

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.fetchUnreadCount();
      if (this.isOpen) this.fetchNotifications();
    }, this.POLL_MS);
  }

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  // =========================================
  // Toggle / Open / Close
  // =========================================

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.dropdown.classList.add('open');
    this.fetchNotifications();
  }

  close() {
    this.isOpen = false;
    this.dropdown.classList.remove('open');
  }

  // =========================================
  // Rendering
  // =========================================

  _updateBadge() {
    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.badge.style.display = 'flex';
    } else {
      this.badge.style.display = 'none';
    }
  }

  _renderList() {
    if (!this.notifications.length) {
      this.listEl.innerHTML = '';
      this.emptyEl.style.display = 'flex';
      return;
    }

    this.emptyEl.style.display = 'none';
    this.listEl.innerHTML = this.notifications.map(n => `
      <div class="notif-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.notification_id}">
        <div class="notif-icon-wrap ${this._typeColor(n.type)}">
          ${this._typeIcon(n.type)}
        </div>
        <div class="notif-content">
          <div class="notif-title">${this._escHtml(n.title)}</div>
          <div class="notif-message">${this._escHtml(n.message)}</div>
          <div class="notif-time">${this._timeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
      </div>
    `).join('');

    // Bind click events
    this.listEl.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = Number(el.dataset.id);
        this.markAsRead(id);
      });
    });
  }

  _typeIcon(type) {
    const icons = {
      new_request: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      request_approved: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      request_declined: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      request_cancelled: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
      request_returned: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
      request_borrowed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
    };
    return icons[type] || icons.new_request;
  }

  _typeColor(type) {
    const colors = {
      new_request: 'notif-type-new',
      request_approved: 'notif-type-approved',
      request_declined: 'notif-type-declined',
      request_cancelled: 'notif-type-cancelled',
      request_returned: 'notif-type-returned',
      request_borrowed: 'notif-type-borrowed'
    };
    return colors[type] || 'notif-type-new';
  }

  _timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}
