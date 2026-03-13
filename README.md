# Purview Audit Log Analyzer

Analyze Microsoft Purview audit logs and visualize SharePoint file activity.

**Use it for:** Security audits, compliance reviews, user activity analysis, unusual file access investigation.

## Quick Start

### Step 1: Export from Purview

1. Go to https://compliance.microsoft.com/auditlogsearch
2. Select your date range (1-3 months recommended)
3. **Click "Record type"** dropdown → Select **only** "SharePoint file operations"
4. **Click "Activities"** dropdown → Paste this entire list:
   ```
   FileAccessed, FileAccessedExtended, FileDeleted, FileDownloaded, FileModified, FileModifiedExtended, FileMoved, FilePreviewed, FileRecycled, FileRenamed, FileSyncDownloadedFull, FileSyncUploadedFull, FileUploaded, FileUploadedPartial, FileVersionsAllDeleted, SharingInvitationCreated, SharingInvitationAccepted, AnonymousLinkCreated, AnonymousLinkUsed, SecureLinkCreated, AddedToSecureLink
   ```
5. **Click "Workload"** dropdown → Search for and select "SharePoint"
6. Click **Search**, wait for results
7. Click **Export** → Download the CSV
* Note: Purview limits exports to 50k rows of data with a Standard plan, and 100k rows of data with a Premium plan. Consider small batches to capture all the data.

Note: this process can take hours, depending on the size of your search.

### Step 2: View Dashboard

View the dashboard at https://ilyonsnfi.github.io/Purview-Audit-Parser/

Click **"Select CSV file"** → choose the `.csv` file you exported from Purview

Done! 🎉

## Dashboard Views

- **Executive Summary**: Key metrics, top 10 sites/users, access type distribution
- **Site Activity**: All sites with operations, drill-down to files in tree view
- **User Activity**: Complete user profiles, which files they accessed
- **Access Types**: What operations are happening (downloads, edits, views)
- **Applications**: Which apps access files (Office, OneDrive, etc.)
- **Timeline**: Daily activity trends

### Key Features

- File tree view with folder aggregation
- Search for sites/users/files
- Click 👤 icons to see who accessed files/folders
- Sort tables by any column

## Tracked Operations

FileAccessed, FileDownloaded, FileModified, FileUploaded, FileDeleted, FileMoved, FileRenamed, FilePreviewed, FileRecycled, FileSyncDownloadedFull, FileSyncUploadedFull, FileAccessedExtended, FileModifiedExtended, FileUploadedPartial, FileVersionsAllDeleted, SharingInvitationCreated, SharingInvitationAccepted, AnonymousLinkCreated, AnonymousLinkUsed, SecureLinkCreated, AddedToSecureLink

### What are these File Operations?
See Microsoft's documentation [here](https://learn.microsoft.com/en-us/purview/audit-log-activities#file-and-page-activities)

### Who are these random users? (app@sharepoint, SHAREPOINT\system)
https://learn.microsoft.com/en-us/purview/audit-log-detailed-properties

## Troubleshooting

**"No file operations found"**
Your Purview export didn't include file operations. Check your filters in Step 1.

**Dashboard won't load CSV**
Use the "Select CSV file" button, don't try to drag/drop or use URLs.

**Getting 90% skipped rows**
Normal if you didn't filter during export. The parser filters automatically.

**Parser error**
Ensure your CSV is from Purview compliance center, unmodified.

## Tips

- Use filters during export (saves 90% download time)
- Keep date ranges to 1-3 months
- Name files with date ranges: `audit_2025_feb.csv`
- Start with Executive Summary, then drill down

## Privacy

All processing happens locally. No data leaves your machine. No tracking. Works 100% offline.

## Documentation

- **PURVIEW_EXPORT_GUIDE.md**: Detailed export instructions with troubleshooting
- **download_audit_logs.py**: Advanced API automation (optional, requires Azure AD setup)

---

Export → Parse → Analyze. That's it.
