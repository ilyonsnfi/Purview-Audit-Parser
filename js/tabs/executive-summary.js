/* =================================================================
   Executive Summary Tab - Charts and Visualizations
   ================================================================= */

// Initialize all charts
function initializeCharts() {
    this.createTopSitesChart();
    this.createTopUsersChart();
    this.createAccessTypeChart();
    this.createTopApplicationsChart();
    this.createTimelineChart();
}

// Create Top Sites Chart
function createTopSitesChart() {
    const ctx = document.getElementById('topSitesChart')?.getContext('2d');
    if (!ctx || !this.reportData) return;

    const data = this.reportData.executive_summary.top_sites.slice(0, 10);

    if (this.charts.topSites) this.charts.topSites.destroy();

    this.charts.topSites = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => extractSiteName(d.site)),
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
}

// Create Top Users Chart
function createTopUsersChart() {
    const ctx = document.getElementById('topUsersChart')?.getContext('2d');
    if (!ctx || !this.reportData) return;

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
}

// Create Access Type Distribution Chart
function createAccessTypeChart() {
    const ctx = document.getElementById('accessTypeChart')?.getContext('2d');
    if (!ctx || !this.reportData) return;

    // Access type distribution is already aggregated to human-readable format
    const data = this.reportData.executive_summary.access_type_distribution;

    if (this.charts.accessType) this.charts.accessType.destroy();

    // Generate colors dynamically based on number of items
    const colors = generateChartColors(data.length);

    this.charts.accessType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.type),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// Create Top Applications Chart
function createTopApplicationsChart() {
    const ctx = document.getElementById('topApplicationsChart')?.getContext('2d');
    if (!ctx || !this.reportData) return;

    // Application distribution is already aggregated to human-readable format
    const data = this.reportData.executive_summary.application_distribution.slice(0, 10);

    if (this.charts.topApplications) this.charts.topApplications.destroy();

    this.charts.topApplications = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.app),
            datasets: [{
                label: 'Operations',
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
}

// Create Activity Timeline Chart
function createTimelineChart() {
    const ctx = document.getElementById('timelineChart')?.getContext('2d');
    if (!ctx || !this.reportData) return;

    const data = this.reportData.daily_operations;

    if (this.charts.timeline) this.charts.timeline.destroy();

    this.charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatDate(d.date)),
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
}
