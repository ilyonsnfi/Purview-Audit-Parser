/* =================================================================
   Purview Audit Report Dashboard - Vue 3 Application
   ================================================================= */

const { createApp } = Vue;

const vueAppConfig = {
    data() {
        return {
            // Data
            reportData: null,
            rawData: [],
            charts: {},

            // UI State
            loading: true,
            currentTab: 'summary',
            siteDetailIndex: null,
            userDetailIndex: null,
            applicationDetailIndex: null,
            accessTypeDetailIndex: null,

            // Navigation history for cross-tab navigation
            navigationHistory: [],

            // Access Type View Toggles (true = human-readable, false = raw)
            showHumanReadableAccessTypes: {
                siteActivity: true,
                userActivity: true,
                accessTypes: true,
                applications: true
            },

            // Search and Pagination State
            searchQueries: {
                sites: { main: '' },  // For main Site Activity overview
                users: { main: '' },  // For main User Activity overview
                accessTypes: { main: '', users: '', applications: '', files: '' },
                applications: { main: '', users: '', accessTypes: '', files: '' },  // For main Applications overview
                siteActivity: { users: '', accessTypes: '', applications: '', files: '' },  // For site drill-down
                userActivity: { accessTypes: '', applications: '', files: '' }  // For user drill-down
            },
            pagination: {
                sites: { main: { page: 1, perPage: 50 } },  // For main Site Activity overview
                users: { main: { page: 1, perPage: 50 } },  // For main User Activity overview
                accessTypes: {
                    main: { page: 1, perPage: 50 },
                    users: { page: 1, perPage: 20 },
                    applications: { page: 1, perPage: 20 }
                },
                applications: {
                    main: { page: 1, perPage: 50 },  // For main Applications overview
                    users: { page: 1, perPage: 20 },
                    accessTypes: { page: 1, perPage: 20 }
                },
                siteActivity: {
                    users: { page: 1, perPage: 20 },
                    accessTypes: { page: 1, perPage: 20 },
                    applications: { page: 1, perPage: 20 }
                },
                userActivity: {
                    accessTypes: { page: 1, perPage: 20 },
                    applications: { page: 1, perPage: 20 }
                }
            },

            // Modal State
            modalOpen: false,
            modalTitle: '',
            modalUsers: [],

            // Aggregated Access Types (for human-readable view)
            aggregatedAccessTypesData: [],

            // Operations we track (file operations + sharing operations)
            FILE_OPERATIONS: new Set([
                // File operations
                'FileAccessed',
                'FileAccessedExtended',
                'FileDeleted',
                'FileDownloaded',
                'FileModified',
                'FileModifiedExtended',
                'FileMoved',
                'FilePreviewed',
                'FileRecycled',
                'FileRenamed',
                'FileSyncDownloadedFull',
                'FileSyncUploadedFull',
                'FileUploaded',
                'FileUploadedPartial',
                'FileVersionsAllDeleted',
                // Sharing operations
                'SharingInvitationCreated',
                'SharingInvitationAccepted',
                'AnonymousLinkCreated',
                'AnonymousLinkUsed',
                'SecureLinkCreated',
                'AddedToSecureLink'
            ]),

            // Sharing operation types (subset of FILE_OPERATIONS)
            SHARING_OPERATIONS: new Set([
                'SharingInvitationCreated',
                'SharingInvitationAccepted',
                'AnonymousLinkCreated',
                'AnonymousLinkUsed',
                'SecureLinkCreated',
                'AddedToSecureLink'
            ])
        };
    },

    mounted() {
        // Vue app is ready
    },

    methods: {
        // Parse AuditData JSON string (equivalent to Python's parse_audit_data)
        parseAuditData(auditDataStr) {
            if (!auditDataStr) return null;

            try {
                return JSON.parse(auditDataStr);
            } catch (error) {
                console.warn('Failed to parse AuditData JSON:', error);
                return null;
            }
        },

        // Extract file info from raw Purview log row (equivalent to Python's extract_file_info)
        extractFileInfo(row) {
            const operation = row.Operation;

            // Filter for tracked operations only (file + sharing)
            if (!operation || !this.FILE_OPERATIONS.has(operation)) {
                return null;
            }

            // Parse AuditData JSON
            const auditData = this.parseAuditData(row.AuditData);
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
            const isSharing = this.SHARING_OPERATIONS.has(operation);
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
        },

        // Parse raw Purview log data (equivalent to Python's process_audit_log)
        parseRawPurviewLog(rawData) {
            console.log('Parsing raw Purview audit log...');
            const normalizedData = [];

            rawData.forEach(row => {
                const fileInfo = this.extractFileInfo(row);
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
        },

        // Detect if CSV is raw Purview log or already-parsed format
        detectCSVFormat(data) {
            if (data.length === 0) return 'unknown';

            const firstRow = data[0];

            // Raw Purview log has: CreationDate, UserId, Operation, AuditData
            const hasRawFields = 'AuditData' in firstRow && 'CreationDate' in firstRow;

            // Parsed format has: file_name, file_path, operation
            const hasParsedFields = 'file_name' in firstRow && 'file_path' in firstRow;

            if (hasRawFields) return 'raw';
            if (hasParsedFields) return 'parsed';
            return 'unknown';
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
                        const csvData = results.data;

                        // Detect CSV format
                        const format = this.detectCSVFormat(csvData);
                        console.log(`Detected CSV format: ${format}`);

                        let normalizedData;

                        if (format === 'raw') {
                            // Parse raw Purview log
                            this.showLoadingMessage('Converting raw Purview log...', `Processing ${csvData.length.toLocaleString()} records`);

                            setTimeout(() => {
                                normalizedData = this.parseRawPurviewLog(csvData);
                                this.processNormalizedData(normalizedData);
                            }, 100);
                        } else if (format === 'parsed') {
                            // Already normalized, use directly
                            normalizedData = csvData;
                            this.processNormalizedData(normalizedData);
                        } else {
                            throw new Error('Unknown CSV format. Expected either raw Purview log or pre-parsed format.');
                        }
                    } catch (error) {
                        this.showError('CSV Parsing Error', error.message);
                    }
                },
                error: (error) => {
                    this.showError('File Read Error', error.message);
                }
            });
        },

        // Process normalized data (extracted to avoid duplication)
        processNormalizedData(normalizedData) {
            try {
                this.rawData = normalizedData;
                this.showLoadingMessage(`Analyzing ${this.rawData.length.toLocaleString()} operations...`, '');

                setTimeout(() => {
                    try {
                        this.reportData = this.analyzeData(this.rawData);

                        // Build aggregated access types for human-readable view
                        this.aggregatedAccessTypesData = this.buildAggregatedAccessTypesData(this.reportData.access_types);

                        this.loading = false;

                        // Use Vue's nextTick to ensure DOM is updated before creating charts
                        this.$nextTick(() => {
                            this.initializeCharts();
                        });
                    } catch (error) {
                        this.showError('Analysis Error', error.message);
                    }
                }, 100);
            } catch (error) {
                this.showError('Processing Error', error.message);
            }
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
                        Upload either a raw Purview audit log CSV or a pre-parsed CSV from parse_purview_audit_log.py
                    </p>
                    <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;">
                        Try Again
                    </button>
                </div>
            `;
        },

        // Analyze CSV data
        analyzeData(data) {
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
                    access_type_distribution: this.aggregateAccessTypes(accessTypes),
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
            this.createTopSitesChart();
            this.createTopUsersChart();
            this.createAccessTypeChart();
            this.createTopApplicationsChart();
            this.createTimelineChart();
        },

        // Create charts
        createTopSitesChart() {
            const ctx = document.getElementById('topSitesChart')?.getContext('2d');
            if (!ctx || !this.reportData) return;

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
        },

        createAccessTypeChart() {
            const ctx = document.getElementById('accessTypeChart')?.getContext('2d');
            if (!ctx || !this.reportData) return;

            // Access type distribution is already aggregated to human-readable format
            const data = this.reportData.executive_summary.access_type_distribution;

            if (this.charts.accessType) this.charts.accessType.destroy();

            // Generate colors dynamically based on number of items
            const colors = this.generateChartColors(data.length);

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
        },

        createTopApplicationsChart() {
            const ctx = document.getElementById('topApplicationsChart')?.getContext('2d');
            if (!ctx || !this.reportData) return;

            const data = this.reportData.applications.slice(0, 10);

            if (this.charts.topApplications) this.charts.topApplications.destroy();

            this.charts.topApplications = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.application),
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
        },

        createTimelineChart() {
            const ctx = document.getElementById('timelineChart')?.getContext('2d');
            if (!ctx || !this.reportData) return;

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
            this.pushNavigationHistory();
            this.siteDetailIndex = index;
        },

        closeSiteDetail() {
            this.siteDetailIndex = null;
        },

        // User drill-down
        showUserDetail(index) {
            this.pushNavigationHistory();
            this.userDetailIndex = index;
        },

        closeUserDetail() {
            this.userDetailIndex = null;
        },

        // Application drill-down
        showApplicationDetail(index) {
            this.pushNavigationHistory();
            this.applicationDetailIndex = index;
        },

        closeApplicationDetail() {
            this.applicationDetailIndex = null;
        },

        // Access Type drill-down
        showAccessTypeDetail(index) {
            this.pushNavigationHistory();
            this.accessTypeDetailIndex = index;
        },

        closeAccessTypeDetail() {
            this.accessTypeDetailIndex = null;
        },

        // Navigation History Management
        pushNavigationHistory() {
            this.navigationHistory.push({
                tab: this.currentTab,
                siteDetailIndex: this.siteDetailIndex,
                userDetailIndex: this.userDetailIndex,
                applicationDetailIndex: this.applicationDetailIndex,
                accessTypeDetailIndex: this.accessTypeDetailIndex
            });
        },

        goBack() {
            if (this.navigationHistory.length > 0) {
                const previous = this.navigationHistory.pop();
                this.currentTab = previous.tab;
                this.siteDetailIndex = previous.siteDetailIndex;
                this.userDetailIndex = previous.userDetailIndex;
                this.applicationDetailIndex = previous.applicationDetailIndex;
                this.accessTypeDetailIndex = previous.accessTypeDetailIndex;
            } else {
                // No history, just close current detail
                this.closeAllDetails();
            }
        },

        closeAllDetails() {
            this.siteDetailIndex = null;
            this.userDetailIndex = null;
            this.applicationDetailIndex = null;
            this.accessTypeDetailIndex = null;
        },

        // Cross-tab navigation methods
        navigateToSite(siteUrl) {
            this.pushNavigationHistory();
            this.closeAllDetails();
            this.currentTab = 'sites';

            // Find the site index by URL
            const index = this.reportData.site_activity.findIndex(s => s.site_url === siteUrl);
            if (index !== -1) {
                this.siteDetailIndex = index;
            }
        },

        navigateToUser(userId) {
            this.pushNavigationHistory();
            this.closeAllDetails();
            this.currentTab = 'users';

            // Find the user index by ID
            const index = this.reportData.user_activity.findIndex(u => u.user_id === userId);
            if (index !== -1) {
                this.userDetailIndex = index;
            }
        },

        navigateToAccessType(accessType) {
            this.pushNavigationHistory();
            this.closeAllDetails();
            this.currentTab = 'access-types';

            // Find the access type index
            const data = this.showHumanReadableAccessTypes.accessTypes
                ? this.aggregatedAccessTypesData
                : this.reportData.access_types;
            const index = data.findIndex(t => t.type === accessType);
            if (index !== -1) {
                this.accessTypeDetailIndex = index;
            }
        },

        navigateToApplication(application) {
            this.pushNavigationHistory();
            this.closeAllDetails();
            this.currentTab = 'applications';

            // Find the application index
            const index = this.reportData.applications.findIndex(a => a.application === application);
            if (index !== -1) {
                this.applicationDetailIndex = index;
            }
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

        // Export Executive Dashboard to PDF
        exportToPDF() {
            // Show loading message
            this.showLoadingMessage('Generating PDF...', 'This may take a moment for large reports');

            // Use setTimeout to allow the loading message to render
            setTimeout(async () => {
                try {
                    // Find the Executive Summary tab content
                    const allTabContents = document.querySelectorAll('.tab-content');
                    let executiveSummaryContent = null;

                    // Get the first tab-content (which is Executive Summary based on the HTML order)
                    allTabContents.forEach((tab, index) => {
                        if (index === 0) {
                            executiveSummaryContent = tab;
                        }
                    });

                    if (!executiveSummaryContent) {
                        throw new Error('Executive Summary content not found');
                    }

                    // Capture the element as a canvas with high quality
                    const canvas = await html2canvas(executiveSummaryContent, {
                        scale: 3,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: executiveSummaryContent.scrollWidth,
                        windowHeight: executiveSummaryContent.scrollHeight,
                        allowTaint: false,
                        removeContainer: true,
                        imageTimeout: 0,
                        foreignObjectRendering: false,
                        onclone: (clonedDoc) => {
                            // Try to preserve CSS filters and properties
                            const clonedElement = clonedDoc.querySelector('.tab-content');
                            if (clonedElement) {
                                clonedElement.style.filter = 'saturate(1)';
                            }
                        }
                    });

                    // Get the canvas dimensions
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;

                    // Convert canvas to JPEG with maximum quality
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);

                    // Create PDF with dimensions that fit the content
                    const pdf = new jspdf.jsPDF({
                        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [imgWidth, imgHeight],
                        compress: false
                    });

                    // Add the image to fill the entire page
                    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');

                    // Save the PDF
                    pdf.save(`Purview_Executive_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);

                    console.log('PDF export complete');
                    this.loading = false;
                } catch (error) {
                    console.error('PDF generation error:', error);
                    this.loading = false;
                    alert('Error generating PDF. Please try again.');
                }
            }, 100);
        },

        // Generate chart colors dynamically
        generateChartColors(count) {
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
        },

        // Utility functions
        formatNumber(num) {
            return num ? num.toLocaleString() : '0';
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
        },

        dateRangeText() {
            if (!this.reportData) return 'Loading report data...';
            const dr = this.reportData.metadata.date_range;
            return `Report Period: ${this.formatDate(dr.start)} to ${this.formatDate(dr.end)} (${dr.days} days)`;
        },

        // Search and Pagination Helpers
        filterBySearch(items, searchQuery, searchField) {
            if (!searchQuery) return items;
            const query = searchQuery.toLowerCase();
            return items.filter(item => {
                const value = item[searchField] || '';
                return value.toLowerCase().includes(query);
            });
        },

        paginateData(items, page, perPage) {
            const start = (page - 1) * perPage;
            const end = start + perPage;
            return {
                items: items.slice(start, end),
                totalPages: Math.ceil(items.length / perPage),
                totalItems: items.length,
                currentPage: page
            };
        },

        renderSearchBox(context, listType) {
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
        },

        renderPaginationControls(context, listType, currentPage, totalPages, totalItems) {
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
        },

        // Map raw access types to human-readable versions
        getHumanReadableAccessType(rawType) {
            // Check if this is a sharing operation first
            if (this.SHARING_OPERATIONS.has(rawType)) {
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

            return type;
        },

        // Aggregate access types into human-readable format
        aggregateAccessTypes(accessTypesArray) {
            const aggregated = {};

            accessTypesArray.forEach(item => {
                const humanReadable = this.getHumanReadableAccessType(item.type);
                if (!aggregated[humanReadable]) {
                    aggregated[humanReadable] = 0;
                }
                aggregated[humanReadable] += item.count;
            });

            return Object.entries(aggregated)
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count);
        },

        // Get the appropriate access types data based on human-readable setting
        getAccessTypesData() {
            return this.showHumanReadableAccessTypes.accessTypes
                ? this.aggregatedAccessTypesData
                : this.reportData.access_types;
        },

        // Build aggregated access types with full detail (users, sites, files, records combined)
        buildAggregatedAccessTypesData(rawAccessTypes) {
            const aggregated = {};

            // Group all raw access types by their human-readable version
            rawAccessTypes.forEach(accessType => {
                const humanReadable = this.getHumanReadableAccessType(accessType.type);

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
        },

        // File tree functions
        buildFileTree(files) {
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
        },

        buildSiteFileTree(fileDetails) {
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
                const siteName = this.extractSiteName(siteUrl);

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
        },

        // Filter file tree based on search query
        filterFileTree(tree, searchQuery) {
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
        },

        // Render search box for file tree
        renderFileTreeSearch(context) {
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
        },

        // Update file search query
        updateFileSearch(context, value) {
            this.searchQueries[context].files = value;
        },

        // Render file tree with search
        renderFileTreeWithSearch(tree, context, parentId = '', fileDetails = []) {
            const searchQuery = this.searchQueries[context].files;
            const filteredTree = this.filterFileTree(tree, searchQuery);

            return `
                ${this.renderFileTreeSearch(context)}
                ${this.renderFileTree(filteredTree, 0, parentId, fileDetails, '')}
            `;
        },

        renderFileTree(tree, level = 0, parentId = '', fileDetails = [], pathPrefix = '') {
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
                                <span>${this.formatNumber(node.operations)} operations</span>
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
                            <span class="tree-file-count">${this.formatNumber(file.operations)} ops</span>
                            <span class="tree-user-icon" onclick="window.vueApp.showUsersForCurrentPath('${filePath.replace(/'/g, "\\'")}', false)" title="Show users">
                                👤
                            </span>
                        </div>
                    `;
                });
            }

            return html;
        },

        toggleTreeNode(nodeId) {
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
        },

        showUsersForCurrentPath(path, isFolder = false) {
            // Use the stored file details from window
            this.showUsersForPath(path, window.currentFileDetails || [], isFolder);
        },

        showUsersForPath(path, fileDetails, isFolder = false) {
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
        },

        // Render main overview tables with search and pagination
        renderSitesOverviewTable() {
            const sites = this.reportData?.site_activity || [];
            if (sites.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No sites found</p>';
            }

            const searchQuery = this.searchQueries.sites.main;
            const filteredSites = searchQuery
                ? sites.filter(s => this.extractSiteName(s.site_url).toLowerCase().includes(searchQuery.toLowerCase()))
                : sites;

            const paginationState = this.pagination.sites.main;
            const paginated = this.paginateData(filteredSites, paginationState.page, paginationState.perPage);

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
                                    <td>${this.extractSiteName(site.site_url)}</td>
                                    <td>${this.formatNumber(site.total_operations)}</td>
                                    <td>${this.formatNumber(site.unique_users)}</td>
                                    <td>${this.formatNumber(site.unique_files)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls('sites', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        },

        renderUsersOverviewTable() {
            const users = this.reportData?.user_activity || [];
            if (users.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No users found</p>';
            }

            const searchQuery = this.searchQueries.users.main;
            const filteredUsers = searchQuery
                ? users.filter(u => u.user_id.toLowerCase().includes(searchQuery.toLowerCase()))
                : users;

            const paginationState = this.pagination.users.main;
            const paginated = this.paginateData(filteredUsers, paginationState.page, paginationState.perPage);

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
                                    <td>${this.formatNumber(user.total_operations)}</td>
                                    <td>${this.formatNumber(user.unique_sites)}</td>
                                    <td>${this.formatNumber(user.unique_files)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls('users', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        },

        renderApplicationsOverviewTable() {
            const applications = this.reportData?.applications || [];
            if (applications.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No applications found</p>';
            }

            const searchQuery = this.searchQueries.applications.main;
            const filteredApps = searchQuery
                ? applications.filter(a => a.application.toLowerCase().includes(searchQuery.toLowerCase()))
                : applications;

            const paginationState = this.pagination.applications.main;
            const paginated = this.paginateData(filteredApps, paginationState.page, paginationState.perPage);

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
                                    <td>${this.formatNumber(app.count)}</td>
                                    <td>${this.formatNumber(app.unique_users)}</td>
                                    <td>${this.formatNumber(app.unique_sites)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls('applications', 'main', paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        },

        // Reusable table rendering functions
        renderUsersTable(users, context, listType = 'users', clickable = false) {
            if (!users || users.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No users found</p>';
            }

            // Apply search filter
            const searchQuery = this.searchQueries[context][listType];
            const filteredUsers = this.filterBySearch(users, searchQuery, 'user');

            // Apply pagination
            const paginationState = this.pagination[context][listType];
            const paginated = this.paginateData(filteredUsers, paginationState.page, paginationState.perPage);

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
                                <td>${this.formatNumber(user.operations)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        },

        renderAccessTypesTable(accessTypes, context, listType = 'accessTypes', showHumanReadable = false, clickable = false) {
            if (!accessTypes || accessTypes.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No access types found</p>';
            }

            // Aggregate to human-readable if requested
            const displayTypes = showHumanReadable ? this.aggregateAccessTypes(accessTypes) : accessTypes;

            // Apply search filter
            const searchQuery = this.searchQueries[context][listType];
            const filteredTypes = this.filterBySearch(displayTypes, searchQuery, 'type');

            // Apply pagination
            const paginationState = this.pagination[context][listType];
            const paginated = this.paginateData(filteredTypes, paginationState.page, paginationState.perPage);

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
                                <td>${this.formatNumber(type.count)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        },

        renderApplicationsTable(applications, context, listType = 'applications', clickable = false) {
            if (!applications || applications.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No applications found</p>';
            }

            // Apply search filter
            const searchQuery = this.searchQueries[context][listType];
            const filteredApps = this.filterBySearch(applications, searchQuery, 'app');

            // Apply pagination
            const paginationState = this.pagination[context][listType];
            const paginated = this.paginateData(filteredApps, paginationState.page, paginationState.perPage);

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
                                <td>${this.formatNumber(app.count)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${this.renderPaginationControls(context, listType, paginated.currentPage, paginated.totalPages, paginated.totalItems)}
            `;
        }
    }
};

// Mount the app and make it globally available for onclick handlers
const app = createApp(vueAppConfig);
const vm = app.mount('#app');
window.vueApp = vm;

// Global helper for PDF export
// Export functionality is now in Vue methods
