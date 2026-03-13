/* =================================================================
   Navigation - Cross-tab Navigation and History
   ================================================================= */

// Navigation history management functions
// These will be used as Vue methods

function pushNavigationHistory() {
    this.navigationHistory.push({
        tab: this.currentTab,
        siteDetailIndex: this.siteDetailIndex,
        userDetailIndex: this.userDetailIndex,
        applicationDetailIndex: this.applicationDetailIndex,
        accessTypeDetailIndex: this.accessTypeDetailIndex
    });
}

function goBack() {
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
}

function closeAllDetails() {
    this.siteDetailIndex = null;
    this.userDetailIndex = null;
    this.applicationDetailIndex = null;
    this.accessTypeDetailIndex = null;
}

// Cross-tab navigation methods

function navigateToSite(siteUrl) {
    this.pushNavigationHistory();
    this.closeAllDetails();
    this.currentTab = 'sites';

    // Find the site index by URL
    const index = this.reportData.site_activity.findIndex(s => s.site_url === siteUrl);
    if (index !== -1) {
        this.siteDetailIndex = index;
    }
}

function navigateToUser(userId) {
    this.pushNavigationHistory();
    this.closeAllDetails();
    this.currentTab = 'users';

    // Find the user index by ID
    const index = this.reportData.user_activity.findIndex(u => u.user_id === userId);
    if (index !== -1) {
        this.userDetailIndex = index;
    }
}

function navigateToAccessType(accessType) {
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
}

function navigateToApplication(application) {
    this.pushNavigationHistory();
    this.closeAllDetails();
    this.currentTab = 'applications';

    // Find the application index
    const index = this.reportData.applications.findIndex(a => a.application === application);
    if (index !== -1) {
        this.applicationDetailIndex = index;
    }
}
