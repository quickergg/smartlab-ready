/* =========================================
   SmartLab – Admin: Reports/Print
   Delegates to PrintReports module
========================================= */

(() => {
  const qs = (sel) => document.querySelector(sel);
  const printReportsBtn = qs('#tab-reports .btn-primary');

  if (printReportsBtn) {
    printReportsBtn.addEventListener('click', async () => {
      if (window.PrintReports && typeof window.PrintReports.printUsageReports === 'function') {
        await window.PrintReports.printUsageReports('#tab-reports tbody');
      } else {
        alert('PrintReports module not loaded.');
      }
    });
  }

  // Export (placeholder for future report features)
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminReports = {};
})();
