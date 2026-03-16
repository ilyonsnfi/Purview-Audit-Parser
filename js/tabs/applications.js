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

    // Aggregate to human-readable if requested
    let displayApps;
    if (this.showHumanReadableApplications.applications) {
        // Aggregate applications by human-readable name
        const aggregated = {};
        applications.forEach(app => {
            const humanReadable = getHumanReadableApplication(app.application);
            if (!aggregated[humanReadable]) {
                aggregated[humanReadable] = {
                    application: humanReadable,
                    count: 0,
                    unique_users: 0,
                    unique_sites: 0,
                    users: new Set(),
                    sites: new Set(),
                    originalIndices: []
                };
            }
            aggregated[humanReadable].count += app.count;
            aggregated[humanReadable].originalIndices.push(applications.indexOf(app));
            // Collect unique users and sites
            app.top_users?.forEach(u => aggregated[humanReadable].users.add(u.user));
            app.top_sites?.forEach(s => aggregated[humanReadable].sites.add(s.site));
        });
        displayApps = Object.values(aggregated).map(agg => ({
            ...agg,
            unique_users: agg.users.size,
            unique_sites: agg.sites.size,
            firstIndex: agg.originalIndices[0]
        })).sort((a, b) => b.count - a.count);
    } else {
        displayApps = applications.map((app, idx) => ({ ...app, firstIndex: idx }));
    }

    const searchQuery = this.searchQueries.applications.main;
    const filteredApps = searchQuery
        ? displayApps.filter(a => a.application.toLowerCase().includes(searchQuery.toLowerCase()))
        : displayApps;

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
                ${paginated.items.map(app => `
                    <tr class="clickable" onclick="window.vueApp.showApplicationDetail(${app.firstIndex})">
                        <td><strong>${app.application}</strong></td>
                        <td>${formatNumber(app.count)}</td>
                        <td>${formatNumber(app.unique_users)}</td>
                        <td>${formatNumber(app.unique_sites)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls('applications', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}
