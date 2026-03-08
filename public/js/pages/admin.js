/* =========================================
   SmartLab – Admin Page Controller
   Page orchestration and coordination only
   Feature-specific logic moved to feature modules
========================================= */

(() => {
  // ---------- Core page initialization ----------
  window.SmartLab.Auth.guardRole("Admin");
  window.SmartLab.Auth.setWho();
  window.SmartLab.Auth.logoutSetup();
  setupTabs();

  // ---------- Helpers ----------
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- Page orchestration ----------
  document.addEventListener("DOMContentLoaded", () => {    
    // Initialize dashboard counts if available
    if (window.SmartLab?.AdminDashboard?.updateDashboardCounts) {
      window.SmartLab.AdminDashboard.updateDashboardCounts();
    }
    
    // Initialize other features through their exported functions
    // Features are also auto-initialized via their own DOMContentLoaded listeners
    // This provides redundancy and ensures everything loads properly
    
    // Print reports functionality
    const printReportsBtn = qs('#tab-reports .btn-primary');
    if (printReportsBtn) {
      printReportsBtn.addEventListener('click', async () => {
        if (window.PrintReports) {
          await PrintReports.printUsageReports('#tab-reports tbody');
        } else {
          console.warn('PrintReports not available');
        }
      });
    }
  });

  // ---------- Global functions for backward compatibility ----------
  // These functions are called from HTML or other scripts
  window.showAddScheduleModal = function() {
    // Switch to schedule tab
    const scheduleTab = document.querySelector('[data-tab="schedule"]');
    if (scheduleTab) {
      scheduleTab.click();
      
      // Wait for tab to load, then click the add schedule button
      setTimeout(() => {
        const addScheduleBtn = document.querySelector('#tab-schedule #obtn-add-schedule') || 
                              document.querySelector('#tab-schedule .btn-primary');
        if (addScheduleBtn) {
          addScheduleBtn.click();
        }
      }, 200);
    }
  };

  window.showEquipmentStatus = function() {
    const equipmentTab = document.querySelector('[data-tab="equipment"]');
    if (equipmentTab) {
      equipmentTab.click();
    }
  };

})();
