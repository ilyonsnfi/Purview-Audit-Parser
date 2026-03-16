/* =================================================================
   Purview Audit Report Dashboard - Vue 3 Application
   Main App Configuration and Initialization
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

            // Application View Toggles (true = human-readable, false = raw)
            showHumanReadableApplications: {
                siteActivity: true,
                userActivity: true,
                accessTypes: true,
                applications: true
            },

            // Search and Pagination State
            searchQueries: {
                sites: { main: '' },
                users: { main: '' },
                accessTypes: { main: '', users: '', applications: '', files: '' },
                applications: { main: '', users: '', accessTypes: '', files: '' },
                siteActivity: { users: '', accessTypes: '', applications: '', files: '' },
                userActivity: { accessTypes: '', applications: '', files: '' }
            },
            pagination: {
                sites: { main: { page: 1, perPage: 50 } },
                users: { main: { page: 1, perPage: 50 } },
                accessTypes: {
                    main: { page: 1, perPage: 50 },
                    users: { page: 1, perPage: 20 },
                    applications: { page: 1, perPage: 20 }
                },
                applications: {
                    main: { page: 1, perPage: 50 },
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
            aggregatedAccessTypesData: []
        };
    },

    mounted() {
        // Vue app is ready
    },

    methods: {
        // File handling
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
                        const format = detectCSVFormat(csvData);
                        console.log(`Detected CSV format: ${format}`);

                        let normalizedData;

                        if (format === 'raw') {
                            // Parse raw Purview log
                            this.showLoadingMessage('Converting raw Purview log...', `Processing ${csvData.length.toLocaleString()} records`);

                            setTimeout(() => {
                                normalizedData = parseRawPurviewLog(csvData);
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

        processNormalizedData(normalizedData) {
            try {
                this.rawData = normalizedData;
                this.showLoadingMessage(`Analyzing ${this.rawData.length.toLocaleString()} operations...`, '');

                setTimeout(() => {
                    try {
                        this.reportData = analyzeData(this.rawData);

                        // Build aggregated access types for human-readable view
                        this.aggregatedAccessTypesData = buildAggregatedAccessTypesData(this.reportData.access_types);

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

        showLoadingMessage(message, submessage) {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.innerHTML = `
                <div class="loading-spinner"></div>
                <p>${message}</p>
                ${submessage ? `<p class="loading-note">${submessage}</p>` : ''}
            `;
        },

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

        // Tab navigation
        showTab(tabName) {
            this.currentTab = tabName;
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

        // Helper function for date range text
        dateRangeText() {
            if (!this.reportData) return 'Loading report data...';
            const dr = this.reportData.metadata.date_range;
            return `Report Period: ${formatDate(dr.start)} to ${formatDate(dr.end)} (${dr.days} days)`;
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

        // Import all methods from other modules
        // Utility functions
        formatNumber,
        formatDate,
        extractSiteName,
        generateChartColors,
        getHumanReadableAccessType,
        getHumanReadableApplication,
        aggregateAccessTypes,
        aggregateApplications,
        filterBySearch,
        paginateData,

        // Data processor methods
        parseAuditData,
        extractFileInfo,
        parseRawPurviewLog,
        detectCSVFormat,
        analyzeData,
        buildAggregatedAccessTypesData,

        // Navigation methods
        pushNavigationHistory,
        goBack,
        closeAllDetails,
        navigateToSite,
        navigateToUser,
        navigateToAccessType,
        navigateToApplication,

        // Shared component methods
        renderSearchBox,
        renderPaginationControls,
        buildFileTree,
        buildSiteFileTree,
        filterFileTree,
        renderFileTreeSearch,
        updateFileSearch,
        renderFileTreeWithSearch,
        renderFileTree,
        toggleTreeNode,
        showUsersForCurrentPath,
        showUsersForPath,
        renderUsersTable,
        renderAccessTypesTable,
        renderApplicationsTable,

        // Executive summary methods
        initializeCharts,
        createTopSitesChart,
        createTopUsersChart,
        createAccessTypeChart,
        createTopApplicationsChart,
        createTimelineChart,

        // Site activity methods
        showSiteDetail,
        closeSiteDetail,
        renderSitesOverviewTable,

        // User activity methods
        showUserDetail,
        closeUserDetail,
        renderUsersOverviewTable,

        // Access types methods
        showAccessTypeDetail,
        closeAccessTypeDetail,
        getAccessTypesData,

        // Application methods
        showApplicationDetail,
        closeApplicationDetail,
        renderApplicationsOverviewTable
    }
};

// Mount the app and make it globally available for onclick handlers
const app = createApp(vueAppConfig);
const vm = app.mount('#app');
window.vueApp = vm;
