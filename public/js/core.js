/* =========================================
   SMARTLAB CORE UI UTILITIES
   Header hide/show, nav highlighting, tabs, modals
========================================= */

// Shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

/* -----------------------------------------
   Header hide/show on scroll - DISABLED
----------------------------------------- */
// (() => {
//     const header = document.querySelector("header");
//     if (!header) return;

//     let lastScrollTop = 0;

//     window.addEventListener("scroll", () => {
//         const current = window.pageYOffset || document.documentElement.scrollTop;

//         if (current > lastScrollTop && current > 100) {
//             header.classList.add("hide");
//         } else {
//             header.classList.remove("hide");
//         }

//         lastScrollTop = current <= 0 ? 0 : current;
//     });
// })();

/* -----------------------------------------
   Active nav link highlighting on scroll
----------------------------------------- */
(() => {
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".nav-link");
    if (!sections.length || !navLinks.length) return;

    window.addEventListener("scroll", () => {
        let current = "";

        sections.forEach(section => {
            const top = section.offsetTop - 120;
            const height = section.offsetHeight;

            if (window.pageYOffset >= top && window.pageYOffset < top + height) {
                current = section.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
        });
    });
})();

/* -----------------------------------------
   Form helpers
----------------------------------------- */
function setupOthersToggle(chkId, txtId) {
    const chk = $(chkId);
    const txt = $(txtId);
    if (!chk || !txt) return;

    const update = () => {
        txt.disabled = !chk.checked;
        if (!chk.checked) txt.value = "";
    };

    chk.addEventListener("change", update);
    update();
}

function setupPurposeOthers(radioName, txtId) {
    const txt = $(txtId);
    if (!txt) return;

    document.querySelectorAll(`input[name="${radioName}"]`)
        .forEach(r => r.addEventListener("change", () => {
            txt.disabled = !r.checked;
            if (!r.checked) txt.value = "";
        }));

    txt.disabled = true;
}

function setupNewCancel(formId, onResetExtra) {
    const form = $(formId);
    if (!form) return;

    const reset = () => {
        form.reset();
        onResetExtra?.();
    };

    $("newRequestBtn")?.addEventListener("click", () => {
        if (confirm("Start a new request?")) reset();
    });

    $("cancelBtn")?.addEventListener("click", () => {
        if (confirm("Cancel this request?")) reset();
    });
}

/* -----------------------------------------
   Sidebar and tab navigation
----------------------------------------- */
function setupTabs() {
    const navItems = document.querySelectorAll(".navItem");
    const tabPanels = document.querySelectorAll(".tabPanel");

    if (!navItems.length) return;

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;

            navItems.forEach(item => item.classList.remove("active"));
            btn.classList.add("active");

            tabPanels.forEach(panel => panel.classList.add("hidden"));
            const targetPanel = $(`tab-${target}`);
            if (targetPanel) targetPanel.classList.remove("hidden");
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Sidebar toggle disabled - sidebar is now always visible
    // const sidebarToggle = $("sidebar-toggle");
    // const sidebar = document.querySelector(".sidebar");

    // if (sidebarToggle && sidebar) {
    //     sidebarToggle.addEventListener("click", e => {
    //         e.stopPropagation();
    //         sidebar.classList.toggle("active");
    //     });

    //     document.addEventListener("click", e => {
    //         if (!sidebar.contains(e.target) && sidebar.classList.contains("active")) {
    //             sidebar.classList.remove("active");
    //         }
    //     });
    // }

    // Initialize tabs automatically
    setupTabs();
});

/* =========================================
   SmartLab Utility Functions
========================================= */
const SmartLab = {
    initTabs: () => setupTabs(),

    initTableFilter: (selectId, tableId, colIndex) => {
        const filterSelect = $(selectId);
        const table = $(tableId);
        if (!filterSelect || !table) return;

        filterSelect.addEventListener("change", e => {
            const filterValue = e.target.value.toLowerCase();
            table.querySelectorAll("tbody tr").forEach(row => {
                const cellText = row.cells[colIndex]?.innerText.toLowerCase() || "";
                row.style.display = (filterValue === "all" || cellText.includes(filterValue)) ? "" : "none";
            });
        });
    },

    toggleModal: (modalId, show = true) => {
        const modal = $(modalId);
        if (!modal) return;

        if (show) {
            modal.classList.remove("hidden");
            modal.classList.add("flex-display");
        } else {
            modal.classList.add("hidden");
            modal.classList.remove("flex-display");
        }
    }
};
