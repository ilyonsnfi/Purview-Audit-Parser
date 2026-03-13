/* =================================================================
   Data Processor - Parsing and Analysis
   ================================================================= */

// Parse AuditData JSON string (equivalent to Python's parse_audit_data)
function parseAuditData(auditDataStr) {
    if (!auditDataStr) return null;

    try {
        return JSON.parse(auditDataStr);
    } catch (error) {
        console.warn('Failed to parse AuditData JSON:', error);
        return null;
    }
}

// Extract file info from raw Purview log row (equivalent to Python's extract_file_info)
function extractFileInfo(row) {
    const operation = row.Operation;

    // Filter for tracked operations only (file + sharing)
    if (!operation || !FILE_OPERATIONS.has(operation)) {
        return null;
    }

    // Parse AuditData JSON
    const auditData = parseAuditData(row.AuditData);
    if (!auditData) return null;

    // Extract common fields
    const fileName = auditData.SourceFileName || '';
    const fileExtension = auditData.SourceFileExtension || '';
    const filePath = auditData.SourceRelativeUrl || '';
    const fileUrl = auditData.ObjectId || row.ObjectId || '';
    const userId = row.UserId || '';
    const timestamp = row.CreationDate || '';
    const siteUrl = auditData.SiteUrl || '';
    const workload = auditData.Workload || '';

    // Application fallback chain: ApplicationDisplayName -> ClientAppName -> UserAgent
    const application = auditData.ApplicationDisplayName ||
                      auditData.ClientAppName ||
                      row.UserAgent ||
                      'Unknown';

    // Build access_type: operation + platform (if not 'NotSpecified')
    const platform = auditData.Platform || '';
    let accessType = operation;
    if (platform && platform !== 'NotSpecified') {
        accessType = `${operation} (${platform})`;
    }

    // Extract sharing-specific fields
    const isSharing = SHARING_OPERATIONS.has(operation);
    const targetUser = isSharing ? (auditData.TargetUserOrGroupName || '') : '';
    const targetType = isSharing ? (auditData.TargetUserOrGroupType || '') : '';
    const sharingId = isSharing ? (auditData.UniqueSharingId || '') : '';
    const sharingScope = isSharing ? (auditData.SharingLinkScope || '') : '';

    // Return normalized row with sharing fields
    return {
        file_name: fileName,
        file_extension: fileExtension,
        file_path: filePath,
        user_id: userId,
        access_type: accessType,
        operation: operation,
        timestamp: timestamp,
        application: application,
        workload: workload,
        site_url: siteUrl,
        file_url: fileUrl,
        // Sharing-specific fields
        is_sharing: isSharing,
        target_user: targetUser,
        target_type: targetType,
        sharing_id: sharingId,
        sharing_scope: sharingScope
    };
}

// Parse raw Purview log data (equivalent to Python's process_audit_log)
function parseRawPurviewLog(rawData) {
    console.log('Parsing raw Purview audit log...');
    const normalizedData = [];

    rawData.forEach(row => {
        const fileInfo = extractFileInfo(row);
        if (fileInfo) {
            normalizedData.push(fileInfo);
        }
    });

    // Sort by file_path -> file_name -> timestamp (same as Python)
    normalizedData.sort((a, b) => {
        if (a.file_path !== b.file_path) {
            return a.file_path.localeCompare(b.file_path);
        }
        if (a.file_name !== b.file_name) {
            return a.file_name.localeCompare(b.file_name);
        }
        return a.timestamp.localeCompare(b.timestamp);
    });

    console.log(`Parsed ${normalizedData.length} file operations from ${rawData.length} raw records`);
    return normalizedData;
}

// Detect if CSV is raw Purview log or already-parsed format
function detectCSVFormat(data) {
    if (data.length === 0) return 'unknown';

    const firstRow = data[0];

    // Raw Purview log has: CreationDate, UserId, Operation, AuditData
    const hasRawFields = 'AuditData' in firstRow && 'CreationDate' in firstRow;

    // Parsed format has: file_name, file_path, operation
    const hasParsedFields = 'file_name' in firstRow && 'file_path' in firstRow;

    if (hasRawFields) return 'raw';
    if (hasParsedFields) return 'parsed';
    return 'unknown';
}

// Analyze CSV data
function analyzeData(data) {
    const siteData = {};
    const userData = {};
    const accessTypeData = {};
    const applicationData = {};
    const dailyOps = {};
    const fileTypes = {};

    // Sharing-specific metrics
    let totalFileOps = 0;
    let totalSharingOps = 0;
    const sharingPartners = new Set();  // Unique people shared with
    const externalShares = new Set();    // External sharing events
    const internalShares = new Set();    // Internal sharing events
    const sharingByType = {};            // Count by sharing operation type

    let totalOps = 0;
    const allFiles = new Set();
    const allDates = [];

    data.forEach((row) => {
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
        const isSharing = row.is_sharing || false;
        const targetUser = row.target_user || '';
        const targetType = row.target_type || '';

        const fileKey = `${filePath}/${fileName}`;
        allFiles.add(fileKey);

        if (fileExt) fileTypes[fileExt] = (fileTypes[fileExt] || 0) + 1;

        // Track sharing-specific metrics
        if (isSharing) {
            totalSharingOps++;

            // Track sharing by type
            sharingByType[operation] = (sharingByType[operation] || 0) + 1;

            // Track sharing partners
            if (targetUser) {
                sharingPartners.add(targetUser);

                // Track external vs internal
                const shareKey = `${operation}:${targetUser}:${fileKey}:${timestamp}`;
                if (targetType === 'Guest') {
                    externalShares.add(shareKey);
                } else if (targetType) {
                    internalShares.add(shareKey);
                }
            }
        } else {
            totalFileOps++;
        }

        if (timestamp) {
            const cleanTimestamp = timestamp.trim();
            const date = cleanTimestamp.split('T')[0];
            const dateObj = new Date(cleanTimestamp);
            if (!isNaN(dateObj.getTime())) {
                allDates.push(dateObj);
                dailyOps[date] = (dailyOps[date] || 0) + 1;
            }
        }

        // Site data - group by extracted site name instead of full URL
        const siteName = extractSiteName(siteUrl);
        if (!siteData[siteName]) {
            siteData[siteName] = {
                site_url: siteUrl,  // Store first URL encountered for this site name
                operations: 0,
                users: new Set(),
                files: new Set(),
                accessTypes: {},
                applications: {},
                fileTypes: {},
                records: []
            };
        }
        siteData[siteName].operations++;
        siteData[siteName].users.add(userId);
        siteData[siteName].files.add(fileKey);
        siteData[siteName].accessTypes[operation] = (siteData[siteName].accessTypes[operation] || 0) + 1;
        siteData[siteName].applications[application] = (siteData[siteName].applications[application] || 0) + 1;
        if (fileExt) siteData[siteName].fileTypes[fileExt] = (siteData[siteName].fileTypes[fileExt] || 0) + 1;
        siteData[siteName].records.push(row);

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
                applications: {},
                records: []
            };
        }
        accessTypeData[operation].count++;
        accessTypeData[operation].users.add(userId);
        accessTypeData[operation].sites.add(siteUrl);
        accessTypeData[operation].applications[application] =
            (accessTypeData[operation].applications[application] || 0) + 1;
        accessTypeData[operation].records.push(row);

        // Application data
        if (!applicationData[application]) {
            applicationData[application] = {
                count: 0,
                accessTypes: {},
                users: new Set(),
                sites: new Set(),
                records: []
            };
        }
        applicationData[application].count++;
        applicationData[application].accessTypes[operation] =
            (applicationData[application].accessTypes[operation] || 0) + 1;
        applicationData[application].users.add(userId);
        applicationData[application].sites.add(siteUrl);
        applicationData[application].records.push(row);
    });

    // Convert to arrays and sort
    const siteActivity = Object.entries(siteData).map(([siteName, data]) => {
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
            site_url: data.site_url,  // Use the stored URL from the data object
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

    const accessTypes = Object.entries(accessTypeData).map(([type, data]) => {
        const userCounts = {};
        data.records.forEach(r => {
            userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1;
        });
        const topUsers = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([user, count]) => ({ user, operations: count }));

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
            type,
            count: data.count,
            unique_users: data.users.size,
            unique_sites: data.sites.size,
            applications: Object.entries(data.applications)
                .sort((a, b) => b[1] - a[1])
                .map(([app, count]) => ({ app, count })),
            top_users: topUsers,
            top_sites: topSites,
            top_files: topFiles,
            file_details: data.records
        };
    }).sort((a, b) => b.count - a.count);

    const applications = Object.entries(applicationData).map(([app, data]) => {
        const userCounts = {};
        data.records.forEach(r => {
            userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1;
        });
        const topUsers = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([user, count]) => ({ user, operations: count }));

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
            application: app,
            count: data.count,
            unique_users: data.users.size,
            unique_sites: data.sites.size,
            access_types: Object.entries(data.accessTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, count })),
            top_users: topUsers,
            top_sites: topSites,
            top_files: topFiles,
            file_details: data.records
        };
    }).sort((a, b) => b.count - a.count);

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
            total_file_operations: totalFileOps,
            total_sharing_operations: totalSharingOps,
            unique_users: Object.keys(userData).length,
            unique_sites: Object.keys(siteData).length,
            unique_files: allFiles.size,
            unique_sharing_partners: sharingPartners.size,
            external_shares: externalShares.size,
            internal_shares: internalShares.size,
            date_range: dateRange
        },
        sharing_metrics: {
            total_sharing_operations: totalSharingOps,
            sharing_by_type: Object.entries(sharingByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, count })),
            unique_sharing_partners: sharingPartners.size,
            external_shares: externalShares.size,
            internal_shares: internalShares.size,
            sharing_partners: Array.from(sharingPartners)
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
            access_type_distribution: aggregateAccessTypes(accessTypes),
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
}

// Build aggregated access types with full detail (users, sites, files, records combined)
function buildAggregatedAccessTypesData(rawAccessTypes) {
    const aggregated = {};

    // Group all raw access types by their human-readable version
    rawAccessTypes.forEach(accessType => {
        const humanReadable = getHumanReadableAccessType(accessType.type);

        if (!aggregated[humanReadable]) {
            aggregated[humanReadable] = {
                type: humanReadable,
                count: 0,
                applications: {},
                file_details: []
            };
        }

        // Combine counts
        aggregated[humanReadable].count += accessType.count;

        // Combine applications
        accessType.applications?.forEach(app => {
            if (!aggregated[humanReadable].applications[app.app]) {
                aggregated[humanReadable].applications[app.app] = 0;
            }
            aggregated[humanReadable].applications[app.app] += app.count;
        });

        // Combine file details (for file tree)
        if (accessType.file_details) {
            aggregated[humanReadable].file_details.push(...accessType.file_details);
        }
    });

    // Convert to array and finalize data
    return Object.values(aggregated).map(agg => {
        // Build unique sets and counts from the combined records
        const userSet = new Set();
        const siteSet = new Set();
        const userCounts = {};
        const siteCounts = {};
        const fileCounts = {};

        agg.file_details.forEach(record => {
            // Track unique users and sites
            userSet.add(record.user_id);
            siteSet.add(record.site_url);

            // Count operations per user/site/file
            userCounts[record.user_id] = (userCounts[record.user_id] || 0) + 1;
            siteCounts[record.site_url] = (siteCounts[record.site_url] || 0) + 1;
            const fileKey = `${record.file_path}/${record.file_name}`;
            fileCounts[fileKey] = (fileCounts[fileKey] || 0) + 1;
        });

        return {
            type: agg.type,
            count: agg.count,
            unique_users: userSet.size,
            unique_sites: siteSet.size,
            applications: Object.entries(agg.applications)
                .sort((a, b) => b[1] - a[1])
                .map(([app, count]) => ({ app, count })),
            top_users: Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([user, count]) => ({ user, operations: count })),
            top_sites: Object.entries(siteCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([site, count]) => ({ site, operations: count })),
            top_files: Object.entries(fileCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([file, count]) => ({ file, operations: count })),
            file_details: agg.file_details
        };
    }).sort((a, b) => b.count - a.count);
}
