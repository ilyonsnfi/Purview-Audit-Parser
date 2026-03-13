/* =================================================================
   Access Types Tab - Access Type Overview and Details
   ================================================================= */

// Show access type detail (drill-down)
function showAccessTypeDetail(index) {
    this.pushNavigationHistory();
    this.accessTypeDetailIndex = index;
}

// Close access type detail
function closeAccessTypeDetail() {
    this.accessTypeDetailIndex = null;
}

// Get the appropriate access types data based on human-readable setting
function getAccessTypesData() {
    return this.showHumanReadableAccessTypes.accessTypes
        ? this.aggregatedAccessTypesData
        : this.reportData.access_types;
}
