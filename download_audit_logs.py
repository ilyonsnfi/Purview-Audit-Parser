#!/usr/bin/env python3
### This script was never finished. DO NOT USE
"""
Purview Audit Log Downloader

This script uses Microsoft Graph and Office 365 Management Activity API to automatically:
1. Authenticate using delegated permissions (browser login)
2. Start a Purview audit search for SharePoint file operations
3. Poll for search completion
4. Download the results as CSV
5. Optionally run the parser automatically

Usage:
    # Download last 7 days
    python download_audit_logs.py --days 7

    # Download specific date range
    python download_audit_logs.py --start 2025.03.01 --end 2025.03.09

    # Download and auto-parse
    python download_audit_logs.py --days 30 --parse

    # Just authenticate and test
    python download_audit_logs.py --test
"""

import argparse
import json
import sys
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict
import requests

try:
    from msal import PublicClientApplication
except ImportError:
    print("Error: msal library not found. Install it with:")
    print("  pip install msal requests")
    sys.exit(1)


# Azure AD App Configuration
# You'll need to create an app registration and fill these in
CLIENT_ID = ""  # Your Azure AD app client ID
TENANT_ID = ""  # Your tenant ID (or "common" for multi-tenant)



# API Endpoints
MANAGEMENT_API_BASE = "https://manage.office.com/api/v1.0"
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

# Required API permissions (for reference - set in Azure AD)
SCOPES = [
    "https://manage.office.com/ActivityFeed.Read",  # Office 365 Management API
    # Note: offline_access is automatically handled by MSAL, don't add it explicitly
]

# File operations we want to track (matching your parser)
FILE_OPERATIONS = [
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
]

# Cache file for tokens
TOKEN_CACHE_FILE = Path.home() / ".purview_audit_token_cache.json"


class AuditLogDownloader:
    """Handles authentication and audit log downloading from Office 365."""

    def __init__(self, client_id: str, tenant_id: str):
        """Initialize the downloader with Azure AD app credentials."""
        self.client_id = client_id
        self.tenant_id = tenant_id
        self.app = None
        self.access_token = None
        self._init_msal_app()

    def _init_msal_app(self):
        """Initialize MSAL public client application with token cache."""
        cache = self._load_token_cache()

        self.app = PublicClientApplication(
            client_id=self.client_id,
            authority=f"https://login.microsoftonline.com/{self.tenant_id}",
            token_cache=cache
        )

    def _load_token_cache(self):
        """Load cached tokens from disk if available."""
        from msal import SerializableTokenCache
        cache = SerializableTokenCache()

        if TOKEN_CACHE_FILE.exists():
            with open(TOKEN_CACHE_FILE, 'r') as f:
                cache.deserialize(f.read())

        return cache

    def _save_token_cache(self):
        """Save token cache to disk."""
        if self.app and self.app.token_cache.has_state_changed:
            with open(TOKEN_CACHE_FILE, 'w') as f:
                f.write(self.app.token_cache.serialize())
            TOKEN_CACHE_FILE.chmod(0o600)  # Restrict permissions

    def authenticate(self) -> bool:
        """
        Authenticate using device flow (browser-based login).

        Returns:
            True if authentication successful, False otherwise
        """
        print("Authenticating to Microsoft 365...")

        # Try to get token silently first (from cache)
        accounts = self.app.get_accounts()
        if accounts:
            print(f"Found cached account: {accounts[0]['username']}")
            result = self.app.acquire_token_silent(SCOPES, account=accounts[0])
            if result and 'access_token' in result:
                self.access_token = result['access_token']
                print("✓ Authenticated using cached token")
                return True

        # Need interactive authentication
        print("\nOpening browser for authentication...")
        print("Please log in with your Microsoft 365 account.\n")

        # Use interactive browser-based authentication
        result = self.app.acquire_token_interactive(
            scopes=SCOPES,
            prompt="select_account"
        )

        if 'access_token' in result:
            self.access_token = result['access_token']
            self._save_token_cache()
            print("✓ Authentication successful!")
            return True
        else:
            error = result.get('error_description', result.get('error', 'Unknown error'))
            print(f"✗ Authentication failed: {error}")
            return False

    def _api_request(self, method: str, url: str, **kwargs) -> Optional[requests.Response]:
        """Make an authenticated API request."""
        if not self.access_token:
            raise Exception("Not authenticated. Call authenticate() first.")

        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {self.access_token}'
        headers['Accept'] = 'application/json'

        try:
            response = requests.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as e:
            print(f"API request failed: {e}")
            if response.status_code == 401:
                print("Token expired. Please re-run to authenticate.")
            elif response.status_code == 403:
                print("Permission denied. Check your API permissions in Azure AD.")
            print(f"Response: {response.text}")
            return None

    def start_subscription(self, content_type: str = "Audit.SharePoint") -> bool:
        """
        Start a subscription to the audit content feed.

        Args:
            content_type: Type of content (Audit.SharePoint, Audit.Exchange, etc.)

        Returns:
            True if subscription started or already exists
        """
        print(f"Starting subscription to {content_type}...")

        url = f"{MANAGEMENT_API_BASE}/{self.tenant_id}/activity/feed/subscriptions/start?contentType={content_type}"

        response = self._api_request('POST', url)
        if response:
            print(f"✓ Subscription active for {content_type}")
            return True

        return False

    def list_available_content(self, start_time: datetime, end_time: datetime,
                               content_type: str = "Audit.SharePoint") -> List[Dict]:
        """
        List available audit content blobs for a time range.

        Note: The API requires requests to be 24 hours or less, so this method
        automatically breaks larger ranges into 24-hour chunks.

        Args:
            start_time: Start of date range
            end_time: End of date range
            content_type: Type of content to retrieve

        Returns:
            List of content blob metadata
        """
        print(f"\nListing available content from {start_time.date()} to {end_time.date()}...")

        all_content_blobs = []
        current_start = start_time

        # Break into 24-hour chunks (API constraint)
        while current_start < end_time:
            # Calculate end of this chunk (24 hours from start, or end_time if sooner)
            current_end = min(current_start + timedelta(hours=24), end_time)

            # Format times in ISO 8601 format
            start_str = current_start.strftime('%Y-%m-%dT%H:%M:%S')
            end_str = current_end.strftime('%Y-%m-%dT%H:%M:%S')

            print(f"  Requesting {current_start.date()} {current_start.strftime('%H:%M')} to {current_end.date()} {current_end.strftime('%H:%M')}...")

            url = (f"{MANAGEMENT_API_BASE}/{self.tenant_id}/activity/feed/subscriptions/content"
                   f"?contentType={content_type}&startTime={start_str}&endTime={end_str}")

            response = self._api_request('GET', url)
            if response:
                blobs = response.json()
                all_content_blobs.extend(blobs)
                print(f"    ✓ Found {len(blobs)} content blobs")
            else:
                print(f"    ✗ Failed to retrieve content for this period")

            # Move to next 24-hour chunk
            current_start = current_end

        print(f"\n✓ Total content blobs found: {len(all_content_blobs)}")
        return all_content_blobs

    def download_content_blob(self, content_uri: str) -> Optional[List[Dict]]:
        """
        Download a single content blob.

        Args:
            content_uri: URI of the content blob

        Returns:
            List of audit records
        """
        response = self._api_request('GET', content_uri)
        if not response:
            return None

        return response.json()

    def download_audit_logs(self, start_time: datetime, end_time: datetime,
                           output_file: Optional[Path] = None) -> Optional[Path]:
        """
        Download audit logs for a date range and save as CSV.

        Args:
            start_time: Start of date range
            end_time: End of date range
            output_file: Optional output file path

        Returns:
            Path to saved CSV file, or None if failed
        """
        # Ensure subscription is active
        if not self.start_subscription("Audit.SharePoint"):
            return None

        # List available content
        content_blobs = self.list_available_content(start_time, end_time)

        if not content_blobs:
            print("No audit data available for this date range.")
            print("Note: Audit data may take 24-48 hours to become available.")
            return None

        # Download all content blobs
        print(f"\nDownloading {len(content_blobs)} content blobs...")
        all_records = []

        for i, blob in enumerate(content_blobs, 1):
            print(f"  Downloading blob {i}/{len(content_blobs)}...", end='\r')
            records = self.download_content_blob(blob['contentUri'])
            if records:
                all_records.extend(records)

        print(f"\n✓ Downloaded {len(all_records):,} total audit records")

        # Filter for file operations only
        print("Filtering for file operations...")
        file_records = [r for r in all_records if r.get('Operation') in FILE_OPERATIONS]
        print(f"✓ Found {len(file_records):,} file operation records ({len(all_records) - len(file_records):,} non-file records filtered out)")

        if not file_records:
            print("No file operations found in this date range.")
            return None

        # Generate output filename if not provided
        if not output_file:
            start_str = start_time.strftime('%Y%m%d')
            end_str = end_time.strftime('%Y%m%d')
            output_file = Path(f"audit_log_{start_str}_to_{end_str}.csv")

        # Save to CSV (matching Purview export format)
        print(f"\nSaving to {output_file}...")
        self._save_as_csv(file_records, output_file)

        print(f"✓ Saved {len(file_records):,} records to {output_file}")
        return output_file

    def _save_as_csv(self, records: List[Dict], output_file: Path):
        """
        Save audit records to CSV in Purview export format.

        Args:
            records: List of audit record dictionaries
            output_file: Path to output CSV file
        """
        # Purview CSV columns (matching what the parser expects)
        fieldnames = [
            'CreationDate',
            'UserId',
            'Operation',
            'AuditData',
            'ResultStatus',
            'ObjectId',
            'UserType',
            'ItemType',
            'UserAgent',
            'AuditData'
        ]

        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for record in records:
                # Convert the entire record to JSON for AuditData column
                # (parser expects JSON in AuditData field)
                row = {
                    'CreationDate': record.get('CreationTime', ''),
                    'UserId': record.get('UserId', ''),
                    'Operation': record.get('Operation', ''),
                    'AuditData': json.dumps(record),  # Full record as JSON
                    'ResultStatus': record.get('ResultStatus', ''),
                    'ObjectId': record.get('ObjectId', ''),
                    'UserType': record.get('UserType', ''),
                    'ItemType': record.get('ItemType', ''),
                    'UserAgent': record.get('UserAgent', ''),
                }
                writer.writerow(row)


def parse_date(date_str: str) -> datetime:
    """Parse a date string in yyyy.MM.dd format."""
    try:
        return datetime.strptime(date_str, '%Y.%m.%d')
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Invalid date format: {date_str}. Use yyyy.MM.dd (e.g., 2025.03.01)"
        )


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Download Microsoft Purview audit logs for SharePoint file operations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download last 7 days
  python download_audit_logs.py --days 7

  # Download specific date range
  python download_audit_logs.py --start 2025.03.01 --end 2025.03.09

  # Download and auto-parse
  python download_audit_logs.py --days 30 --parse

  # Test authentication
  python download_audit_logs.py --test
        """
    )

    # Date range options
    date_group = parser.add_mutually_exclusive_group(required=True)
    date_group.add_argument('--days', type=int,
                           help='Download last N days of logs')
    date_group.add_argument('--start', type=parse_date, metavar='YYYY.MM.DD',
                           help='Start date (requires --end)')
    date_group.add_argument('--test', action='store_true',
                           help='Test authentication only')

    parser.add_argument('--end', type=parse_date, metavar='YYYY.MM.DD',
                       help='End date (requires --start)')

    # Output options
    parser.add_argument('-o', '--output', type=Path,
                       help='Output CSV file path (default: auto-generated)')
    parser.add_argument('--parse', action='store_true',
                       help='Automatically run parser after download')

    args = parser.parse_args()

    # Validate date arguments
    if args.start and not args.end:
        parser.error("--start requires --end")
    if args.end and not args.start:
        parser.error("--end requires --start")

    # Check configuration
    if not CLIENT_ID or not TENANT_ID:
        print("Error: CLIENT_ID and TENANT_ID not configured.")
        print("\nPlease edit this script and fill in:")
        print("  CLIENT_ID = 'your-app-client-id'")
        print("  TENANT_ID = 'your-tenant-id'")
        print("\nSee SETUP_INSTRUCTIONS.md for details on creating an Azure AD app.")
        sys.exit(1)

    # Initialize downloader
    downloader = AuditLogDownloader(CLIENT_ID, TENANT_ID)

    # Authenticate
    if not downloader.authenticate():
        sys.exit(1)

    # Test mode - just authenticate and exit
    if args.test:
        print("\n✓ Authentication test successful!")
        print("You can now download audit logs.")
        sys.exit(0)

    # Calculate date range
    if args.days:
        end_time = datetime.now()
        start_time = end_time - timedelta(days=args.days)
    else:
        start_time = args.start
        end_time = args.end

    # Ensure end_time is end of day
    end_time = end_time.replace(hour=23, minute=59, second=59)

    print(f"\n{'='*60}")
    print(f"Downloading audit logs")
    print(f"{'='*60}")
    print(f"Date range: {start_time.date()} to {end_time.date()}")
    print(f"Operations: {len(FILE_OPERATIONS)} file operations")
    print(f"{'='*60}\n")

    # Download logs
    output_file = downloader.download_audit_logs(start_time, end_time, args.output)

    if not output_file:
        print("\n✗ Failed to download audit logs")
        sys.exit(1)

    print(f"\n{'='*60}")
    print("Download Complete!")
    print(f"{'='*60}")
    print(f"Output file: {output_file}")
    print(f"{'='*60}")

    # Optionally run parser
    if args.parse:
        parser_script = Path(__file__).parent / "parse_purview_audit_log.py"
        if not parser_script.exists():
            print(f"\nWarning: Parser not found at {parser_script}")
            print("Run manually: python parse_purview_audit_log.py", output_file)
        else:
            print("\nRunning parser...")
            import subprocess
            result = subprocess.run([sys.executable, str(parser_script), str(output_file)])
            if result.returncode == 0:
                print("\n✓ Parsing complete!")


if __name__ == '__main__':
    main()
