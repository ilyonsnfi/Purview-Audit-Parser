/* =================================================================
   Utility Functions - Formatting and Helpers
   ================================================================= */

// Format number with thousands separator
function formatNumber(num) {
    return num ? num.toLocaleString() : '0';
}

// Format date string to readable format
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.trim());
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Extract site name from SharePoint URL
function extractSiteName(url) {
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

// Generate chart colors dynamically
function generateChartColors(count) {
    const baseColors = [
        'rgba(0, 120, 212, 0.8)',      // Blue
        'rgba(16, 124, 16, 0.8)',      // Green
        'rgba(255, 140, 0, 0.8)',      // Orange
        'rgba(216, 59, 1, 0.8)',       // Red
        'rgba(80, 230, 255, 0.8)',     // Cyan
        'rgba(185, 0, 185, 0.8)',      // Magenta
        'rgba(255, 185, 0, 0.8)',      // Yellow
        'rgba(0, 178, 148, 0.8)',      // Teal
        'rgba(164, 38, 44, 0.8)',      // Dark Red
        'rgba(76, 209, 55, 0.8)',      // Light Green
        'rgba(149, 117, 205, 0.8)',    // Purple
        'rgba(255, 99, 71, 0.8)',      // Tomato
        'rgba(72, 201, 176, 0.8)',     // Turquoise
        'rgba(255, 215, 0, 0.8)',      // Gold
        'rgba(106, 90, 205, 0.8)'      // Slate Blue
    ];

    // If we need more colors than we have, generate them dynamically
    if (count <= baseColors.length) {
        return baseColors.slice(0, count);
    }

    const colors = [...baseColors];
    for (let i = baseColors.length; i < count; i++) {
        const hue = (i * 137.5) % 360; // Golden angle for color distribution
        colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
    }
    return colors;
}

// Map raw access types to human-readable versions
function getHumanReadableAccessType(rawType) {
    // Check if this is a sharing operation first
    if (SHARING_OPERATIONS.has(rawType)) {
        return 'Shared';
    }

    // Remove "File" prefix and handle Extended versions
    let type = rawType;

    // Handle Extended versions - merge with base type
    if (type.endsWith('Extended')) {
        type = type.replace('Extended', '');
    }

    // Merge FileVersionsAllDeleted with FileDeleted
    if (type === 'FileVersionsAllDeleted') {
        type = 'FileDeleted';
    }

    // Remove "File" prefix
    if (type.startsWith('File')) {
        type = type.substring(4);
    }

    // Further consolidations (after "File" prefix removed)
    // Combine sync operations with their base operations
    if (type === 'SyncDownloadedFull') {
        type = 'Downloaded';
    }
    if (type === 'SyncUploadedFull' || type === 'UploadedPartial') {
        type = 'Uploaded';
    }

    // Combine similar operations
    if (type === 'Previewed') {
        type = 'Accessed';
    }
    if (type === 'Renamed') {
        type = 'Modified';
    }
    if (type === 'Recycled') {
        type = 'Deleted';
    }

    return type;
}

// Map raw application names to human-readable versions
function getHumanReadableApplication(rawApp) {
    if (!rawApp) return 'Unknown';

    const app = rawApp.trim();

    // Combine Web Office applications
    if (app.startsWith('Web') && (app.includes('Excel') || app.includes('Word') || app.includes('PowerPoint'))) {
        return 'Web Office';
    }
    if (app.startsWith('MSOCS') && (app.includes('Excel') || app.includes('Word') || app.includes('PowerPoint'))) {
        return 'Web Office';
    }
    // Combine Office apps ending with "Online"
    if (app.endsWith('Online') && (app.includes('Excel') || app.includes('Word') || app.includes('PowerPoint'))) {
        return 'Web Office';
    }

    // Combine OneDrive sync applications
    if (app === 'OneDrive SyncEngine' || app === 'OneDriveSync') {
        return 'OneDrive Sync';
    }

    // Combine all backup applications
    if (app.startsWith('Backup Application')) {
        return 'Backup Application';
    }

    // Combine Microsoft Office desktop apps (lowercase variants)
    const lowerApp = app.toLowerCase();
    if (lowerApp === 'excel' || lowerApp === 'word' || lowerApp === 'powerpoint' ||
        lowerApp === 'outlook' || lowerApp === 'onenote' || lowerApp === 'access') {
        return 'Microsoft Office';
    }

    return app;
}

// Aggregate access types into human-readable format
function aggregateAccessTypes(accessTypesArray) {
    const aggregated = {};

    accessTypesArray.forEach(item => {
        const humanReadable = getHumanReadableAccessType(item.type);
        if (!aggregated[humanReadable]) {
            aggregated[humanReadable] = 0;
        }
        aggregated[humanReadable] += item.count;
    });

    return Object.entries(aggregated)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}

// Aggregate applications into human-readable format
function aggregateApplications(applicationsArray) {
    const aggregated = {};

    applicationsArray.forEach(item => {
        const humanReadable = getHumanReadableApplication(item.app);
        if (!aggregated[humanReadable]) {
            aggregated[humanReadable] = 0;
        }
        aggregated[humanReadable] += item.count;
    });

    return Object.entries(aggregated)
        .map(([app, count]) => ({ app, count }))
        .sort((a, b) => b.count - a.count);
}

// Filter items by search query
function filterBySearch(items, searchQuery, searchField) {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => {
        const value = item[searchField] || '';
        return value.toLowerCase().includes(query);
    });
}

// Paginate data
function paginateData(items, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
        items: items.slice(start, end),
        totalPages: Math.ceil(items.length / perPage),
        totalItems: items.length,
        currentPage: page
    };
}
