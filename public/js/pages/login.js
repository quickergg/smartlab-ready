document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const gmail = document.getElementById("gmail").value.trim(); 
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.style.display = "none";
  errorMsg.textContent = "";

  if (!gmail || !password) {
    errorMsg.style.display = "block";
    errorMsg.textContent = "Please enter your email and password.";
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmail, password })
    });

    // If server returns non-JSON (e.g., HTML error), this prevents crash
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (!res.ok) {
      errorMsg.style.display = "block";
      errorMsg.textContent = data.message || "Login failed";
      return;
    }

    // Save session (temporary)
    sessionStorage.setItem("user_id", String(data.user.user_id));
    sessionStorage.setItem("role", data.user.role_name);
    sessionStorage.setItem("gmail", data.user.gmail);

    // Redirect based on role
    const role = (data.user.role_name || "").toLowerCase();
    if (role === "admin") {
      window.location.href = "admin.html";
    } else if (role === "faculty") {
      window.location.href = "faculty.html";
    } else {
      window.location.href = "student.html";
    }
  } catch (err) {
    console.error(err);
    errorMsg.style.display = "block";
    errorMsg.textContent = "Server error. Try again.";
  }
});
