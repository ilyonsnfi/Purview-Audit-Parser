#!/usr/bin/env python3
"""
Purview Audit Log Parser

This script parses Microsoft Purview audit log CSV files and extracts file access information.
It creates a normalized CSV output with one row per file access event, showing:
- File name and path
- User who accessed the file
- Access type (FileAccessed, FileDownloaded, FilePreviewed, etc.)
- Timestamp of access
- Application used to access the file
- Full file URL

Usage:
    python parse_purview_audit_log.py <input_csv> [output_csv]

Example:
    python parse_purview_audit_log.py audit_log.csv file_access_report.csv
"""

import csv
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional


# File operations that we want to track
FILE_OPERATIONS = {
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
}


def parse_audit_data(audit_data_str: str) -> Optional[Dict]:
    """
    Parse the AuditData JSON string from the CSV.

    Args:
        audit_data_str: JSON string containing audit details

    Returns:
        Dictionary containing parsed JSON data, or None if parsing fails
    """
    try:
        return json.loads(audit_data_str)
    except (json.JSONDecodeError, TypeError) as e:
        # Return None for malformed JSON - we'll skip this row
        return None


def extract_file_info(row: Dict) -> Optional[Dict]:
    """
    Extract relevant file access information from a CSV row.

    Args:
        row: Dictionary containing one row from the CSV

    Returns:
        Dictionary with normalized file access data, or None if not a file operation
    """
    operation = row.get('Operation', '')

    # Skip if not a file operation
    if operation not in FILE_OPERATIONS:
        return None

    # Parse the AuditData JSON field
    audit_data = parse_audit_data(row.get('AuditData', ''))
    if not audit_data:
        return None

    # Extract file-specific fields from audit data
    file_name = audit_data.get('SourceFileName', 'Unknown')
    file_extension = audit_data.get('SourceFileExtension', '')
    file_path = audit_data.get('SourceRelativeUrl', '')
    file_url = audit_data.get('ObjectId', '')
    site_url = audit_data.get('SiteUrl', '')

    # Extract user and access details
    user_id = row.get('UserId', 'Unknown')
    timestamp = row.get('CreationDate', '')

    # Extract application information (how the file was accessed)
    application = audit_data.get('ApplicationDisplayName',
                                  audit_data.get('ClientAppName',
                                  audit_data.get('UserAgent', 'Unknown')))

    # Determine access type context
    platform = audit_data.get('Platform', '')
    workload = audit_data.get('Workload', '')

    # Build a more descriptive access type
    access_type = operation
    if platform and platform != 'NotSpecified':
        access_type = f"{operation} ({platform})"

    return {
        'file_name': file_name,
        'file_extension': file_extension,
        'file_path': file_path,
        'user_id': user_id,
        'access_type': access_type,
        'operation': operation,
        'timestamp': timestamp,
        'application': application,
        'site_url': site_url,
        'file_url': file_url,
        'workload': workload,
    }


def process_audit_log(input_file: Path, output_file: Path) -> None:
    """
    Process the Purview audit log CSV and create a normalized output file.

    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
    """
    # Statistics for reporting
    total_rows = 0
    file_operations = 0
    skipped_rows = 0

    file_access_records: List[Dict] = []

    print(f"Processing audit log: {input_file}")
    print(f"Looking for file operations: {', '.join(sorted(FILE_OPERATIONS))}\n")

    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)

            for row_num, row in enumerate(reader, start=2):  # Start at 2 to account for header
                total_rows += 1

                # Show progress every 10000 rows
                if total_rows % 10000 == 0:
                    print(f"Processed {total_rows:,} rows, found {file_operations:,} file operations...")

                # Extract file information
                file_info = extract_file_info(row)

                if file_info:
                    file_operations += 1
                    file_access_records.append(file_info)
                else:
                    skipped_rows += 1

    except FileNotFoundError:
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)

    # Sort records by file path, then file name, then timestamp
    # This creates a tree-like organization of the output
    print(f"\nSorting {file_operations:,} file operations by path...")
    file_access_records.sort(key=lambda x: (x['file_path'], x['file_name'], x['timestamp']))

    # Write output CSV
    print(f"Writing results to: {output_file}")

    try:
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            if file_access_records:
                fieldnames = [
                    'file_name',
                    'file_extension',
                    'file_path',
                    'user_id',
                    'access_type',
                    'operation',
                    'timestamp',
                    'application',
                    'workload',
                    'site_url',
                    'file_url',
                ]

                writer = csv.DictWriter(outfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(file_access_records)
            else:
                print("Warning: No file operations found in the audit log.")

    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)

    # Print summary
    print("\n" + "="*60)
    print("Processing Complete!")
    print("="*60)
    print(f"Total rows processed:     {total_rows:,}")
    print(f"File operations found:    {file_operations:,}")
    print(f"Non-file rows skipped:    {skipped_rows:,}")
    print(f"Output file:              {output_file}")
    print("="*60)


def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nError: Missing required argument")
        print("\nUsage:")
        print("  python parse_purview_audit_log.py <input_csv> [output_csv]")
        sys.exit(1)

    input_file = Path(sys.argv[1])

    # Generate output filename if not provided
    if len(sys.argv) >= 3:
        output_file = Path(sys.argv[2])
    else:
        # Default: add '_file_access_report' before the extension
        output_file = input_file.parent / f"{input_file.stem}_file_access_report.csv"

    # Validate input file exists
    if not input_file.exists():
        print(f"Error: Input file does not exist: {input_file}")
        sys.exit(1)

    # Warn if output file already exists
    if output_file.exists():
        response = input(f"Warning: Output file already exists: {output_file}\nOverwrite? (y/n): ")
        if response.lower() != 'y':
            print("Aborted.")
            sys.exit(0)

    # Process the audit log
    process_audit_log(input_file, output_file)


if __name__ == '__main__':
    main()
