/* =========================================
   SmartLab – Admin: Reports (Tabbed)
   3 tabs: Requests · Schedule · Equipment
   Each tab has summary stats, filters, table,
   and PDF / Print exports.
========================================= */

(() => {
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  let acFilter = null;
  let activeTab = 'requests';
  let debounceTimers = {};

  /* ── Per-tab state ─────────────────────── */
  let state = {
    requests:  { all: [], filtered: [] },
    schedule:  { all: [], filtered: [] },
    equipment: { all: [], filtered: [] }
  };
  let labRoomsCache = [];

  const normalizeRoomLabel = (label = '') => String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function isComputerLabRoom(room = {}) {
    if (room?.is_computer_lab !== undefined && room?.is_computer_lab !== null) {
      return Number(room.is_computer_lab) === 1 || room.is_computer_lab === true;
    }
    const label = `${room.room_name || ''} ${room.room_number || ''}`.toLowerCase();
    return label.includes('computer laboratory') || label.includes('computer lab');
  }

  function buildRoomLabel(room = {}) {
    const number = (room.room_number || '').trim();
    const name = (room.room_name || '').trim();
    const building = (room.building_name || '').trim();
    const parts = [];
    if (number) parts.push(number);
    if (name && name !== number) parts.push(name);
    if (building) parts.push(building);
    return parts.join(' • ') || number || name || '';
  }

  async function ensureLabRooms() {
    if (labRoomsCache?.length) return labRoomsCache;
    try {
      const response = await fetch('/api/academic-directory/rooms', { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to load room directory');
      const rooms = await response.json();
      labRoomsCache = Array.isArray(rooms) ? rooms.filter(isComputerLabRoom) : [];
    } catch (err) {
      console.warn('Reports: unable to load lab rooms', err);
      labRoomsCache = [];
    }
    return labRoomsCache;
  }

  /* ============================================================
     TAB SWITCHING
  ============================================================ */
  function initTabs() {
    qsa('.report-view-toggle .view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.reportTab;
        if (tab === activeTab) return;

        // Toggle active button
        qsa('.report-view-toggle .view-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle panels
        qsa('.report-tab-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById('tab-' + tab);
        if (panel) panel.classList.remove('hidden');

        activeTab = tab;

        // Lazy-load data on first visit
        if (tab === 'schedule' && !state.schedule.all.length) loadScheduleData();
        if (tab === 'equipment' && !state.equipment.all.length) loadEquipmentData();
      });
    });
  }

  /* ============================================================
     SHARED HELPERS
  ============================================================ */
  function setStatText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fmtDate(dateString) {
    if (!dateString) return '-';
    return SmartLab.Core.Utils.formatDate(dateString);
  }

  function fmtTime(start, end) {
    if (!start && !end) return '-';
    return SmartLab.Core.Utils.formatTimeRange(start, end);
  }

  function fmtSingleTime(t) {
    if (!t) return '-';
    return SmartLab.Core.Utils.formatTime(t);
  }

  function fmtProgramYear(row) {
    const programCode = row.program_code || '';
    const year = row.year_level || '';
    if (!programCode && !year) return '-';
    return [programCode, year].filter(Boolean).join(' - ');
  }

  const formatYearLabel = (v) => {
    const num = Number(v);
    const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
    return Number.isFinite(num) ? `${num}${suffix} Year` : v;
  };

  async function loadLogoImage(src = '/images/PUPLogo.png') {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function buildStyledReportPdf({ title, columns, rows, orientation = 'landscape', subtitle = '', bannerTitle = '', columnWidths = {} }) {
    if (typeof window.jspdf === 'undefined') return null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();

    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const logoSize = { w: 26, h: 26 };
    const logo = await loadLogoImage();
    const certLogo = await loadLogoImage('/images/cert.png');
    const footerReserve = 48; // keep space for footer on every page

    // Header text (no background fill per request)
    if (logo) {
      doc.addImage(logo, 'PNG', margin.left, margin.top, logoSize.w, logoSize.h);
    } else {
      doc.rect(margin.left, margin.top, logoSize.w, logoSize.h);
      doc.setFontSize(8); doc.text('LOGO', margin.left + logoSize.w/2, margin.top + logoSize.h/2, { align:'center' });
    }

    const headerFont = (doc.getFontList?.()['californianfb']) ? 'californianfb' : 'times';
    const ws = (txt) => String(txt || '').replace(/ /g, '  ');
    doc.setTextColor(60);
    doc.setFont(headerFont, 'normal');
    doc.setFontSize(9);
    doc.text(ws('REPUBLIC OF THE PHILIPPINES'), margin.left + logoSize.w + 4, margin.top + 6);
    doc.setFont(headerFont, 'bold');
    doc.setFontSize(10);
    doc.text(ws('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES'), margin.left + logoSize.w + 4, margin.top + 11);
    doc.setFont(headerFont, 'normal');
    doc.setFontSize(9);
    doc.text(ws('OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS'), margin.left + logoSize.w + 4, margin.top + 16);
    doc.setFont(headerFont, 'bold');
    doc.setFontSize(10);
    doc.text(ws('COLLEGE OF COMPUTER AND INFORMATION SCIENCES'), margin.left + logoSize.w + 4, margin.top + 21);
    doc.setFont(headerFont, 'normal');

    // Doc code box on right
    const codeBoxW = 32, codeBoxH = 14;
    const codeX = pw - margin.right - codeBoxW;
    const codeY = margin.top + 8;
    doc.rect(codeX, codeY, codeBoxW, codeBoxH);
    doc.setFontSize(8);
    const codeTextX = codeX + 2;
    doc.text('PUP-ITBL-3-ACAD-010', codeTextX, codeY + 4);
    doc.text('REV. 1', codeTextX, codeY + 8);
    const docDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
    doc.text(docDate, codeTextX, codeY + 12);

    // Title (skip when bannerTitle is used to avoid duplicate heading)
    if (!bannerTitle) {
      doc.setFontSize(13); doc.setFont('times', 'bold');
      doc.text(title, pw/2, margin.top + 18, { align:'center' });
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      if (subtitle) {
        doc.text(subtitle, pw/2, margin.top + 24, { align:'center' });
      }
    }

    // Table (banner row inside header if provided)
    const headRows = bannerTitle
      ? [[{ content: bannerTitle, colSpan: columns.length, styles: { halign:'center', fontStyle:'bold', fontSize:11, fillColor:[236,173,117], textColor:0 } }], columns]
      : [columns];

    doc.autoTable({
      startY: margin.top + 30,
      head: headRows,
      body: rows,
      theme: 'grid',
      styles: { font:'helvetica', fontSize:8.5, cellPadding:2, minCellHeight:7, lineColor:[0,0,0], lineWidth:0.2 },
      headStyles: { fillColor:[236, 173, 117], textColor:0, fontStyle:'bold', halign:'center' },
      alternateRowStyles: { fillColor:[255,255,255] },
      columnStyles: columnWidths,
      rowPageBreak: 'avoid',
      margin: { left: margin.left, right: margin.right, top: margin.top, bottom: footerReserve },
      tableWidth: pw - margin.left - margin.right,
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        const footerY = pageH - footerReserve + 4;
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
        const pageTotal = doc.internal.getNumberOfPages();
        // Prepared / Noted
        doc.setFontSize(10);
        doc.text('Prepared by:', margin.left, footerY);
        doc.text('Noted by:', pw/2 + 20, footerY);
        doc.line(margin.left, footerY + 6, margin.left + 60, footerY + 6);
        doc.line(pw/2 + 20, footerY + 6, pw/2 + 90, footerY + 6);
        doc.setFontSize(9);
        doc.text('Laboratory Assistant', margin.left, footerY + 12);
        doc.text('Head, CCIS Laboratory', pw/2 + 20, footerY + 12);

        // Page number (bottom-right)
        doc.setFont('helvetica','normal');
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.text(`Page ${pageNum} of ${pageTotal}`, pw - margin.right, pageH - 6, { align:'right' });

        // Address block
        const addrY = footerY + 20;
        doc.setFontSize(8);
        doc.text('PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016', margin.left, addrY);
        doc.text('Direct line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000', margin.left, addrY + 4);
        doc.text('Website: www.pup.edu.ph | Email: inquire@pup.edu.ph', margin.left, addrY + 8);
        doc.setFontSize(10);
        doc.setFont('CalifornianFB', 'bold');
        doc.setFontSize(14); 
        doc.text("THE COUNTRY'S 1ST POLYTECHNIC U", margin.left, addrY + 16);

        // Right-side certification logo(s)
        const logoY = footerY + 4;
        const logoSize = 30;
        if (certLogo) {
          doc.addImage(certLogo, 'PNG', pw - margin.right - logoSize, logoY, logoSize, logoSize);
        } else {
          doc.rect(pw - margin.right - logoSize, logoY, logoSize, logoSize);
        }
      }
    });

    // Finalize page numbers with total count
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(`Page ${i} of ${totalPages}`, pw - margin.right, pageH - 6, { align:'right' });
    }

    return doc;
  }

  function slugify(s) {
    return String(s || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  function escapeHtml(input) {
    return String(input ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function csvEsc(val) { return String(val || '').replace(/"/g, '""'); }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function notify(msg) {
    if (SmartLab?.Core?.UI?.showToast) SmartLab.Core.UI.showToast(msg, 'warning');
  }

  function buildPdfDoc({ orientation = 'landscape', title = 'SmartLab Report', subtitle = '', columns = [], rows = [] }) {
    if (typeof window.jspdf === 'undefined') return null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('en-US', { timeZone:'Asia/Manila' });

    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.setTextColor(26,32,44);
    doc.text(title, pw/2, 16, { align:'center' });
    doc.setFontSize(10);
    doc.setTextColor(100);
    const subtitleText = subtitle ? `${subtitle} | Generated: ${now}` : `Generated: ${now}`;
    doc.text(subtitleText, pw/2, 22, { align:'center' });

    doc.autoTable({
      startY: 28,
      head: [columns],
      body: rows,
      theme: 'grid',
      styles: { font:'helvetica', fontSize:8, cellPadding:2 },
      headStyles: { fillColor:[17,24,39], textColor:255, fontSize:9, fontStyle:'bold', halign:'center' },
      alternateRowStyles: { fillColor:[245,245,245] },
      margin: { top:28, right:10, bottom:15, left:10 }
    });

    return doc;
  }

  function authHeaders() {
    return { 'Accept': 'application/json', ...SmartLab.Core.Auth.getAuthHeaders() };
  }

  function acQueryString() {
    return acFilter ? acFilter.toQueryString() : '';
  }

  function urlWithAc(base) {
    const ac = acQueryString();
    return ac ? `${base}?${ac}` : base;
  }

  function showLoading(tbodyId, cols) {
    const tbody = document.getElementById(tbodyId);
    if (tbody) tbody.innerHTML = `<tr class="no-data-row"><td colspan="${cols}">Loading...</td></tr>`;
  }

  function showError(tbodyId, cols, msg) {
    const tbody = document.getElementById(tbodyId);
    if (tbody) tbody.innerHTML = `<tr class="no-data-row"><td colspan="${cols}" style="color:#dc2626;">${escapeHtml(msg)}</td></tr>`;
  }

  function updateCount(countId, filtered, total) {
    const el = document.getElementById(countId);
    if (!el) return;
    el.textContent = filtered === total
      ? `${total} record${total !== 1 ? 's' : ''}`
      : `${filtered} of ${total} records`;
  }

  function debounced(key, fn, delay = 250) {
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, delay);
  }

  /* ============================================================
     TAB 1: REQUESTS
  ============================================================ */
  async function loadRequestStats() {
    try {
      const res = await fetch(urlWithAc('/api/reports/summary/stats'), { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const s = await res.json();
      setStatText('stat-total-requests', s.total_borrow_requests ?? 0);
      setStatText('stat-active-requests', s.active_borrow_requests ?? 0);
      setStatText('stat-returned', s.returned_items ?? 0);
      setStatText('stat-total-equipment', s.total_equipment ?? 0);
    } catch (e) { console.error('Request stats error:', e); }
  }

  async function loadRequestData() {
    showLoading('req-table-body', 8);
    try {
      const res = await fetch(urlWithAc('/api/reports'), { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      state.requests.all = Array.isArray(data) ? data : [];
      populateRequestFilterOptions();
      applyRequestFilters();
    } catch (e) {
      console.error('Request data error:', e);
      showError('req-table-body', 8, 'Failed to load: ' + e.message);
    }
  }

  async function populateRequestFilterOptions() {
    const roomSel = qs('#req-room-filter');
    const programSel = qs('#req-program-filter');
    const yearSel = qs('#req-year-filter');
    if (!roomSel || !programSel || !yearSel) return;

    const labRooms = await ensureLabRooms();
    let rooms = [];
    if (labRooms.length) {
      rooms = labRooms
        .map(buildRoomLabel)
        .filter(Boolean)
        .sort((a,b) => a.localeCompare(b));
    } else {
      rooms = Array.from(new Set(
        state.requests.all
          .map(r => r.location)
          .filter(label => {
            if (!label) return false;
            const normalized = label.toLowerCase();
            return normalized.includes('computer laboratory') || normalized.includes('computer lab');
          })
      )).sort();
    }
    const programs = Array.from(new Set(state.requests.all.map(r => r.program_code).filter(Boolean))).sort();
    const years = Array.from(new Set(state.requests.all.map(r => r.year_level).filter(v => v !== undefined && v !== null)))
      .sort((a, b) => String(a).localeCompare(String(b)));

    const makeOpts = (sel, values, labelFn = v => v) => {
      sel.innerHTML = '<option value="">' + sel.options[0].textContent + '</option>' +
        values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(labelFn(v))}</option>`).join('');
    };

    makeOpts(roomSel, rooms);
    makeOpts(programSel, programs);
    makeOpts(yearSel, years, formatYearLabel);
  }

  function buildRequestBannerTitle() {
    const status = qs('#req-status-filter')?.value || '';
    const dateFrom = qs('#req-date-from')?.value;
    const dateTo = qs('#req-date-to')?.value;
    const room = qs('#req-room-filter')?.value || '';
    const program = qs('#req-program-filter')?.value || '';
    const year = qs('#req-year-filter')?.value || '';

    const parts = [];
    parts.push(status ? `${status} Request Reports` : 'Request Reports');

    if (dateFrom && dateTo) {
      parts.push(`for ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`);
    } else if (dateFrom) {
      parts.push(`from ${fmtDate(dateFrom)}`);
    } else if (dateTo) {
      parts.push(`up to ${fmtDate(dateTo)}`);
    }

    const qualifiers = [];
    if (program) qualifiers.push(`Program: ${program}`);
    if (year) qualifiers.push(`Year: ${formatYearLabel(year)}`);
    if (room) qualifiers.push(`Room: ${room}`);
    if (qualifiers.length) parts.push(qualifiers.join(' • '));

    return parts.join(' – ');
  }

  function applyRequestFilters() {
    const search = (qs('#req-search')?.value || '').toLowerCase().trim();
    const status = qs('#req-status-filter')?.value || '';
    const dateFrom = qs('#req-date-from')?.value;
    const dateTo = qs('#req-date-to')?.value;
    const room = qs('#req-room-filter')?.value || '';
    const program = qs('#req-program-filter')?.value || '';
    const year = qs('#req-year-filter')?.value || '';
    const normalizedRoom = room ? normalizeRoomLabel(room) : '';

    state.requests.filtered = state.requests.all.filter(r => {
      if (search) {
        const hay = [r.requester_name, r.location, r.equipment_list, r.course_year, r.faculty_in_charge, r.status]
          .map(v => (v || '').toLowerCase()).join(' ');
        if (!hay.includes(search)) return false;
      }
      if (status && r.status !== status) return false;
      if (normalizedRoom && normalizeRoomLabel(r.location) !== normalizedRoom) return false;
      if (program && r.program_code !== program) return false;
      if (year && String(r.year_level) !== String(year)) return false;
      if (dateFrom && r.date && new Date(r.date) < new Date(dateFrom)) return false;
      if (dateTo && r.date) {
        const to = new Date(dateTo); to.setHours(23,59,59,999);
        if (new Date(r.date) > to) return false;
      }
      return true;
    });

    renderRequestTable();
    updateCount('req-results-count', state.requests.filtered.length, state.requests.all.length);
  }

  function clearRequestFilters() {
    ['req-search','req-status-filter','req-date-from','req-date-to','req-room-filter','req-program-filter','req-year-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    state.requests.filtered = [...state.requests.all];
    renderRequestTable();
    updateCount('req-results-count', state.requests.filtered.length, state.requests.all.length);
  }

  function renderRequestTable() {
    const tbody = document.getElementById('req-table-body');
    if (!tbody) return;
    const rows = state.requests.filtered;
    if (!rows.length) { tbody.innerHTML = '<tr class="no-data-row"><td colspan="8">No reports found</td></tr>'; return; }

    tbody.innerHTML = rows.map(r => `<tr>
      <td>${escapeHtml(fmtDate(r.date))}</td>
      <td>${escapeHtml(r.location || '-')}</td>
      <td>${escapeHtml(r.equipment_list || '-')}</td>
      <td>${escapeHtml(r.requester_name || '-')}</td>
      <td>${escapeHtml(fmtProgramYear(r))}</td>
      <td>${escapeHtml(r.faculty_in_charge || '-')}</td>
      <td>${escapeHtml(fmtTime(r.time_start, r.time_end))}</td>
      <td><span class="status-badge status-${slugify(r.status)}">${escapeHtml(r.status || '-')}</span></td>
    </tr>`).join('');
  }

  /* ── Request Exports ──────────────────── */
  function reqExportCSV() {
    const rows = state.requests.filtered;
    if (!rows.length) return notify('No data to export');
    const h = ['Date','Room','Items','Requester Name','Program & Year','Faculty In Charge','Time','Status'];
    const body = rows.map(r => [
      fmtDate(r.date), `"${csvEsc(r.location)}"`, `"${csvEsc(r.equipment_list)}"`,
      `"${csvEsc(r.requester_name)}"`, `"${csvEsc(fmtProgramYear(r))}"`,
      `"${csvEsc(r.faculty_in_charge)}"`, `"${fmtTime(r.time_start, r.time_end)}"`,
      `"${csvEsc(r.status)}"`
    ].join(','));
    download([h.join(','), ...body].join('\n'), 'smartlab-requests-report.csv', 'text/csv');
  }

  function reqExportExcel() {
    const rows = state.requests.filtered;
    if (!rows.length) return notify('No data to export');
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;font-size:12px}
      th{background:#800000;color:#fff;font-weight:bold;text-align:center;padding:10px 8px;border:1px solid #333}
      td{padding:8px;border:1px solid #ddd;text-align:left;vertical-align:top}
      tr:nth-child(even){background:#f9f9f9}</style></head><body>
      <h3 style="text-align:center;font-family:Arial">SmartLab – Requests Report</h3>
      <p style="text-align:center;font-size:11px;color:#666">Generated: ${now} | Records: ${rows.length}</p>
      <table><thead><tr><th>DATE</th><th>ROOM</th><th>ITEM/S</th><th>REQUESTER NAME</th><th>PROGRAM &amp; YEAR</th><th>FACULTY</th><th>TIME</th><th>STATUS</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${escapeHtml(r.location||'-')}</td><td>${escapeHtml(r.equipment_list||'-')}</td><td>${escapeHtml(r.requester_name||'-')}</td><td>${escapeHtml(fmtProgramYear(r))}</td><td>${escapeHtml(r.faculty_in_charge||'-')}</td><td>${fmtTime(r.time_start,r.time_end)}</td><td>${escapeHtml(r.status||'-')}</td></tr>`).join('')}
      </tbody></table></body></html>`;
    download(html, 'smartlab-requests-report.xls', 'application/vnd.ms-excel');
  }

  async function reqExportPDF(mode = 'save') {
    const rows = state.requests.filtered;
    if (!rows.length) return notify('No data to export');
    const columns = ['DATE','ROOM','ITEM/S','REQUESTER NAME','PROGRAM & YEAR','FACULTY-IN-CHARGE','TIME','STATUS'];
    const body = rows.map(r => [
      fmtDate(r.date), r.location||'-', r.equipment_list||'-', r.requester_name||'-', fmtProgramYear(r), r.faculty_in_charge||'-', fmtTime(r.time_start,r.time_end), r.status||'-'
    ]);
    const bannerTitle = buildRequestBannerTitle();
    const doc = await buildStyledReportPdf({
      title: 'Request Reports',
      bannerTitle,
      columns,
      rows: body,
      orientation: 'landscape',
      columnWidths: {
        0: { cellWidth: 25 }, // DATE
        1: { cellWidth: 28 }, // ROOM
        2: { cellWidth: 52 }, // ITEM/S
        3: { cellWidth: 45 }, // REQUESTER NAME
        4: { cellWidth: 30 }, // PROGRAM & YEAR
        5: { cellWidth: 45 }, // FACULTY
        6: { cellWidth: 36 }, // TIME
        7: { cellWidth: 24 }, // STATUS
      }
    });
    if (!doc) return notify('PDF library not loaded');
    if (mode === 'print') {
      doc.autoPrint();
      doc.output('dataurlnewwindow');
    } else {
      doc.save('smartlab-requests-report.pdf');
    }
  }

  /* ============================================================
     TAB 2: SCHEDULE
  ============================================================ */
  async function loadScheduleData() {
    showLoading('sched-table-body', 7);
    try {
      const res = await fetch(urlWithAc('/api/labSchedule'), { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      state.schedule.all = Array.isArray(data) ? data : [];
      populateScheduleFilterOptions();
      computeScheduleStats();
      applyScheduleFilters();
    } catch (e) {
      console.error('Schedule data error:', e);
      showError('sched-table-body', 7, 'Failed to load: ' + e.message);
    }
  }

  function computeScheduleStats() {
    const all = state.schedule.all;
    setStatText('stat-total-schedules', all.length);
    const faculties = new Set(all.map(s => s.faculty_id).filter(Boolean));
    setStatText('stat-total-faculty-sched', faculties.size);
    const rooms = new Set(all.map(s => s.lab_room).filter(Boolean));
    setStatText('stat-total-rooms', rooms.size);
    const oneTime = all.filter(s => s.schedule_date).length;
    setStatText('stat-onetime-schedules', oneTime);
  }

  async function populateScheduleFilterOptions() {
    const roomSel = qs('#sched-room-filter');
    const programSel = qs('#sched-program-filter');
    const yearSel = qs('#sched-year-filter');
    if (!roomSel || !programSel || !yearSel) return;

    const labRooms = await ensureLabRooms();
    let rooms = [];
    if (labRooms.length) {
      rooms = labRooms
        .map(buildRoomLabel)
        .filter(Boolean)
        .sort((a,b) => a.localeCompare(b));
    } else {
      rooms = Array.from(new Set(
        state.schedule.all
          .map(s => s.lab_room)
          .filter(label => {
            if (!label) return false;
            const normalized = label.toLowerCase();
            return normalized.includes('computer laboratory') || normalized.includes('computer lab');
          })
      )).sort();
    }
    const programs = Array.from(new Set(state.schedule.all.map(s => s.program_code).filter(Boolean))).sort();
    const years = Array.from(new Set(state.schedule.all.map(s => s.year_level).filter(v => v !== undefined && v !== null)))
      .sort((a,b) => String(a).localeCompare(String(b)));

    const makeOpts = (sel, values, labelFn = v => v) => {
      sel.innerHTML = '<option value="">' + sel.options[0].textContent + '</option>' +
        values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(labelFn(v))}</option>`).join('');
    };

    makeOpts(roomSel, rooms);
    makeOpts(programSel, programs);
    makeOpts(yearSel, years, formatYearLabel);
  }

  function applyScheduleFilters() {
    const search = (qs('#sched-search')?.value || '').toLowerCase().trim();
    const day = qs('#sched-day-filter')?.value || '';
    const dateFrom = qs('#sched-date-from')?.value;
    const dateTo = qs('#sched-date-to')?.value;
    const room = qs('#sched-room-filter')?.value || '';
    const program = qs('#sched-program-filter')?.value || '';
    const year = qs('#sched-year-filter')?.value || '';
    const type = qs('#sched-type-filter')?.value || '';
    const normalizedRoom = room ? normalizeRoomLabel(room) : '';

    state.schedule.filtered = state.schedule.all.filter(s => {
      if (search) {
        const hay = [s.faculty_name, s.lab_room, s.subject, s.program, s.day_of_week]
          .map(v => (v || '').toLowerCase()).join(' ');
        if (!hay.includes(search)) return false;
      }
      if (day) {
        const sDay = (s.day_of_week || '').toLowerCase();
        if (!sDay.startsWith(day.toLowerCase().substring(0,3)) && sDay !== day.toLowerCase()) return false;
      }
      if (dateFrom && s.schedule_date) {
        if (new Date(s.schedule_date) < new Date(dateFrom)) return false;
      }
      if (dateTo && s.schedule_date) {
        const to = new Date(dateTo); to.setHours(23,59,59,999);
        if (new Date(s.schedule_date) > to) return false;
      }
      if (normalizedRoom && normalizeRoomLabel(s.lab_room) !== normalizedRoom) return false;
      if (program && s.program_code !== program) return false;
      if (year && String(s.year_level) !== String(year)) return false;
      if (type) {
        const isOT = !!s.schedule_date;
        const sType = isOT ? 'One-Time' : 'Recurring';
        if (sType !== type) return false;
      }
      return true;
    });

    renderScheduleTable();
    updateCount('sched-results-count', state.schedule.filtered.length, state.schedule.all.length);
  }

  function clearScheduleFilters() {
    ['sched-search','sched-day-filter','sched-date-from','sched-date-to','sched-room-filter','sched-program-filter','sched-year-filter','sched-type-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    state.schedule.filtered = [...state.schedule.all];
    renderScheduleTable();
    updateCount('sched-results-count', state.schedule.filtered.length, state.schedule.all.length);
  }

  function buildScheduleBannerTitle() {
    const day = qs('#sched-day-filter')?.value || '';
    const dateFrom = qs('#sched-date-from')?.value;
    const dateTo = qs('#sched-date-to')?.value;
    const room = qs('#sched-room-filter')?.value || '';
    const program = qs('#sched-program-filter')?.value || '';
    const year = qs('#sched-year-filter')?.value || '';
    const type = qs('#sched-type-filter')?.value || '';

    const parts = ['Schedule Reports'];
    if (day) parts.push(day);
    if (dateFrom && dateTo) parts.push(`for ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`);
    else if (dateFrom) parts.push(`from ${fmtDate(dateFrom)}`);
    else if (dateTo) parts.push(`up to ${fmtDate(dateTo)}`);

    const qualifiers = [];
    if (program) qualifiers.push(`Program: ${program}`);
    if (year) qualifiers.push(`Year: ${formatYearLabel(year)}`);
    if (room) qualifiers.push(`Room: ${room}`);
    if (type) qualifiers.push(`Type: ${type}`);
    if (qualifiers.length) parts.push(qualifiers.join(' • '));

    return parts.join(' – ');
  }

  function renderScheduleTable() {
    const tbody = document.getElementById('sched-table-body');
    if (!tbody) return;
    const rows = state.schedule.filtered;
    if (!rows.length) { tbody.innerHTML = '<tr class="no-data-row"><td colspan="7">No schedules found</td></tr>'; return; }

    tbody.innerHTML = rows.map(s => {
      const isOneTime = !!s.schedule_date;
      const dayLabel = isOneTime ? fmtDate(s.schedule_date) : escapeHtml(s.day_of_week || '-');
      const prog = fmtProgramYear({ program_code: s.program_code, year_level: s.year_level });
      const typeCls = isOneTime ? 'one-time' : 'recurring';
      const typeLabel = isOneTime ? 'One-Time' : 'Recurring';

      return `<tr>
        <td>${dayLabel}</td>
        <td>${escapeHtml(s.lab_room || '-')}</td>
        <td>${escapeHtml(s.subject || '-')}</td>
        <td>${escapeHtml(s.faculty_name || '-')}</td>
        <td>${escapeHtml(prog)}</td>
        <td>${escapeHtml(fmtTime(s.time_start, s.time_end))}</td>
        <td><span class="type-badge ${typeCls}">${typeLabel}</span></td>
      </tr>`;
    }).join('');
  }

  /* ── Schedule Exports ─────────────────── */
  function schedExportCSV() {
    const rows = state.schedule.filtered;
    if (!rows.length) return notify('No data to export');
    const h = ['Day','Room','Subject','Faculty','Program & Year','Time','Type'];
    const body = rows.map(s => {
      const isOT = !!s.schedule_date;
      const day = isOT ? fmtDate(s.schedule_date) : (s.day_of_week||'-');
      const prog = fmtProgramYear({ program_code: s.program_code, year_level: s.year_level });
      return [`"${csvEsc(day)}"`,`"${csvEsc(s.lab_room)}"`,`"${csvEsc(s.subject)}"`,`"${csvEsc(s.faculty_name)}"`,`"${csvEsc(prog)}"`,`"${fmtTime(s.time_start,s.time_end)}"`,`"${isOT?'One-Time':'Recurring'}"`].join(',');
    });
    download([h.join(','), ...body].join('\n'), 'smartlab-schedule-report.csv', 'text/csv');
  }

  function schedExportExcel() {
    const rows = state.schedule.filtered;
    if (!rows.length) return notify('No data to export');
    const now = new Date().toLocaleString('en-US', { timeZone:'Asia/Manila' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;font-size:12px}
      th{background:#800000;color:#fff;font-weight:bold;text-align:center;padding:10px 8px;border:1px solid #333}
      td{padding:8px;border:1px solid #ddd;text-align:left}
      tr:nth-child(even){background:#f9f9f9}</style></head><body>
      <h3 style="text-align:center;font-family:Arial">SmartLab – Schedule Report</h3>
      <p style="text-align:center;font-size:11px;color:#666">Generated: ${now} | Records: ${rows.length}</p>
      <table><thead><tr><th>DAY</th><th>ROOM</th><th>SUBJECT</th><th>FACULTY</th><th>PROGRAM &amp; YEAR</th><th>TIME</th><th>TYPE</th></tr></thead><tbody>
      ${rows.map(s => {
        const isOT = !!s.schedule_date;
        const day = isOT ? fmtDate(s.schedule_date) : escapeHtml(s.day_of_week||'-');
        const prog = fmtProgramYear({ program_code: s.program_code, year_level: s.year_level });
        return `<tr><td>${day}</td><td>${escapeHtml(s.lab_room||'-')}</td><td>${escapeHtml(s.subject||'-')}</td><td>${escapeHtml(s.faculty_name||'-')}</td><td>${escapeHtml(prog)}</td><td>${fmtTime(s.time_start,s.time_end)}</td><td>${isOT?'One-Time':'Recurring'}</td></tr>`;
      }).join('')}
      </tbody></table></body></html>`;
    download(html, 'smartlab-schedule-report.xls', 'application/vnd.ms-excel');
  }

  async function schedExportPDF(mode = 'save') {
    const rows = state.schedule.filtered;
    if (!rows.length) return notify('No data to export');
    const columns = ['DAY','ROOM','SUBJECT','FACULTY','PROGRAM & YEAR','TIME','TYPE'];
    const body = rows.map(s => {
      const isOT = !!s.schedule_date;
      const day = isOT ? fmtDate(s.schedule_date) : (s.day_of_week||'-');
      const prog = fmtProgramYear({ program_name: s.program, program_code: s.program_code, year_level: s.year_level });
      return [day, s.lab_room||'-', s.subject||'-', s.faculty_name||'-', prog, fmtTime(s.time_start,s.time_end), isOT?'One-Time':'Recurring'];
    });
    const bannerTitle = buildScheduleBannerTitle();
    const doc = await buildStyledReportPdf({ title: 'Schedule Reports', bannerTitle, columns, rows: body, orientation: 'landscape', subtitle: `Records: ${rows.length}` });
    if (!doc) return notify('PDF library not loaded');
    if (mode === 'print') {
      doc.autoPrint();
      doc.output('dataurlnewwindow');
    } else {
      doc.save('smartlab-schedule-report.pdf');
    }
  }

  /* ============================================================
     TAB 3: EQUIPMENT (with date-range usage)
     ─ No range  → Inventory Snapshot: Name, Total Qty, Available, Borrowed, Damaged
     ─ With range → Usage Report:      Name, Total Qty, Times Borrowed, Qty Borrowed, Qty Returned, Unreturned
  ============================================================ */
  let eqHasRange = false;

  async function loadEquipmentData() {
    const dateFrom = qs('#eq-date-from')?.value || '';
    const dateTo   = qs('#eq-date-to')?.value   || '';
    eqHasRange = !!(dateFrom && dateTo);

    const colCount = eqHasRange ? 6 : 5;
    showLoading('eq-table-body', colCount);

    try {
      let url = '/api/reports/equipment-summary';
      if (eqHasRange) url += `?date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      state.equipment.all = Array.isArray(data) ? data : [];
      updateEquipmentTableHeaders();
      computeEquipmentStats();
      applyEquipmentFilters();
    } catch (e) {
      console.error('Equipment data error:', e);
      showError('eq-table-body', colCount, 'Failed to load: ' + e.message);
    }
  }

  function onEquipmentDateChange() {
    const dateFrom = qs('#eq-date-from')?.value || '';
    const dateTo   = qs('#eq-date-to')?.value   || '';
    if ((dateFrom && dateTo) || (!dateFrom && !dateTo)) {
      loadEquipmentData();
    }
  }

  function updateEquipmentTableHeaders() {
    const thead = document.getElementById('eq-table-head');
    const hint  = document.getElementById('eq-date-hint');
    if (!thead) return;

    if (eqHasRange) {
      thead.innerHTML = `<tr>
        <th>Name</th>
        <th>Total Qty</th>
        <th>Times Borrowed</th>
        <th>Qty Borrowed</th>
        <th>Qty Returned</th>
        <th>Unreturned</th>
      </tr>`;
      if (hint) hint.style.display = 'flex';
    } else {
      thead.innerHTML = `<tr>
        <th>Name</th>
        <th>Total Qty</th>
        <th>Available</th>
        <th>Borrowed</th>
        <th>Damaged</th>
      </tr>`;
      if (hint) hint.style.display = 'none';
    }
  }

  function updateEquipmentStatLabels() {
    const lbl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    if (eqHasRange) {
      lbl('stat-eq-available-label', 'Total Borrowed');
      lbl('stat-eq-borrowed-label',  'Total Returned');
      lbl('stat-eq-damaged-label',   'Total Unreturned');
    } else {
      lbl('stat-eq-available-label', 'Available Qty');
      lbl('stat-eq-borrowed-label',  'Borrowed Qty');
      lbl('stat-eq-damaged-label',   'Damaged Qty');
    }
  }

  function computeEquipmentStats() {
    const all = state.equipment.all;
    setStatText('stat-eq-total', all.length);
    updateEquipmentStatLabels();

    if (eqHasRange) {
      const totalBorrowed   = all.reduce((s, e) => s + Number(e.qty_borrowed || 0), 0);
      const totalReturned   = all.reduce((s, e) => s + Number(e.qty_returned || 0), 0);
      const totalUnreturned = totalBorrowed - totalReturned;
      setStatText('stat-eq-available', totalBorrowed);
      setStatText('stat-eq-borrowed',  totalReturned);
      setStatText('stat-eq-damaged',   totalUnreturned);
    } else {
      setStatText('stat-eq-available', all.reduce((s, e) => s + Number(e.available_qty || 0), 0));
      setStatText('stat-eq-borrowed',  all.reduce((s, e) => s + Number(e.current_borrowed || 0), 0));
      setStatText('stat-eq-damaged',   all.reduce((s, e) => s + Number(e.current_damaged || 0), 0));
    }
  }

  function applyEquipmentFilters() {
    const search = (qs('#eq-search')?.value || '').toLowerCase().trim();
    const dateFrom = qs('#eq-date-from')?.value || '';
    const dateTo   = qs('#eq-date-to')?.value   || '';

    // reload data if range toggled (guard in onEquipmentDateChange already)
    if (!!dateFrom !== !!dateTo) {
      // partial range: just filter current set
      eqHasRange = false;
      updateEquipmentTableHeaders();
      updateEquipmentStatLabels();
    }

    state.equipment.filtered = state.equipment.all.filter(e => {
      if (search && !(e.equipment_name || '').toLowerCase().includes(search)) return false;
      return true;
    });

    renderEquipmentTable();
    updateCount('eq-results-count', state.equipment.filtered.length, state.equipment.all.length);
  }

  function clearEquipmentFilters() {
    ['eq-search','eq-date-from','eq-date-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    loadEquipmentData();
  }

  function renderEquipmentTable() {
    const tbody = document.getElementById('eq-table-body');
    if (!tbody) return;
    const rows = state.equipment.filtered;
    const colCount = eqHasRange ? 6 : 5;
    if (!rows.length) { tbody.innerHTML = `<tr class="no-data-row"><td colspan="${colCount}">No equipment found</td></tr>`; return; }

    if (eqHasRange) {
      tbody.innerHTML = rows.map(e => {
        const unreturned = (e.qty_borrowed || 0) - (e.qty_returned || 0);
        return `<tr>
          <td>${escapeHtml(e.equipment_name || '-')}</td>
          <td>${e.total_qty ?? '-'}</td>
          <td>${e.times_borrowed ?? 0}</td>
          <td><strong>${e.qty_borrowed ?? 0}</strong></td>
          <td>${e.qty_returned ?? 0}</td>
          <td><strong>${unreturned}</strong></td>
        </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = rows.map(e => `<tr>
        <td>${escapeHtml(e.equipment_name || '-')}</td>
        <td>${e.total_qty ?? '-'}</td>
        <td>${e.available_qty ?? '-'}</td>
        <td>${e.current_borrowed ?? '-'}</td>
        <td>${e.current_damaged ?? '-'}</td>
      </tr>`).join('');
    }
  }

  /* ── Equipment Exports ────────────────── */
  function eqHeaders() {
    return eqHasRange
      ? ['Name','Total Qty','Times Borrowed','Qty Borrowed','Qty Returned','Unreturned']
      : ['Name','Total Qty','Available','Borrowed','Damaged'];
  }

  function eqRowData(e) {
    if (eqHasRange) {
      const unreturned = (e.qty_borrowed || 0) - (e.qty_returned || 0);
      return [e.equipment_name||'-', e.total_qty, e.times_borrowed||0, e.qty_borrowed||0, e.qty_returned||0, unreturned];
    }
    return [e.equipment_name||'-', e.total_qty, e.available_qty, e.current_borrowed, e.current_damaged];
  }

  function eqExportCSV() {
    const rows = state.equipment.filtered;
    if (!rows.length) return notify('No data to export');
    const h = eqHeaders();
    const body = rows.map(e => {
      const d = eqRowData(e);
      return d.map((v, i) => i === 0 ? `"${csvEsc(v)}"` : v).join(',');
    });
    download([h.join(','), ...body].join('\n'), 'smartlab-equipment-report.csv', 'text/csv');
  }

  function eqExportExcel() {
    const rows = state.equipment.filtered;
    if (!rows.length) return notify('No data to export');
    const now = new Date().toLocaleString('en-US', { timeZone:'Asia/Manila' });
    const h = eqHeaders();
    const dateInfo = eqHasRange ? ` | Range: ${qs('#eq-date-from')?.value} to ${qs('#eq-date-to')?.value}` : '';
    const title = eqHasRange ? 'SmartLab – Equipment Usage Report' : 'SmartLab – Equipment Inventory Report';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>table{border-collapse:collapse;width:100%;font-family:Arial;font-size:12px}
      th{background:#800000;color:#fff;font-weight:bold;text-align:center;padding:10px 8px;border:1px solid #333}
      td{padding:8px;border:1px solid #ddd;text-align:left}
      tr:nth-child(even){background:#f9f9f9}</style></head><body>
      <h3 style="text-align:center;font-family:Arial">${title}</h3>
      <p style="text-align:center;font-size:11px;color:#666">Generated: ${now} | Records: ${rows.length}${dateInfo}</p>
      <table><thead><tr>${h.map(c => `<th>${c.toUpperCase()}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(e => `<tr>${eqRowData(e).map(v => `<td>${escapeHtml(String(v))}</td>`).join('')}</tr>`).join('')}
      </tbody></table></body></html>`;
    download(html, 'smartlab-equipment-report.xls', 'application/vnd.ms-excel');
  }

  async function eqExportPDF(mode = 'save') {
    const rows = state.equipment.filtered;
    if (!rows.length) return notify('No data to export');
    const title = eqHasRange ? 'Equipment Usage Report' : 'Equipment Inventory Report';
    const dateInfo = eqHasRange ? `Range: ${qs('#eq-date-from')?.value} to ${qs('#eq-date-to')?.value}` : '';
    const columns = eqHeaders().map(h => h.toUpperCase());
    const body = rows.map(e => eqRowData(e));
    const bannerTitle = eqHasRange
      ? `Equipment Usage Report – ${qs('#eq-date-from')?.value || ''} to ${qs('#eq-date-to')?.value || ''}`
      : 'Equipment Inventory Report';
    const doc = await buildStyledReportPdf({ title, bannerTitle, columns, rows: body, orientation: 'portrait', subtitle: `Records: ${rows.length}${dateInfo ? ' | ' + dateInfo : ''}` });
    if (!doc) return notify('PDF library not loaded');
    if (mode === 'print') {
      doc.autoPrint();
      doc.output('dataurlnewwindow');
    } else {
      doc.save('smartlab-equipment-report.pdf');
    }
  }

  /* ============================================================
     CUSTOM TEMPLATE: Borrower's Log Sheet (legal, landscape)
  ============================================================ */
  function generateBorrowersLogTemplate() {
    if (typeof window.jspdf === 'undefined') return notify('PDF library not loaded');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [355.6, 215.9] }); // 35.56cm x 21.59cm

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = { top: 4.6, right: 2.5, bottom: 4.9, left: 2.5 }; // 0.46cm, 0.25cm, 0.49cm, 0.25cm
    const headerH = 30; // 0–3 cm
    const tableStartY = margin.top + headerH; // ~3.46 cm
    const tableH = 120; // 3–15 cm band
    const footerStartY = tableStartY + tableH + 5; // ~15.96 cm

    // Header band
    doc.setFillColor(240, 173, 104); // soft orange
    doc.rect(margin.left, margin.top, pageW - margin.left - margin.right, headerH, 'F');

    // Logo placeholder (left)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin.left + 4, margin.top + 4, 28, 28, 'S');
    doc.setFontSize(8); doc.text('LOGO', margin.left + 18, margin.top + 20, { align: 'center' });

    // Document code box (right)
    const codeBoxW = 32, codeBoxH = 16;
    const codeX = pageW - margin.right - codeBoxW - 4;
    const codeY = margin.top + 4;
    doc.rect(codeX, codeY, codeBoxW, codeBoxH);
    doc.setFontSize(8); doc.text('DOC CODE', codeX + codeBoxW / 2, codeY + 6, { align: 'center' });
    doc.text('REV. 1', codeX + codeBoxW / 2, codeY + 11, { align: 'center' });

    // Header texts
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text('REPUBLIC OF THE PHILIPPINES', margin.left + 36, margin.top + 10);
    doc.setFontSize(12);
    doc.text('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES', margin.left + 36, margin.top + 16);
    doc.setFontSize(10);
    doc.text('OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS', margin.left + 36, margin.top + 22);
    doc.text('COLLEGE OF COMPUTER AND INFORMATION SCIENCES', margin.left + 36, margin.top + 28);

    // Title centered on header band
    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text("Borrower's Log Sheet", pageW / 2, margin.top + headerH / 2 + 3, { align: 'center' });
    doc.setFont(undefined, 'normal');

    // Table
    const columns = ['DATE', 'ROOM', 'ITEM', 'NAME', 'YR & SEC.', 'FACULTY-IN-CHARGE', 'TIME IN', 'SIGNATURE', 'TIME OUT', 'SIGNATURE'];
    const body = Array.from({ length: 18 }, () => new Array(columns.length).fill(''));
    doc.autoTable({
      startY: tableStartY,
      head: [columns],
      body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, minCellHeight: 8 },
      headStyles: { fillColor: [240, 173, 104], textColor: 0, fontStyle: 'bold', halign: 'center' },
      columnStyles: columns.reduce((acc, _, idx) => { acc[idx] = { halign: 'center' }; return acc; }, {}),
      margin: { left: margin.left, right: margin.right, top: tableStartY, bottom: margin.bottom },
      tableWidth: pageW - margin.left - margin.right,
      willDrawCell: data => {
        // Stop after desired height to keep footer space
        if (data.row.section === 'body' && data.cursor.y > tableStartY + tableH) {
          data.cell.text = [''];
        }
      }
    });

    // Footer placeholders
    const footerY = Math.min(footerStartY, pageH - 40);
    doc.setFontSize(10);
    doc.text('Prepared by:', margin.left + 10, footerY);
    doc.text('Noted by:', pageW / 2 + 40, footerY);

    const lineY = footerY + 12;
    doc.line(margin.left + 10, lineY, margin.left + 70, lineY);
    doc.line(pageW / 2 + 40, lineY, pageW / 2 + 110, lineY);

    doc.setFontSize(9);
    doc.text('Laboratory Assistant', margin.left + 10, lineY + 8);
    doc.text('Head, CCIS Laboratory', pageW / 2 + 40, lineY + 8);

    // Bottom address band
    const addrY = pageH - margin.bottom - 12;
    doc.setFontSize(8);
    doc.text('PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016', margin.left, addrY);
    doc.text('Direct line: 335-1780 | Trunk Line: 335-1777 loc 000', margin.left, addrY + 4);
    doc.text('Website: www.pup.edu.ph | Email: issd@pup.edu.ph', margin.left, addrY + 8);

    doc.save('borrowers-log-template.pdf');
  }

  /* ============================================================
     EVENT BINDING (called from initReports on every SPA load)
  ============================================================ */
  function bindEvents() {
    // Requests tab
    qs('#req-export-csv')?.addEventListener('click', reqExportCSV);
    qs('#req-export-excel')?.addEventListener('click', reqExportExcel);
    qs('#req-export-pdf')?.addEventListener('click', () => reqExportPDF('save'));
    qs('#req-print')?.addEventListener('click', () => reqExportPDF('print'));
    qs('#req-clear-filters')?.addEventListener('click', clearRequestFilters);
    qs('#req-status-filter')?.addEventListener('change', applyRequestFilters);
    qs('#req-date-from')?.addEventListener('change', applyRequestFilters);
    qs('#req-date-to')?.addEventListener('change', applyRequestFilters);
    qs('#req-room-filter')?.addEventListener('change', applyRequestFilters);
    qs('#req-program-filter')?.addEventListener('change', applyRequestFilters);
    qs('#req-year-filter')?.addEventListener('change', applyRequestFilters);
    qs('#req-search')?.addEventListener('input', () => debounced('req', applyRequestFilters));

    // Schedule tab
    qs('#sched-export-csv')?.addEventListener('click', schedExportCSV);
    qs('#sched-export-excel')?.addEventListener('click', schedExportExcel);
    qs('#sched-export-pdf')?.addEventListener('click', () => schedExportPDF('save'));
    qs('#sched-print')?.addEventListener('click', () => schedExportPDF('print'));
    qs('#sched-clear-filters')?.addEventListener('click', clearScheduleFilters);
    qs('#sched-day-filter')?.addEventListener('change', applyScheduleFilters);
    qs('#sched-date-from')?.addEventListener('change', applyScheduleFilters);
    qs('#sched-date-to')?.addEventListener('change', applyScheduleFilters);
    qs('#sched-type-filter')?.addEventListener('change', applyScheduleFilters);
    qs('#sched-search')?.addEventListener('input', () => debounced('sched', applyScheduleFilters));

    // Equipment tab
    qs('#eq-export-csv')?.addEventListener('click', eqExportCSV);
    qs('#eq-export-excel')?.addEventListener('click', eqExportExcel);
    qs('#eq-export-pdf')?.addEventListener('click', () => eqExportPDF('save'));
    qs('#eq-print')?.addEventListener('click', () => eqExportPDF('print'));
    qs('#eq-clear-filters')?.addEventListener('click', clearEquipmentFilters);
    qs('#eq-date-from')?.addEventListener('change', onEquipmentDateChange);
    qs('#eq-date-to')?.addEventListener('change', onEquipmentDateChange);
    qs('#eq-search')?.addEventListener('input', () => debounced('eq', applyEquipmentFilters));
  }

  /* ============================================================
     INIT (called every time SPA navigates to Reports)
  ============================================================ */
  async function initReports() {
    // Reset state for fresh page load
    activeTab = 'requests';
    state = {
      requests: {
        all: [],
        filtered: [],
        roomFilter: '',
        programFilter: '',
        yearFilter: ''
      },
      schedule: {
        all: [],
        filtered: []
      },
      equipment: {
        all: [],
        filtered: []
      }
    };
    debounceTimers  = {};
    acFilter        = null;
    eqHasRange      = false;

    // Bind events to fresh DOM elements
    initTabs();
    bindEvents();

    if (typeof AcademicContextFilter !== 'undefined') {
      acFilter = new AcademicContextFilter({
        containerId: 'academic-context-filter',
        onChange: () => {
          // Reload all tabs that have been loaded
          loadRequestStats();
          loadRequestData();
          if (state.schedule.all.length) loadScheduleData();
          // Equipment is not academic-context dependent
        }
      });
      await acFilter.init();
    }

    // Load requests tab by default
    loadRequestStats();
    loadRequestData();
  }

  // Expose for SPA
  window.initReports = initReports;

  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminReports = {
    loadRequestData,
    loadScheduleData,
    loadEquipmentData,
    reqExportCSV,
    reqExportExcel,
    reqExportPDF,
    schedExportCSV,
    schedExportExcel,
    schedExportPDF,
    eqExportCSV,
    eqExportExcel,
    eqExportPDF
  };
})();
