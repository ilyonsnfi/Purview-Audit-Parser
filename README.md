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
   FileAccessed, FileAccessedExtended, FileDeleted, FileDownloaded, FileModified, FileModifiedExtended, FileMoved, FilePreviewed, FileRecycled, FileRenamed, FileSyncDownloadedFull, FileSyncUploadedFull, FileUploaded, FileUploadedPartial, FileVersionsAllDeleted
   ```
5. **Click "Workload"** dropdown → Search for and select "SharePoint"
6. Click **Search**, wait for results
7. Click **Export** → Download the CSV

Note: this process can take hours, depending on the size of your search.

### Step 2: Parse the CSV

```bash
python parse_purview_audit_log.py your_export.csv
```

Creates `your_export_file_access_report.csv` with clean file operations data.

### Step 3: View Dashboard

Double click the `dashboard.html` file, or from the terminal of your choice run
```bash
open dashboard.html  # macOS
start dashboard.html  # Windows
```

Click **"Select CSV file"** → choose the `_file_access_report.csv` file.

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
- Pagination (20, 100, All)
- Search for sites/users/files
- Click 👤 icons to see who accessed files/folders
- Sort tables by any column

## Requirements

- Python 3.6+ (no libraries needed)
- Modern browser
- Purview access (Audit Logs role)

## Example

```bash
# You exported: audit_feb_2025.csv

python parse_purview_audit_log.py audit_feb_2025.csv
# Creates: audit_feb_2025_file_access_report.csv

open dashboard.html
# Load the CSV in browser
```

## Tracked Operations

FileAccessed, FileDownloaded, FileModified, FileUploaded, FileDeleted, FileMoved, FileRenamed, FilePreviewed, FileRecycled, FileSyncDownloadedFull, FileSyncUploadedFull, FileAccessedExtended, FileModifiedExtended, FileUploadedPartial, FileVersionsAllDeleted

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
