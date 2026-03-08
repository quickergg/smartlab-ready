/* =========================================
   SmartLab – Auth & Session Helpers
   Centralized guardRole, setWho, logoutSetup
========================================= */

(() => {
  // Guard page by role; redirect to index if mismatch
  function guardRole(role) {
    if (sessionStorage.getItem("role") !== role) {
      window.location.href = "index.html";
    }
  }

  // Show current user email in UI element #who
  function setWho() {
    const who = document.getElementById("who");
    const gmail = sessionStorage.getItem("gmail");
    if (who && gmail) who.textContent = `(${gmail})`;
  }

  // Setup logout button (#logout-btn) to clear sessionStorage and redirect
  function logoutSetup() {
    const btn = document.getElementById("logout-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "index.html";
    });
  }

  // Export to global SmartLab namespace
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.Auth = {
    guardRole,
    setWho,
    logoutSetup
  };
})();
