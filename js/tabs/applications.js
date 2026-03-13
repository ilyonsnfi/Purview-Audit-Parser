/* =================================================================
   Applications Tab - Application Overview and Details
   ================================================================= */

// Show application detail (drill-down)
function showApplicationDetail(index) {
    this.pushNavigationHistory();
    this.applicationDetailIndex = index;
}

// Close application detail
function closeApplicationDetail() {
    this.applicationDetailIndex = null;
}

// Render applications overview table (main table with search and pagination)
function renderApplicationsOverviewTable() {
    const applications = this.reportData?.applications || [];
    if (applications.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No applications found</p>';
    }

    const searchQuery = this.searchQueries.applications.main;
    const filteredApps = searchQuery
        ? applications.filter(a => a.application.toLowerCase().includes(searchQuery.toLowerCase()))
        : applications;

    const paginationState = this.pagination.applications.main;
    const paginated = paginateData(filteredApps, paginationState.page, paginationState.perPage);

    return `
        ${this.renderSearchBox('applications', 'main')}
        <table class="data-table">
            <thead>
                <tr>
                    <th>Application</th>
                    <th>Count</th>
                    <th>Users</th>
                    <th>Sites</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map((app, index) => {
                    const originalIndex = applications.findIndex(a => a.application === app.application);
                    return `
                        <tr class="clickable" onclick="window.vueApp.showApplicationDetail(${originalIndex})">
                            <td><strong>${app.application}</strong></td>
                            <td>${formatNumber(app.count)}</td>
                            <td>${formatNumber(app.unique_users)}</td>
                            <td>${formatNumber(app.unique_sites)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls('applications', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}
