// =========================================================
// PRINT REPORTS MODULE
// =========================================================

const PrintReports = {
  
  // PUP Header Template with actual logo
  getPUPHeader() {
    return `
      <div class="header">
        <img src="images/PUPLogo.png" alt="PUP Logo" class="header-logo" />
        <div class="header-text">
          <h1>Republic of the Philippines</h1>
          <h2>Polytechnic University of the Philippines</h2>
          <h3>Office of the Vice President for Academic Affairs</h3>
          <h4>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</h4>
        </div>
      </div>
    `;
  },

  // Print Styles
  getPrintStyles() {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', sans-serif;
          padding: 20mm;
          color: #333;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px solid #8B0000;
        }

        .header-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .header-text {
          flex: 1;
        }

        .header-text h1 {
          font-size: 14px;
          font-weight: normal;
          color: #8B0000;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-text h2 {
          font-size: 18px;
          font-weight: bold;
          color: #8B0000;
          margin-bottom: 2px;
        }

        .header-text h3 {
          font-size: 12px;
          font-weight: normal;
          color: #333;
          margin-bottom: 8px;
        }

        .header-text h4 {
          font-size: 16px;
          font-weight: bold;
          color: #8B0000;
        }

        .report-info {
          margin-bottom: 20px;
          text-align: center;
        }

        .report-info h5 {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
          color: #8B0000;
        }

        .report-info p {
          font-size: 12px;
          color: #666;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }

        thead {
          background-color: #8B0000;
          color: white;
        }

        th {
          padding: 12px 8px;
          text-align: left;
          font-size: 11px;
          font-weight: bold;
          border: 1px solid #8B0000;
        }

        td {
          padding: 10px 8px;
          font-size: 10px;
          border: 1px solid #ddd;
        }

        tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }

        tbody tr:hover {
          background-color: #f0f0f0;
        }

        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 10px;
          color: #666;
          text-align: center;
        }

        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 50px;
          padding: 0 40px;
        }

        .signature-block {
          text-align: center;
          flex: 1;
        }

        .signature-line {
          border-top: 1px solid #333;
          margin-top: 40px;
          padding-top: 5px;
          font-size: 11px;
          font-weight: bold;
        }

        .signature-label {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }

        @media print {
          body {
            padding: 10mm;
          }
          
          @page {
            margin: 15mm;
          }
        }
      </style>
    `;
  },

  // Get current date formatted
  getCurrentDate() {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Convert image to base64 (for reliable printing)
  async getImageAsBase64(imagePath) {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image:', error);
      return imagePath; // Fallback to original path
    }
  },

  // Print Usage Reports
  async printUsageReports(tableBodySelector) {
    const tableBody = document.querySelector(tableBodySelector);
    if (!tableBody) {
      alert('No data to print');
      return;
    }

    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    if (rows.length === 0) {
      alert('No data to print');
      return;
    }

    // Convert logo to base64 for reliable printing
    const logoBase64 = await this.getImageAsBase64('images/PUPLogo.png');

    // Generate table rows HTML
    const tableRows = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      return `
        <tr>
          <td>${cells[0]?.innerText || '-'}</td>
          <td>${cells[1]?.innerText || '-'}</td>
          <td>${cells[2]?.innerText || '-'}</td>
          <td>${cells[3]?.innerText || '-'}</td>
          <td>${cells[4]?.innerText || '-'}</td>
          <td>${cells[5]?.innerText || '-'}</td>
          <td>${cells[6]?.innerText || '-'}</td>
          <td>${cells[7]?.innerText || '-'}</td>
        </tr>
      `;
    }).join('');

    const currentDate = this.getCurrentDate();

    // Create print window content
    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Laboratory Reports - ${currentDate}</title>
        ${this.getPrintStyles()}
      </head>
      <body>
        <div class="header">
          <img src="${logoBase64}" alt="PUP Logo" class="header-logo" />
          <div class="header-text">
            <h1>Republic of the Philippines</h1>
            <h2>Polytechnic University of the Philippines</h2>
            <h3>Office of the Vice President for Academic Affairs</h3>
            <h4>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</h4>
          </div>
        </div>

        <div class="report-info">
          <h5>Smart Laboratory System - Usage Reports</h5>
          <p>Generated on: ${currentDate}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Item</th>
              <th>Type</th>
              <th>Date</th>
              <th>Faculty-In-Charge</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-block">
            <div class="signature-line">_________________________</div>
            <div class="signature-label">Prepared by</div>
          </div>
          <div class="signature-block">
            <div class="signature-line">_________________________</div>
            <div class="signature-label">Verified by</div>
          </div>
          <div class="signature-block">
            <div class="signature-line">_________________________</div>
            <div class="signature-label">Approved by</div>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated report from the Smart Laboratory System</p>
          <p>Polytechnic University of the Philippines - College of Computer and Information Sciences</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      alert('Please allow pop-ups to print reports');
    }
  },

  // Add more print methods here (equipment reports, schedule reports, etc.)
  printEquipmentReport(tableBodySelector) {
    // Future implementation
  },

  printScheduleReport(tableBodySelector) {
    // Future implementation
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrintReports;
}