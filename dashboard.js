/* =================================================================
   Purview Audit Report Dashboard - Alpine.js Application
   ================================================================= */

// Global Alpine store for application state
document.addEventListener('alpine:init', () => {

    // ===== MAIN DATA STORE =====
    Alpine.store('dashboard', {
        // Data
        reportData: null,
        rawData: [],
        charts: {},

        // UI State
        loading: true,
        currentTab: 'summary',
        siteDetailIndex: null,
        userDetailIndex: null,

        // Modal State
        modalOpen: false,
        modalTitle: '',
        modalUsers: [],

        // Initialize dashboard
        init() {
            console.log('Dashboard initialized');
        },

        // Handle file selection
        handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.showLoadingMessage('Parsing CSV file...', 'This may take a moment for large files');

            Papa.parse(file, {
                header: true,
                dynamicTyping: false,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        this.rawData = results.data;
                        this.showLoadingMessage(`Analyzing ${this.rawData.length.toLocaleString()} operations...`, '');

                        setTimeout(() => {
                            try {
                                this.reportData = this.analyzeData(this.rawData);
                                this.loading = false;
                                this.initializeCharts();
                            } catch (error) {
                                this.showError('Analysis Error', error.message);
                            }
                        }, 100);
                    } catch (error) {
                        this.showError('CSV Parsing Error', error.message);
                    }
                },
                error: (error) => {
                    this.showError('File Read Error', error.message);
                }
            });
        },

        // Show loading message
        showLoadingMessage(message, submessage) {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.innerHTML = `
                <div class="loading-spinner"></div>
                <p>${message}</p>
                ${submessage ? `<p class="loading-note">${submessage}</p>` : ''}
            `;
        },

        // Show error
        showError(title, message) {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.innerHTML = `
                <div style="color: var(--danger-color); padding: 40px; text-align: center;">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <p style="margin-top: 20px; color: var(--text-secondary);">
                        Make sure you selected the correct CSV file from parse_purview_audit_log.py
                    </p>
                    <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;">
                        Try Again
                    </button>
                </div>
            `;
        },

        // Analyze CSV data
        analyzeData(data) {
            console.log('Analyzing', data.length, 'records...');

            const siteData = {};
            const userData = {};
            const accessTypeData = {};
            const applicationData = {};
            const dailyOps = {};
            const fileTypes = {};

            let totalOps = 0;
            const allFiles = new Set();
            const allDates = [];

            data.forEach((row, index) => {
                if (!row.user_id || !row.operation) return;

                totalOps++;

                const fileName = row.file_name || 'Unknown';
                const fileExt = row.file_extension || '';
                const filePath = row.file_path || '';
                const userId = row.user_id;
                const operation = row.operation;
                const timestamp = row.timestamp || '';
                const application = row.application || 'Unknown';
                const siteUrl = row.site_url || 'Unknown';

                const fileKey = `${filePath}/${fileName}`;
                allFiles.add(fileKey);

                if (fileExt) fileTypes[fileExt] = (fileTypes[fileExt] || 0) + 1;

                if (timestamp) {
                    const cleanTimestamp = timestamp.trim();
                    const date = cleanTimestamp.split('T')[0];
                    const dateObj = new Date(cleanTimestamp);
                    if (!isNaN(dateObj.getTime())) {
                        allDates.push(dateObj);
                        dailyOps[date] = (dailyOps[date] || 0) + 1;
                    }
                }

                // Site data
                if (!siteData[siteUrl]) {
                    siteData[siteUrl] = {
                        operations: 0,
                        users: new Set(),
                        files: new Set(),
                        accessTypes: {},
                        applications: {},
                        fileTypes: {},
                        records: []
                    };
                }
                siteData[siteUrl].operations++;
                siteData[siteUrl].users.add(userId);
                siteData[siteUrl].files.add(fileKey);
                siteData[siteUrl].accessTypes[operation] = (siteData[siteUrl].accessTypes[operation] || 0) + 1;
                siteData[siteUrl].applications[application] = (siteData[siteUrl].applications[application] || 0) + 1;
                if (fileExt) siteData[siteUrl].fileTypes[fileExt] = (siteData[siteUrl].fileTypes[fileExt] || 0) + 1;
                siteData[siteUrl].records.push(row);

                // User data
                if (!userData[userId]) {
                    userData[userId] = {
                        operations: 0,
                        sites: new Set(),
                        files: new Set(),
                        accessTypes: {},
                        applications: {},
                        records: []
                    };
                }
                userData[userId].operations++;
                userData[userId].sites.add(siteUrl);
                userData[userId].files.add(fileKey);
                userData[userId].accessTypes[operation] = (userData[userId].accessTypes[operation] || 0) + 1;
                userData[userId].applications[application] = (userData[userId].applications[application] || 0) + 1;
                userData[userId].records.push(row);

                // Access type data
                if (!accessTypeData[operation]) {
                    accessTypeData[operation] = {
                        count: 0,
                        users: new Set(),
                        sites: new Set(),
                        applications: {}
                    };
                }
                accessTypeData[operation].count++;
                accessTypeData[operation].users.add(userId);
                accessTypeData[operation].sites.add(siteUrl);
                accessTypeData[operation].applications[application] =
                    (accessTypeData[operation].applications[application] || 0) + 1;

                // Application data
                if (!applicationData[application]) {
                    applicationData[application] = {
                        count: 0,
                        accessTypes: {},
                        users: new Set(),
                        sites: new Set()
                    };
                }
                applicationData[application].count++;
                applicationData[application].accessTypes[operation] =
                    (applicationData[application].accessTypes[operation] || 0) + 1;
                applicationData[application].users.add(userId);
                applicationData[application].sites.add(siteUrl);
            });

            // Convert to arrays and sort
            const siteActivity = Object.entries(siteData).map(([url, data]) => {
                const userCounts = {};
                data.records.forEach(r => {
                    userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1;
                });
                const topUsers = Object.entries(userCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([user, count]) => ({ user, operations: count }));

                const fileCounts = {};
                data.records.forEach(r => {
                    const key = `${r.file_path}/${r.file_name}`;
                    fileCounts[key] = (fileCounts[key] || 0) + 1;
                });
                const topFiles = Object.entries(fileCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([file, count]) => ({ file, operations: count }));

                return {
                    site_url: url,
                    total_operations: data.operations,
                    unique_users: data.users.size,
                    unique_files: data.files.size,
                    access_types: Object.entries(data.accessTypes)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => ({ type, count })),
                    applications: Object.entries(data.applications)
                        .sort((a, b) => b[1] - a[1])
                        .map(([app, count]) => ({ app, count })),
                    file_types: Object.entries(data.fileTypes)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => ({ type, count })),
                    top_users: topUsers,
                    top_files: topFiles,
                    file_details: data.records
                };
            }).sort((a, b) => b.total_operations - a.total_operations);

            const userActivity = Object.entries(userData).map(([userId, data]) => {
                const siteCounts = {};
                data.records.forEach(r => {
                    siteCounts[r.site_url] = (siteCounts[r.site_url] || 0) + 1;
                });
                const topSites = Object.entries(siteCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([site, count]) => ({ site, operations: count }));

                const fileCounts = {};
                data.records.forEach(r => {
                    const key = `${r.file_path}/${r.file_name}`;
                    fileCounts[key] = (fileCounts[key] || 0) + 1;
                });
                const topFiles = Object.entries(fileCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([file, count]) => ({ file, operations: count }));

                return {
                    user_id: userId,
                    total_operations: data.operations,
                    unique_sites: data.sites.size,
                    unique_files: data.files.size,
                    access_types: Object.entries(data.accessTypes)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => ({ type, count })),
                    applications: Object.entries(data.applications)
                        .sort((a, b) => b[1] - a[1])
                        .map(([app, count]) => ({ app, count })),
                    top_sites: topSites,
                    top_files: topFiles,
                    file_details: data.records
                };
            }).sort((a, b) => b.total_operations - a.total_operations);

            const accessTypes = Object.entries(accessTypeData).map(([type, data]) => ({
                type,
                count: data.count,
                unique_users: data.users.size,
                unique_sites: data.sites.size,
                applications: Object.entries(data.applications)
                    .sort((a, b) => b[1] - a[1])
                    .map(([app, count]) => ({ app, count }))
            })).sort((a, b) => b.count - a.count);

            const applications = Object.entries(applicationData).map(([app, data]) => ({
                application: app,
                count: data.count,
                unique_users: data.users.size,
                unique_sites: data.sites.size,
                access_types: Object.entries(data.accessTypes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => ({ type, count }))
            })).sort((a, b) => b.count - a.count);

            const sortedDates = allDates.sort((a, b) => a - b);
            const dateRange = {
                start: sortedDates.length > 0 ? sortedDates[0].toISOString() : 'Unknown',
                end: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].toISOString() : 'Unknown',
                days: sortedDates.length > 0 ?
                    Math.ceil((sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24)) + 1 : 0
            };

            return {
                metadata: {
                    generated_at: new Date().toISOString(),
                    source_file: 'CSV',
                    total_operations: totalOps,
                    unique_users: Object.keys(userData).length,
                    unique_sites: Object.keys(siteData).length,
                    unique_files: allFiles.size,
                    date_range: dateRange
                },
                executive_summary: {
                    top_sites: siteActivity.slice(0, 10).map(s => ({
                        site: s.site_url,
                        operations: s.total_operations
                    })),
                    top_users: userActivity.slice(0, 10).map(u => ({
                        user: u.user_id,
                        operations: u.total_operations
                    })),
                    access_type_distribution: accessTypes,
                    file_type_distribution: Object.entries(fileTypes)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 15)
                        .map(([type, count]) => ({ type, count }))
                },
                site_activity: siteActivity,
                user_activity: userActivity,
                access_types: accessTypes,
                applications: applications,
                daily_operations: Object.entries(dailyOps)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, count]) => ({ date, count }))
            };
        },

        // Initialize charts
        initializeCharts() {
            // Wait for Alpine to render the dashboard before creating charts
            setTimeout(() => {
                this.createTopSitesChart();
                this.createTopUsersChart();
                this.createAccessTypeChart();
                this.createFileTypeChart();
                this.createTimelineChart();
            }, 100);
        },

        // Create charts (these will be called after DOM is ready)
        createTopSitesChart() {
            const ctx = document.getElementById('topSitesChart')?.getContext('2d');
            if (!ctx) return;

            const data = this.reportData.executive_summary.top_sites.slice(0, 10);

            if (this.charts.topSites) this.charts.topSites.destroy();

            this.charts.topSites = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => this.extractSiteName(d.site)),
                    datasets: [{
                        label: 'Operations',
                        data: data.map(d => d.operations),
                        backgroundColor: 'rgba(0, 120, 212, 0.8)',
                        borderColor: 'rgba(0, 120, 212, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        },

        createTopUsersChart() {
            const ctx = document.getElementById('topUsersChart')?.getContext('2d');
            if (!ctx) return;

            const data = this.reportData.executive_summary.top_users.slice(0, 10);

            if (this.charts.topUsers) this.charts.topUsers.destroy();

            this.charts.topUsers = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.user.split('@')[0]),
                    datasets: [{
                        label: 'Operations',
                        data: data.map(d => d.operations),
                        backgroundColor: 'rgba(16, 124, 16, 0.8)',
                        borderColor: 'rgba(16, 124, 16, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        },

        createAccessTypeChart() {
            const ctx = document.getElementById('accessTypeChart')?.getContext('2d');
            if (!ctx) return;

            const data = this.reportData.executive_summary.access_type_distribution.slice(0, 8);

            if (this.charts.accessType) this.charts.accessType.destroy();

            this.charts.accessType = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(d => d.type),
                    datasets: [{
                        data: data.map(d => d.count),
                        backgroundColor: [
                            'rgba(0, 120, 212, 0.8)',
                            'rgba(16, 124, 16, 0.8)',
                            'rgba(255, 140, 0, 0.8)',
                            'rgba(216, 59, 1, 0.8)',
                            'rgba(80, 230, 255, 0.8)',
                            'rgba(185, 0, 185, 0.8)',
                            'rgba(255, 185, 0, 0.8)',
                            'rgba(0, 178, 148, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });
        },

        createFileTypeChart() {
            const ctx = document.getElementById('fileTypeChart')?.getContext('2d');
            if (!ctx) return;

            const data = this.reportData.executive_summary.file_type_distribution.slice(0, 10);

            if (this.charts.fileType) this.charts.fileType.destroy();

            this.charts.fileType = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.type.toUpperCase() || 'Unknown'),
                    datasets: [{
                        label: 'Count',
                        data: data.map(d => d.count),
                        backgroundColor: 'rgba(255, 140, 0, 0.8)',
                        borderColor: 'rgba(255, 140, 0, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        },

        createTimelineChart() {
            const ctx = document.getElementById('timelineChart')?.getContext('2d');
            if (!ctx) return;

            const data = this.reportData.daily_operations;

            if (this.charts.timeline) this.charts.timeline.destroy();

            this.charts.timeline = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => this.formatDate(d.date)),
                    datasets: [{
                        label: 'Daily Operations',
                        data: data.map(d => d.count),
                        borderColor: 'rgba(0, 120, 212, 1)',
                        backgroundColor: 'rgba(0, 120, 212, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        },

        // Tab navigation
        showTab(tabName) {
            this.currentTab = tabName;
        },

        // Site drill-down
        showSiteDetail(index) {
            this.siteDetailIndex = index;
        },

        closeSiteDetail() {
            this.siteDetailIndex = null;
        },

        // User drill-down
        showUserDetail(index) {
            this.userDetailIndex = index;
        },

        closeUserDetail() {
            this.userDetailIndex = null;
        },

        // Modal handling
        showUsersModal(users, title) {
            this.modalUsers = users;
            this.modalTitle = title;
            this.modalOpen = true;
        },

        closeModal() {
            this.modalOpen = false;
        },

        // Utility functions
        formatNumber(num) {
            return num.toLocaleString();
        },

        formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr.trim());
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        },

        extractSiteName(url) {
            if (!url || url === 'Unknown') return 'Unknown';

            try {
                const urlObj = new URL(url);
                const parts = urlObj.pathname.split('/').filter(p => p);

                if (urlObj.hostname.includes('-my.sharepoint.com')) {
                    const user = parts[parts.length - 1] || 'OneDrive';
                    return `OneDrive (${user})`;
                } else if (parts.length > 1 && parts[0] === 'sites') {
                    return parts[1];
                } else {
                    return urlObj.hostname.split('.')[0];
                }
            } catch {
                return url.substring(0, 50) + '...';
            }
        }
    });

    // ===== FILE TREE COMPONENT =====
    Alpine.data('fileTree', (files, fileDetails) => ({
        tree: {},
        expandedNodes: new Set(),

        init() {
            this.tree = this.buildTree(files);
        },

        buildTree(files) {
            const tree = {};

            files.forEach(file => {
                const parts = file.file_path ? file.file_path.split('/').filter(p => p) : [];
                let current = tree;

                parts.forEach((part) => {
                    if (!current[part]) {
                        current[part] = {
                            type: 'folder',
                            name: part,
                            children: {},
                            operations: 0
                        };
                    }
                    current[part].operations += file.operations || 1;
                    current = current[part].children;
                });

                if (!current.__files) current.__files = [];
                current.__files.push({
                    name: file.file_name || file.file,
                    operations: file.operations || 1,
                    fullPath: file.file
                });
            });

            return tree;
        },

        toggleNode(nodeId) {
            if (this.expandedNodes.has(nodeId)) {
                this.expandedNodes.delete(nodeId);
            } else {
                this.expandedNodes.add(nodeId);
            }
        },

        isExpanded(nodeId) {
            return this.expandedNodes.has(nodeId);
        },

        showUsersForPath(path, isFolder) {
            const userCounts = {};

            fileDetails.forEach(detail => {
                const detailPath = `${detail.file_path}/${detail.file_name}`;
                const matches = isFolder ? detailPath.startsWith(path) : detailPath === path;

                if (matches) {
                    userCounts[detail.user_id] = (userCounts[detail.user_id] || 0) + 1;
                }
            });

            const users = Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([user, count]) => ({ user, operations: count }));

            const fileName = path.split('/').pop();
            Alpine.store('dashboard').showUsersModal(users, `Users accessing: ${fileName}`);
        }
    }));

    // ===== PAGINATION COMPONENT =====
    Alpine.data('paginated', (items, pageSize = 20) => ({
        items: items,
        currentPage: 1,
        pageSize: pageSize,

        get paginatedItems() {
            const start = (this.currentPage - 1) * this.pageSize;
            const end = this.pageSize === -1 ? this.items.length : start + this.pageSize;
            return this.items.slice(start, end);
        },

        get totalPages() {
            return this.pageSize === -1 ? 1 : Math.ceil(this.items.length / this.pageSize);
        },

        get pageNumbers() {
            if (this.totalPages <= 1) return [];

            const maxButtons = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(this.totalPages, startPage + maxButtons - 1);

            if (endPage - startPage < maxButtons - 1) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            const pages = [];
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
            return pages;
        },

        get startItem() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        get endItem() {
            const end = this.pageSize === -1 ? this.items.length : this.currentPage * this.pageSize;
            return Math.min(end, this.items.length);
        },

        goToPage(page) {
            this.currentPage = Math.max(1, Math.min(page, this.totalPages));
        },

        changePageSize(size) {
            this.pageSize = parseInt(size);
            this.currentPage = 1;
        },

        nextPage() {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
            }
        },

        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
            }
        }
    }));
});

// ===== GLOBAL HELPER FUNCTIONS =====
function handleFileSelect(event) {
    Alpine.store('dashboard').handleFileSelect(event);
}

function exportToPDF() {
    // PDF export functionality (keeping existing implementation)
    const reportData = Alpine.store('dashboard').reportData;
    if (!reportData) return;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title Page
    pdf.setFontSize(24);
    pdf.setTextColor(0, 120, 212);
    pdf.text('Purview Audit Report', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;
    pdf.setFontSize(12);
    pdf.setTextColor(96, 94, 92);
    const dateRange = reportData.metadata.date_range;
    pdf.text(`Report Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`, pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });

    // Summary Statistics
    yPosition += 20;
    pdf.setFontSize(16);
    pdf.setTextColor(50, 49, 48);
    pdf.text('Executive Summary', 20, yPosition);

    yPosition += 10;
    pdf.setFontSize(11);
    pdf.text(`Total File Operations: ${reportData.metadata.total_operations.toLocaleString()}`, 20, yPosition);

    yPosition += 7;
    pdf.text(`Unique Users: ${reportData.metadata.unique_users.toLocaleString()}`, 20, yPosition);

    yPosition += 7;
    pdf.text(`Unique Sites: ${reportData.metadata.unique_sites.toLocaleString()}`, 20, yPosition);

    yPosition += 7;
    pdf.text(`Unique Files: ${reportData.metadata.unique_files.toLocaleString()}`, 20, yPosition);

    // Save
    pdf.save(`purview-audit-report-${new Date().toISOString().split('T')[0]}.pdf`);
    alert('✅ PDF report generated successfully!');
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.trim());
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
