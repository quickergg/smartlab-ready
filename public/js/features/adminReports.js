/* =========================================
   SmartLab – Admin: Reports/Print
   Populates reports table and handles printing
   Updated to match backend fields + safer status class + better fallbacks
   Enhanced with date range filtering, status filtering, and CSV/Excel export
========================================= */

(() => {
  const qs = (sel) => document.querySelector(sel);
  const exportPdfBtn = qs('#export-pdf-btn');
  const exportCsvBtn = qs('#export-csv-btn');
  const exportExcelBtn = qs('#export-excel-btn');
  const applyFiltersBtn = qs('#apply-filters-btn');
  const clearFiltersBtn = qs('#clear-filters-btn');
  const reportsTableBody = qs('#reports-table-body');

  let allReports = [];
  let filteredReports = [];
  let hasLoadedOnce = false;

  // Load reports data
  async function loadReports() {
    if (!reportsTableBody) return;

    // Optional: show loading state
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; color:#666;">
          Loading reports...
        </td>
      </tr>
    `;

    try {
      const res = await fetch('/api/reports', { headers: { 'Accept': 'application/json' } });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to load reports');

      allReports = Array.isArray(data) ? data : [];
      filteredReports = [...allReports];
      populateReportsTable(filteredReports);
      hasLoadedOnce = true;
    } catch (err) {
      console.error('Failed to load reports:', err);
      reportsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color:red;">
            Failed to load reports: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  // Apply filters
  function applyFilters() {
    const dateFrom = qs('#date-from-filter')?.value;
    const dateTo = qs('#date-to-filter')?.value;
    const statusFilter = qs('#status-filter')?.value;

    filteredReports = allReports.filter(report => {
      // Date range filter
      if (dateFrom && report.date) {
        const reportDate = new Date(report.date);
        const fromDate = new Date(dateFrom);
        if (reportDate < fromDate) return false;
      }

      if (dateTo && report.date) {
        const reportDate = new Date(report.date);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (reportDate > toDate) return false;
      }

      // Status filter
      if (statusFilter && report.status !== statusFilter) {
        return false;
      }

      return true;
    });

    populateReportsTable(filteredReports);
    console.log(`Applied filters: ${filteredReports.length} of ${allReports.length} reports shown`);
  }

  // Clear filters
  function clearFilters() {
    qs('#date-from-filter').value = '';
    qs('#date-to-filter').value = '';
    qs('#status-filter').value = '';
    
    filteredReports = [...allReports];
    populateReportsTable(filteredReports);
  }

  // Export to CSV
  function exportToCSV() {
    if (filteredReports.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Date', 'Room', 'Items', 'Name', 'Course & Year', 'Faculty In Charge', 'Time', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredReports.map(report => [
        formatDate(report.date),
        `"${escapeCsv(report.location || '')}"`,
        `"${escapeCsv(report.equipment_list || '')}"`,
        `"${escapeCsv(report.requester_name || '')}"`,
        `"${escapeCsv(report.course_year || '')}"`,
        `"${escapeCsv(report.faculty_in_charge || '')}"`,
        `"${formatTime(report.time_start, report.time_end)}"`,
        `"${escapeCsv(report.status || '')}"`
      ].join(','))
    ].join('\n');

    downloadFile(csvContent, 'reports.csv', 'text/csv');
  }

  // Export to PDF
  function exportToPDF() {
    if (filteredReports.length === 0) {
      alert('No data to export');
      return;
    }

    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
      alert('PDF library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Add custom font for better text rendering
    doc.setFont('helvetica');

    // Add title and metadata
    doc.setFontSize(18);
    doc.setTextColor(102, 126, 234); // Purple color
    doc.text('SmartLab Equipment Borrowing Reports', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()} | Total Records: ${filteredReports.length}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

    // Prepare table data
    const tableData = filteredReports.map(report => [
      formatDate(report.date),
      report.location || 'N/A',
      report.equipment_list || 'N/A',
      report.requester_name || 'N/A',
      report.course_year || 'N/A',
      report.faculty_in_charge || 'N/A',
      formatTime(report.time_start, report.time_end),
      report.status || 'N/A'
    ]);

    // Define table columns
    const tableColumns = [
      { header: 'DATE', dataKey: 'date' },
      { header: 'ROOM', dataKey: 'location' },
      { header: 'ITEM/S', dataKey: 'equipment' },
      { header: 'NAME', dataKey: 'requester' },
      { header: 'COURSE & YEAR', dataKey: 'course' },
      { header: 'FACULTY-IN-CHARGE', dataKey: 'faculty' },
      { header: 'TIME', dataKey: 'time' },
      { header: 'STATUS', dataKey: 'status' }
    ];

    // Convert to format expected by autoTable
    const autoTableData = tableData.map(row => ({
      date: row[0],
      location: row[1],
      equipment: row[2],
      requester: row[3],
      course: row[4],
      faculty: row[5],
      time: row[6],
      status: row[7]
    }));

    // Add the table using autoTable plugin
    doc.autoTable({
      head: [tableColumns.map(col => col.header)],
      body: autoTableData.map(row => tableColumns.map(col => row[col.dataKey])),
      startY: 35,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' }, // Date
        1: { cellWidth: 30, halign: 'center' }, // Room
        2: { cellWidth: 40 }, // Items
        3: { cellWidth: 35 }, // Name
        4: { cellWidth: 30 }, // Course & Year
        5: { cellWidth: 35 }, // Faculty
        6: { cellWidth: 30, halign: 'center' }, // Time
        7: { cellWidth: 25, halign: 'center' }  // Status
      },
      didDrawCell: function(data) {
        // Color code status cells
        if (data.column.index === 7 && data.cell.section === 'body') {
          const status = data.cell.raw.toLowerCase();
          let fillColor;
          
          switch(status) {
            case 'pending':
              fillColor = [255, 243, 205]; // Yellow
              break;
            case 'approved':
              fillColor = [212, 237, 218]; // Green
              break;
            case 'declined':
              fillColor = [248, 215, 218]; // Red
              break;
            case 'cancelled':
              fillColor = [226, 227, 229]; // Gray
              break;
            case 'returned':
              fillColor = [204, 229, 255]; // Blue
              break;
            default:
              fillColor = [255, 255, 255]; // White
          }
          
          doc.setFillColor(...fillColor);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          
          // Redraw text
          doc.setTextColor(status === 'pending' || status === 'declined' ? 133 : status === 'cancelled' ? 56 : status === 'returned' ? 0 : 21);
          doc.text(data.cell.text, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, { align: 'center', baseline: 'middle' });
        }
      },
      margin: { top: 35, right: 10, bottom: 20, left: 10 }
    });

    // Add footer
    const finalY = doc.lastAutoTable.finalY || 200;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('SmartLab Equipment Borrowing System - Automated Report Generation', doc.internal.pageSize.getWidth() / 2, finalY + 10, { align: 'center' });

    // Save the PDF
    doc.save('smartlab-reports.pdf');
  }
  function exportToExcel() {
    if (filteredReports.length === 0) {
      alert('No data to export');
      return;
    }

    // Create enhanced HTML table for Excel with styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          table {
            border-collapse: collapse;
            width: 100%;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }
          th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
            text-align: center;
            padding: 12px 8px;
            border: 1px solid #333;
            white-space: nowrap;
          }
          td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
            vertical-align: top;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .status-pending { background-color: #fff3cd; color: #856404; font-weight: bold; }
          .status-approved { background-color: #d4edda; color: #155724; font-weight: bold; }
          .status-declined { background-color: #f8d7da; color: #721c24; font-weight: bold; }
          .status-cancelled { background-color: #e2e3e5; color: #383d41; font-weight: bold; }
          .status-returned { background-color: #cce5ff; color: #004085; font-weight: bold; }
          .header-row {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            padding: 15px;
          }
          .date-cell { 
            text-align: center; 
            font-weight: 500;
            min-width: 100px;
          }
          .time-cell { 
            text-align: center; 
            font-weight: 500;
            min-width: 120px;
          }
          .name-cell {
            font-weight: 500;
            min-width: 150px;
          }
          .equipment-cell {
            max-width: 200px;
            word-wrap: break-word;
          }
          @page {
            margin: 0.5in;
            orientation: landscape;
          }
        </style>
      </head>
      <body>
        <div class="header-row">
          SmartLab Equipment Borrowing Reports<br>
          <small>Generated: ${new Date().toLocaleString()} | Total Records: ${filteredReports.length}</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>DATE</th>
              <th>ROOM</th>
              <th>ITEM/S</th>
              <th>NAME</th>
              <th>COURSE & YEAR</th>
              <th>FACULTY-IN-CHARGE</th>
              <th>TIME</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${filteredReports.map((report, index) => {
              const statusClass = `status-${(report.status || '').toLowerCase().replace(/\s+/g, '-')}`;
              return `
            <tr>
              <td class="date-cell">${formatDate(report.date)}</td>
              <td>${escapeHtml(report.location || 'N/A')}</td>
              <td class="equipment-cell">${escapeHtml(report.equipment_list || 'N/A')}</td>
              <td class="name-cell">${escapeHtml(report.requester_name || 'N/A')}</td>
              <td>${escapeHtml(report.course_year || 'N/A')}</td>
              <td class="name-cell">${escapeHtml(report.faculty_in_charge || 'N/A')}</td>
              <td class="time-cell">${formatTime(report.time_start, report.time_end)}</td>
              <td class="${statusClass}">${escapeHtml(report.status || 'N/A')}</td>
            </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: center; color: #666; font-size: 11px;">
          <small>SmartLab Equipment Borrowing System - Automated Report Generation</small>
        </div>
      </body>
      </html>
    `;

    downloadFile(htmlContent, 'smartlab-reports.xls', 'application/vnd.ms-excel');
  }

  // Download file helper
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Escape CSV values
  function escapeCsv(value) {
    return String(value || '').replace(/"/g, '""');
  }

  // Populate reports table
  function populateReportsTable(reports) {
    if (!reportsTableBody) return;

    if (!reports || reports.length === 0) {
      reportsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color:#666;">
            No reports available
          </td>
        </tr>
      `;
      return;
    }

    reportsTableBody.innerHTML = reports.map((report) => {
      const date = formatDate(report.date);
      const location = report.location || 'N/A';
      const equipment = report.equipment_list || 'N/A';
      const requester = report.requester_name || 'N/A';
      const courseYear = report.course_year || 'N/A';
      const faculty = report.faculty_in_charge || 'N/A';
      const time = formatTime(report.time_start, report.time_end);
      const status = report.status || 'Unknown';

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(location)}</td>
          <td>${escapeHtml(equipment)}</td>
          <td>${escapeHtml(requester)}</td>
          <td>${escapeHtml(courseYear)}</td>
          <td>${escapeHtml(faculty)}</td>
          <td>${escapeHtml(time)}</td>
          <td>
            <span class="status-badge status-${slugifyStatus(status)}">
              ${escapeHtml(status)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Format date for display
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Format time range for display
  function formatTime(startTime, endTime) {
    if (!startTime && !endTime) return 'N/A';
    if (!startTime) return trimTime(endTime) || 'N/A';
    if (!endTime) return trimTime(startTime) || 'N/A';

    const start = trimTime(startTime);
    const end = trimTime(endTime);

    if (!start && !end) return 'N/A';
    if (!start) return end;
    if (!end) return start;

    return `${start} - ${end}`;
  }

  function trimTime(t) {
    if (!t) return '';
    // supports "HH:MM:SS" or "HH:MM"
    return String(t).substring(0, 5);
  }

  // Safer status slug for CSS class usage
  function slugifyStatus(status) {
    return String(status || 'unknown')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  }

  // Basic HTML escape to avoid injecting untrusted data into the DOM
  function escapeHtml(input) {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Export functionality
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportToCSV);
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }

  // Filter functionality
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyFilters);
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearFilters);
  }

  // Add Enter key support for date inputs
  qs('#date-from-filter')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
  });

  qs('#date-to-filter')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
  });

  qs('#status-filter')?.addEventListener('change', applyFilters);

  // Initialize reports when tab is shown
  const reportsTab = qs('#tab-reports');
  if (reportsTab) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' &&
            mutation.attributeName === 'class' &&
            !reportsTab.classList.contains('hidden')) {
          loadReports();
        }
      }
    });

    observer.observe(reportsTab, { attributes: true });
  }

  // Export functions
  window.SmartLab = window.SmartLab || {};
  window.SmartLab.AdminReports = {
    loadReports,
    populateReportsTable,
    formatDate,
    formatTime,
    applyFilters,
    clearFilters,
    exportToCSV,
    exportToExcel,
    exportToPDF
  };
})();
