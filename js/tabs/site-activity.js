/* =================================================================
   Site Activity Tab - Site Overview and Details
   ================================================================= */

// Show site detail (drill-down)
function showSiteDetail(index) {
    this.pushNavigationHistory();
    this.siteDetailIndex = index;
}

// Close site detail
function closeSiteDetail() {
    this.siteDetailIndex = null;
}

// Render sites overview table (main table with search and pagination)
function renderSitesOverviewTable() {
    const sites = this.reportData?.site_activity || [];
    if (sites.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No sites found</p>';
    }

    const searchQuery = this.searchQueries.sites.main;
    const filteredSites = searchQuery
        ? sites.filter(s => extractSiteName(s.site_url).toLowerCase().includes(searchQuery.toLowerCase()))
        : sites;

    const paginationState = this.pagination.sites.main;
    const paginated = paginateData(filteredSites, paginationState.page, paginationState.perPage);

    return `
        ${this.renderSearchBox('sites', 'main')}
        <table class="data-table">
            <thead>
                <tr>
                    <th>Site</th>
                    <th>Operations</th>
                    <th>Users</th>
                    <th>Files</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map((site, index) => {
                    const originalIndex = sites.findIndex(s => s.site_url === site.site_url);
                    return `
                        <tr class="clickable" onclick="window.vueApp.showSiteDetail(${originalIndex})">
                            <td>${extractSiteName(site.site_url)}</td>
                            <td>${formatNumber(site.total_operations)}</td>
                            <td>${formatNumber(site.unique_users)}</td>
                            <td>${formatNumber(site.unique_files)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls('sites', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}
