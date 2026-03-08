/* =========================================
   SmartLab - Print Reports Component
   Reusable report printing functionality
========================================= */

class PrintReports {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            logoPath: '/images/PUPLogo.png',
            title: 'SmartLab Report',
            ...options
        };
        
        this.init();
    }
    
    init() {
        // Component is ready for use
    }
    
    // PUP Header Template with actual logo
    getPUPHeader() {
        return `
            <div class="header">
                <img src="${this.options.logoPath}" alt="PUP Logo" class="header-logo" />
                <div class="header-text">
                    <h1>Republic of the Philippines</h1>
                    <h2>Polytechnic University of the Philippines</h2>
                    <h3>Office of the Vice President for Academic Affairs</h3>
                    <h4>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</h4>
                </div>
            </div>
        `;
    }
    
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
                }
                
                .header-text h1 {
                    font-size: 14pt;
                    font-weight: bold;
                    margin-bottom: 2px;
                }
                
                .header-text h2 {
                    font-size: 16pt;
                    font-weight: bold;
                    margin-bottom: 2px;
                }
                
                .header-text h3 {
                    font-size: 12pt;
                    margin-bottom: 2px;
                }
                
                .header-text h4 {
                    font-size: 11pt;
                    font-weight: bold;
                }
                
                .report-title {
                    text-align: center;
                    font-size: 18pt;
                    font-weight: bold;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                }
                
                .report-info {
                    margin-bottom: 20px;
                    font-size: 10pt;
                }
                
                .report-info-row {
                    display: flex;
                    margin-bottom: 5px;
                }
                
                .report-info-label {
                    font-weight: bold;
                    width: 100px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 10pt;
                }
                
                th, td {
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: left;
                }
                
                th {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }
                
                .summary-section {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #000;
                }
                
                .summary-title {
                    font-size: 14pt;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                
                .summary-stats {
                    display: flex;
                    gap: 30px;
                    margin-bottom: 20px;
                }
                
                .stat-item {
                    text-align: center;
                }
                
                .stat-value {
                    font-size: 16pt;
                    font-weight: bold;
                }
                
                .stat-label {
                    font-size: 10pt;
                }
                
                @media print {
                    body {
                        padding: 10mm;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        `;
    }
    
    // Print usage reports
    async printUsageReports(tableSelector, title = 'Equipment Usage Report') {
        try {
            const table = document.querySelector(tableSelector);
            if (!table) {
                SmartLab.Core.UI.showToast('Table not found', 'error');
                return;
            }
            
            // Clone table to avoid modifying original
            const tableClone = table.cloneNode(true);
            
            // Remove action columns
            const actionColumns = tableClone.querySelectorAll('td:last-child, th:last-child');
            actionColumns.forEach(col => col.remove());
            
            // Generate report HTML
            const reportHTML = this.generateReportHTML(title, tableClone.outerHTML);
            
            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(reportHTML);
            printWindow.document.close();
            
            // Wait for content to load, then print
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
            
        } catch (error) {
            console.error('Error printing reports:', error);
            SmartLab.Core.UI.showToast('Failed to print reports', 'error');
        }
    }
    
    // Print user reports
    async printUserReports(users, title = 'User Management Report') {
        try {
            const tableHTML = this.generateUserTable(users);
            const reportHTML = this.generateReportHTML(title, tableHTML);
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(reportHTML);
            printWindow.document.close();
            
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
            
        } catch (error) {
            console.error('Error printing user reports:', error);
            SmartLab.Core.UI.showToast('Failed to print reports', 'error');
        }
    }
    
    // Print request reports
    async printRequestReports(requests, title = 'Borrow Request Report') {
        try {
            const tableHTML = this.generateRequestTable(requests);
            const reportHTML = this.generateReportHTML(title, tableHTML);
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(reportHTML);
            printWindow.document.close();
            
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
            
        } catch (error) {
            console.error('Error printing request reports:', error);
            SmartLab.Core.UI.showToast('Failed to print reports', 'error');
        }
    }
    
    // Generate report HTML
    generateReportHTML(title, content) {
        const currentDate = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila' });
        const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                ${this.getPrintStyles()}
            </head>
            <body>
                ${this.getPUPHeader()}
                
                <div class="report-title">${title}</div>
                
                <div class="report-info">
                    <div class="report-info-row">
                        <span class="report-info-label">Date:</span>
                        <span>${currentDate}</span>
                    </div>
                    <div class="report-info-row">
                        <span class="report-info-label">Time:</span>
                        <span>${currentTime}</span>
                    </div>
                    <div class="report-info-row">
                        <span class="report-info-label">Generated by:</span>
                        <span>${this.getCurrentUser()}</span>
                    </div>
                </div>
                
                ${content}
                
                <div class="summary-section">
                    <div class="summary-title">Report Summary</div>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <div class="stat-value">${this.getRecordCount(content)}</div>
                            <div class="stat-label">Total Records</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${currentDate}</div>
                            <div class="stat-label">Report Date</div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 50px; font-size: 10pt;">
                    <p>This is a system-generated report. No signature required.</p>
                </div>
            </body>
            </html>
        `;
    }
    
    // Generate user table HTML
    generateUserTable(users) {
        if (!users || users.length === 0) {
            return '<p>No users found.</p>';
        }
        
        const rows = users.map(user => `
            <tr>
                <td>${user.user_id || ''}</td>
                <td>${user.full_name || '—'}</td>
                <td>${user.gmail || ''}</td>
                <td>${user.role_name || ''}</td>
                <td>${user.status_name || ''}</td>
                <td>${user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'Never'}</td>
            </tr>
        `).join('');
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Active</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }
    
    // Generate request table HTML
    generateRequestTable(requests) {
        if (!requests || requests.length === 0) {
            return '<p>No requests found.</p>';
        }
        
        const rows = requests.map(request => `
            <tr>
                <td>${request.request_id || ''}</td>
                <td>${request.subject || ''}</td>
                <td>${request.program || ''} - ${request.year_level || ''}</td>
                <td>${request.date_needed || ''}</td>
                <td>${request.lab_room || ''}</td>
                <td>${request.status_name || ''}</td>
                <td>${request.requested_by || ''}</td>
            </tr>
        `).join('');
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>Request ID</th>
                        <th>Subject</th>
                        <th>Program/Year</th>
                        <th>Date Needed</th>
                        <th>Lab Room</th>
                        <th>Status</th>
                        <th>Requested By</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }
    
    // Helper methods
    getCurrentUser() {
        const user = SmartLab.Core.Auth.getCurrentUser();
        return user.fullName || user.email || 'System';
    }
    
    getRecordCount(content) {
        const tbodyMatch = content.match(/<tbody>(.*?)<\/tbody>/s);
        if (tbodyMatch) {
            const trMatches = tbodyMatch[1].match(/<tr>/g);
            return trMatches ? trMatches.length : 0;
        }
        return 0;
    }
    
    // Static method for quick printing
    static print(tableSelector, title, options = {}) {
        const printer = new PrintReports(null, options);
        return printer.printUsageReports(tableSelector, title);
    }
    
    // Static method for user reports
    static printUsers(users, title, options = {}) {
        const printer = new PrintReports(null, options);
        return printer.printUserReports(users, title);
    }
    
    // Static method for request reports
    static printRequests(requests, title, options = {}) {
        const printer = new PrintReports(null, options);
        return printer.printRequestReports(requests, title);
    }
}

// Register component with SmartLab Core
SmartLab.Core.Components.register('PrintReports', PrintReports);

// Auto-initialize print reports
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-component="PrintReports"]').forEach(element => {
        const printer = SmartLab.Core.Components.create('PrintReports', element);
        if (printer) {
            printer.init();
        }
    });
});

// Global access for backward compatibility
window.PrintReports = PrintReports;
