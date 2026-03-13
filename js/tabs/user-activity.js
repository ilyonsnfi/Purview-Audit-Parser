/* =================================================================
   User Activity Tab - User Overview and Details
   ================================================================= */

// Show user detail (drill-down)
function showUserDetail(index) {
    this.pushNavigationHistory();
    this.userDetailIndex = index;
}

// Close user detail
function closeUserDetail() {
    this.userDetailIndex = null;
}

// Render users overview table (main table with search and pagination)
function renderUsersOverviewTable() {
    const users = this.reportData?.user_activity || [];
    if (users.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No users found</p>';
    }

    const searchQuery = this.searchQueries.users.main;
    const filteredUsers = searchQuery
        ? users.filter(u => u.user_id.toLowerCase().includes(searchQuery.toLowerCase()))
        : users;

    const paginationState = this.pagination.users.main;
    const paginated = paginateData(filteredUsers, paginationState.page, paginationState.perPage);

    return `
        ${this.renderSearchBox('users', 'main')}
        <table class="data-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Operations</th>
                    <th>Sites</th>
                    <th>Files</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map((user, index) => {
                    const originalIndex = users.findIndex(u => u.user_id === user.user_id);
                    return `
                        <tr class="clickable" onclick="window.vueApp.showUserDetail(${originalIndex})">
                            <td>${user.user_id}</td>
                            <td>${formatNumber(user.total_operations)}</td>
                            <td>${formatNumber(user.unique_sites)}</td>
                            <td>${formatNumber(user.unique_files)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls('users', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}
