/* =================================================================
   Shared Components - Reusable UI Components
   ================================================================= */

// Search and Pagination Components

function renderSearchBox(context, listType) {
    const query = this.searchQueries[context][listType] || '';
    return `
        <div style="margin-bottom: 15px; padding: 10px; background: var(--background); border-radius: 4px;">
            <input
                type="text"
                placeholder="Search..."
                value="${query}"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px;"
                onkeyup="window.vueApp.searchQueries['${context}']['${listType}'] = this.value"
            />
        </div>
    `;
}

function renderPaginationControls(context, listType, currentPage, totalPages, totalItems) {
    if (totalPages <= 1) return '';

    const perPage = this.pagination[context][listType].perPage;
    const start = (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, totalItems);

    let buttons = '';
    buttons += `<button class="btn btn-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="window.vueApp.pagination['${context}']['${listType}'].page = ${currentPage - 1}">← Prev</button>`;

    // Show page numbers
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'btn-primary' : 'btn-secondary';
        buttons += `<button class="btn ${activeClass}" onclick="window.vueApp.pagination['${context}']['${listType}'].page = ${i}">${i}</button>`;
    }

    buttons += `<button class="btn btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.vueApp.pagination['${context}']['${listType}'].page = ${currentPage + 1}">Next →</button>`;

    return `
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--background); border-radius: 4px;">
            <div style="color: var(--text-secondary);">
                Showing ${start}-${end} of ${totalItems}
            </div>
            <div style="display: flex; gap: 5px;">
                ${buttons}
            </div>
        </div>
    `;
}

// File Tree Components

function buildFileTree(files) {
    const tree = {};

    files.forEach(file => {
        // Parse the combined file path (format: "path/to/file/filename.ext")
        const fullPath = file.file || `${file.file_path}/${file.file_name}`;
        const parts = fullPath.split('/').filter(p => p);

        if (parts.length === 0) return;

        // Extract filename (last part) and folder path (everything before)
        const fileName = parts[parts.length - 1];
        const folderParts = parts.slice(0, -1);

        let current = tree;

        // Build folder structure
        folderParts.forEach((part) => {
            if (!current[part]) {
                current[part] = {
                    type: 'folder',
                    name: part,
                    children: {},
                    files: [],
                    operations: 0
                };
            }
            current[part].operations += file.operations || 1;
            current = current[part].children;
        });

        // Add file to final folder
        if (!current.__files) {
            current.__files = [];
        }
        current.__files.push({
            name: fileName,
            operations: file.operations || 1,
            fullPath: fullPath
        });
    });

    return tree;
}

function buildSiteFileTree(fileDetails) {
    // Group files by site, then build file tree for each site
    const siteGroups = {};

    fileDetails.forEach(record => {
        const siteUrl = record.site_url || 'Unknown';
        if (!siteGroups[siteUrl]) {
            siteGroups[siteUrl] = [];
        }

        const fullPath = `${record.file_path}/${record.file_name}`;
        siteGroups[siteUrl].push({
            file: fullPath,
            operations: 1
        });
    });

    // Build tree structure with sites at top level
    const tree = {};

    Object.entries(siteGroups).forEach(([siteUrl, files]) => {
        // Count total operations for this site
        const fileCounts = {};
        files.forEach(f => {
            fileCounts[f.file] = (fileCounts[f.file] || 0) + 1;
        });

        const fileList = Object.entries(fileCounts).map(([file, count]) => ({
            file,
            operations: count
        }));

        const totalOps = fileList.reduce((sum, f) => sum + f.operations, 0);
        const siteName = extractSiteName(siteUrl);

        // Build file tree for this site
        const siteFileTree = {};
        fileList.forEach(file => {
            const parts = file.file.split('/').filter(p => p);
            if (parts.length === 0) return;

            const fileName = parts[parts.length - 1];
            const folderParts = parts.slice(0, -1);
            let current = siteFileTree;

            folderParts.forEach((part) => {
                if (!current[part]) {
                    current[part] = {
                        type: 'folder',
                        name: part,
                        children: {},
                        operations: 0
                    };
                }
                current[part].operations += file.operations;
                current = current[part].children;
            });

            if (!current.__files) {
                current.__files = [];
            }
            current.__files.push({
                name: fileName,
                operations: file.operations,
                fullPath: file.file
            });
        });

        tree[siteName] = {
            type: 'site',
            name: siteName,
            siteUrl: siteUrl,
            operations: totalOps,
            children: siteFileTree
        };
    });

    return tree;
}

// Filter file tree based on search query
function filterFileTree(tree, searchQuery) {
    if (!searchQuery) return tree;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(tree).forEach(([key, node]) => {
        if (key === '__files') {
            // Filter files
            const matchedFiles = node.filter(file =>
                file.name.toLowerCase().includes(query) ||
                (file.fullPath && file.fullPath.toLowerCase().includes(query))
            );
            if (matchedFiles.length > 0) {
                filtered.__files = matchedFiles;
            }
        } else {
            // Check if folder name matches
            const folderMatches = node.name.toLowerCase().includes(query);

            // Recursively filter children
            const filteredChildren = this.filterFileTree(node.children, searchQuery);
            const hasMatchingChildren = Object.keys(filteredChildren).length > 0;

            // Include folder if it matches or has matching children
            if (folderMatches || hasMatchingChildren) {
                filtered[key] = {
                    ...node,
                    children: filteredChildren
                };
            }
        }
    });

    return filtered;
}

// Render search box for file tree
function renderFileTreeSearch(context) {
    return `
        <div class="control-group" style="margin-bottom: 15px;">
            <input
                type="text"
                placeholder="Search files and folders..."
                value="${this.searchQueries[context].files}"
                oninput="window.vueApp.updateFileSearch('${context}', event.target.value)"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px;"
            />
        </div>
    `;
}

// Update file search query
function updateFileSearch(context, value) {
    this.searchQueries[context].files = value;
}

// Render file tree with search
function renderFileTreeWithSearch(tree, context, parentId = '', fileDetails = []) {
    const searchQuery = this.searchQueries[context].files;
    const filteredTree = this.filterFileTree(tree, searchQuery);

    return `
        ${this.renderFileTreeSearch(context)}
        ${this.renderFileTree(filteredTree, 0, parentId, fileDetails, '')}
    `;
}

function renderFileTree(tree, level = 0, parentId = '', fileDetails = [], pathPrefix = '') {
    // Store file details in window for onclick handlers
    window.currentFileDetails = fileDetails;

    let html = '';
    const entries = Object.entries(tree)
        .filter(([key]) => key !== '__files')
        .sort((a, b) => b[1].operations - a[1].operations);

    // Render folders
    entries.forEach(([name, node], index) => {
        const nodeId = `${parentId}_${level}_${index}`;
        const hasChildren = Object.keys(node.children).length > 0 || node.children.__files?.length > 0;
        const folderPath = pathPrefix ? `${pathPrefix}/${name}` : name;

        html += `
            <div class="tree-item" style="padding-left: ${level * 20}px;">
                <div class="tree-folder">
                    <span class="tree-folder-icon" id="icon_${nodeId}" onclick="window.vueApp.toggleTreeNode('${nodeId}')">
                        ${hasChildren ? '▶' : '📄'}
                    </span>
                    <span class="tree-folder-name" onclick="window.vueApp.toggleTreeNode('${nodeId}')">📁 ${name}</span>
                    <div class="tree-folder-stats">
                        <span>${formatNumber(node.operations)} operations</span>
                        <span class="tree-user-icon" onclick="event.stopPropagation(); window.vueApp.showUsersForCurrentPath('${folderPath.replace(/'/g, "\\'")}/', true)" title="Show users">
                            👤
                        </span>
                    </div>
                </div>
                <div class="tree-children" id="children_${nodeId}">
                    ${hasChildren ? this.renderFileTree(node.children, level + 1, nodeId, fileDetails, folderPath) : ''}
                </div>
            </div>
        `;
    });

    // Render files in current folder
    if (tree.__files && tree.__files.length > 0) {
        const sortedFiles = [...tree.__files].sort((a, b) => b.operations - a.operations);
        sortedFiles.forEach(file => {
            const filePath = file.fullPath || file.name;
            html += `
                <div class="tree-file" style="padding-left: ${(level + 1) * 20}px;">
                    <span class="tree-file-icon">📄</span>
                    <span class="tree-file-name">${file.name}</span>
                    <span class="tree-file-count">${formatNumber(file.operations)} ops</span>
                    <span class="tree-user-icon" onclick="window.vueApp.showUsersForCurrentPath('${filePath.replace(/'/g, "\\'")}', false)" title="Show users">
                        👤
                    </span>
                </div>
            `;
        });
    }

    return html;
}

function toggleTreeNode(nodeId) {
    const children = document.getElementById(`children_${nodeId}`);
    const icon = document.getElementById(`icon_${nodeId}`);

    if (children && icon) {
        if (children.classList.contains('expanded')) {
            children.classList.remove('expanded');
            icon.textContent = '▶';
        } else {
            children.classList.add('expanded');
            icon.textContent = '▼';
        }
    }
}

function showUsersForCurrentPath(path, isFolder = false) {
    // Use the stored file details from window
    this.showUsersForPath(path, window.currentFileDetails || [], isFolder);
}

function showUsersForPath(path, fileDetails, isFolder = false) {
    const userCounts = {};

    // Filter file details by path
    fileDetails.forEach(detail => {
        const detailPath = `${detail.file_path}/${detail.file_name}`;

        // For folders, match if the path starts with the folder path
        // For files, exact match
        const matches = isFolder
            ? detailPath.startsWith(path)
            : detailPath === path;

        if (matches) {
            if (!userCounts[detail.user_id]) {
                userCounts[detail.user_id] = 0;
            }
            userCounts[detail.user_id]++;
        }
    });

    // Sort by operation count
    const sortedUsers = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([user, count]) => ({ user, operations: count }));

    // Show modal
    const fileName = path.split('/').pop() || path;
    this.modalTitle = `Users accessing: ${fileName}`;
    this.modalUsers = sortedUsers;
    this.modalOpen = true;
}

// Reusable Table Rendering Functions

function renderUsersTable(users, context, listType = 'users', clickable = false) {
    if (!users || users.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No users found</p>';
    }

    // Apply search filter
    const searchQuery = this.searchQueries[context][listType];
    const filteredUsers = filterBySearch(users, searchQuery, 'user');

    // Apply pagination
    const paginationState = this.pagination[context][listType];
    const paginated = paginateData(filteredUsers, paginationState.page, paginationState.perPage);

    const clickableClass = clickable ? 'clickable' : '';
    const clickHandler = clickable ? `onclick="window.vueApp.navigateToUser('USERID')"` : '';

    return `
        ${this.renderSearchBox(context, listType)}
        <table class="data-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Operations</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map(user => `
                    <tr class="${clickableClass}" ${clickHandler.replace('USERID', user.user.replace(/'/g, "\\'"))}>
                        <td>${user.user}</td>
                        <td>${formatNumber(user.operations)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}

function renderAccessTypesTable(accessTypes, context, listType = 'accessTypes', showHumanReadable = false, clickable = false) {
    if (!accessTypes || accessTypes.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No access types found</p>';
    }

    // Aggregate to human-readable if requested
    const displayTypes = showHumanReadable ? aggregateAccessTypes(accessTypes) : accessTypes;

    // Apply search filter
    const searchQuery = this.searchQueries[context][listType];
    const filteredTypes = filterBySearch(displayTypes, searchQuery, 'type');

    // Apply pagination
    const paginationState = this.pagination[context][listType];
    const paginated = paginateData(filteredTypes, paginationState.page, paginationState.perPage);

    const clickableClass = clickable ? 'clickable' : '';
    const clickHandler = clickable ? `onclick="window.vueApp.navigateToAccessType('TYPENAME')"` : '';

    return `
        ${this.renderSearchBox(context, listType)}
        <table class="data-table">
            <thead>
                <tr>
                    <th>Access Type</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map(type => `
                    <tr class="${clickableClass}" ${clickHandler.replace('TYPENAME', type.type.replace(/'/g, "\\'"))}>
                        <td><strong>${type.type}</strong></td>
                        <td>${formatNumber(type.count)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}

function renderApplicationsTable(applications, context, listType = 'applications', clickable = false) {
    if (!applications || applications.length === 0) {
        return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No applications found</p>';
    }

    // Apply search filter
    const searchQuery = this.searchQueries[context][listType];
    const filteredApps = filterBySearch(applications, searchQuery, 'app');

    // Apply pagination
    const paginationState = this.pagination[context][listType];
    const paginated = paginateData(filteredApps, paginationState.page, paginationState.perPage);

    const clickableClass = clickable ? 'clickable' : '';
    const clickHandler = clickable ? `onclick="window.vueApp.navigateToApplication('APPNAME')"` : '';

    return `
        ${this.renderSearchBox(context, listType)}
        <table class="data-table">
            <thead>
                <tr>
                    <th>Application</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.items.map(app => `
                    <tr class="${clickableClass}" ${clickHandler.replace('APPNAME', app.app.replace(/'/g, "\\'"))}>
                        <td><strong>${app.app}</strong></td>
                        <td>${formatNumber(app.count)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
    `;
}
