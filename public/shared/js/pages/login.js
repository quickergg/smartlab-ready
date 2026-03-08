(() => {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function setError(msg = "") {
    const el = $("errorMsg");
    if (!el) return;

    if (!msg) {
      el.textContent = "";
      el.classList.add("hidden"); // use CSS .hidden { display:none !important; }
      return;
    }

    el.textContent = msg;
    el.classList.remove("hidden");
  }

  async function readJsonSafe(res) {
    // Prefer JSON if server sends it; otherwise fall back to text
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const data = await res.json();
        return data;
      } catch {
        return {};
      }
    }

    const text = await res.text();
    // In case server still returns JSON but wrong header
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function saveSession(user, token) {
    // Keep your existing keys, but guard fields
    sessionStorage.setItem("user_id", String(user.user_id ?? ""));
    sessionStorage.setItem("role", String(user.role_name ?? ""));
    sessionStorage.setItem("gmail", String(user.gmail ?? ""));
    sessionStorage.setItem("full_name", String(user.full_name ?? ""));
    if (token) {
      sessionStorage.setItem("token", token);
    }
  }

  function redirectByRole(roleName) {
    const role = String(roleName || "").toLowerCase();

    // Redirect to new app structure
    if (role === "admin") window.location.href = "/apps/admin/admin.html";
    else if (role === "faculty") window.location.href = "/apps/faculty/faculty.html";
    else window.location.href = "/apps/student/index.html";
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    const form = $("loginForm");
    const gmailInput = $("gmail");
    const pwdInput = $("password");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setError("");

        const gmail = (gmailInput?.value || "").trim();
        const password = pwdInput?.value || "";

        if (!gmail || !password) {
          setError("Please enter your email and password.");
          return;
        }

        try {
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gmail, password }),
          });

          const data = await readJsonSafe(res);

          if (!res.ok) {
            setError(data?.message || "Login failed.");
            return;
          }

          const user = data?.user;
          if (!user) {
            setError("Login succeeded but user data is missing.");
            return;
          }

          saveSession(user, data.token);
          redirectByRole(user.role_name);
        } catch (err) {
          setError("Server error. Try again.");
        }
      });
    }

    // Password toggle (optional; only activates if elements exist)
    const toggleBtn = $("togglePassword");
    const wrap = toggleBtn?.closest(".password-wrap");

    if (pwdInput && toggleBtn && wrap) {
      toggleBtn.addEventListener("click", () => {
        const willShow = pwdInput.type === "password";
        pwdInput.type = willShow ? "text" : "password";

        wrap.classList.toggle("is-visible", willShow);
        toggleBtn.setAttribute("aria-pressed", String(willShow));
        toggleBtn.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
      });
    }
  });
})();
