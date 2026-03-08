/* =========================================
   SmartLab – Centralized API Helpers
   Wraps fetch with consistent error handling
========================================= */

(() => {
  // Helper: safe JSON parse with fallback
  async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { message: text || "Unexpected server response" }; }
  }

  // Generic GET
  async function get(url) {
    try {
      const res = await fetch(url, { method: "GET" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || `GET ${url} failed`);
      return data;
    } catch (err) {
      console.error("API GET error:", err);
      throw err;
    }
  }

  // Generic POST
  async function post(url, payload = {}) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || `POST ${url} failed`);
      return data;
    } catch (err) {
      console.error("API POST error:", err);
      throw err;
    }
  }

  // Generic PUT
  async function put(url, payload = {}) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || `PUT ${url} failed`);
      return data;
    } catch (err) {
      console.error("API PUT error:", err);
      throw err;
    }
  }

  // Generic DELETE
  async function del(url) {
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || `DELETE ${url} failed`);
      return data;
    } catch (err) {
      console.error("API DELETE error:", err);
      throw err;
    }
  }

  // Export to global SmartLab namespace
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.Api = { get, post, put, delete: del };
})();
