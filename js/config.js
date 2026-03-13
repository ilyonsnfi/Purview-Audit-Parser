/* =================================================================
   Configuration - Constants and Settings
   ================================================================= */

// Operations we track (file operations + sharing operations)
const FILE_OPERATIONS = new Set([
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
]);

// Sharing operation types (subset of FILE_OPERATIONS)
const SHARING_OPERATIONS = new Set([
    'SharingInvitationCreated',
    'SharingInvitationAccepted',
    'AnonymousLinkCreated',
    'AnonymousLinkUsed',
    'SecureLinkCreated',
    'AddedToSecureLink'
]);
