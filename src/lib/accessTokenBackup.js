const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

/**
 * Get the backup directory path
 */
function getBackupDirectory() {
  const backupDir = join(process.cwd(), 'backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Get the current backup file path
 */
function getCurrentBackupFilePath() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupDir = getBackupDirectory();
  return join(backupDir, `access-tokens-${today}.csv`);
}

/**
 * Read existing backup entries to avoid duplicates
 */
function readExistingBackupEntries(backupFile) {
  if (!existsSync(backupFile)) {
    return new Set();
  }

  try {
    const content = readFileSync(backupFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header line
    if (lines.length <= 1) {
      return new Set();
    }

    const existingTokens = new Set();
    for (let i = 1; i < lines.length; i++) { // Start from 1 to skip header
      const line = lines[i];
      const columns = line.split(',');
      if (columns.length >= 1) {
        const accessToken = columns[0].replace(/"/g, ''); // Remove quotes
        existingTokens.add(accessToken);
      }
    }
    
    return existingTokens;
  } catch (error) {
    console.error('Error reading existing backup file:', error);
    return new Set();
  }
}

/**
 * Convert PlaidItem to backup entry
 */
function plaidItemToBackupEntry(plaidItem) {
  return {
    access_token: plaidItem.accessToken,
    institution_id: plaidItem.institutionId,
    institution_name: plaidItem.institutionName,
    plaid_item_id: plaidItem.id,
    item_id: plaidItem.itemId,
    status: plaidItem.status,
    created_at: plaidItem.createdAt.toISOString(),
    updated_at: plaidItem.updatedAt.toISOString(),
    provider: plaidItem.provider,
    user_id: 'default', // Since we're using default user for now
    backup_timestamp: new Date().toISOString(),
  };
}

/**
 * Convert backup entry to CSV line
 */
function backupEntryToCsvLine(entry) {
  return [
    `"${entry.access_token}"`,
    `"${entry.institution_id}"`,
    `"${entry.institution_name || ''}"`,
    `"${entry.plaid_item_id}"`,
    `"${entry.item_id}"`,
    `"${entry.status}"`,
    `"${entry.created_at}"`,
    `"${entry.updated_at}"`,
    `"${entry.provider}"`,
    `"${entry.user_id}"`,
    `"${entry.backup_timestamp}"`,
  ].join(',');
}

/**
 * Get CSV header
 */
function getCsvHeader() {
  return 'access_token,institution_id,institution_name,plaid_item_id,item_id,status,created_at,updated_at,provider,user_id,backup_timestamp';
}

/**
 * Backup a single PlaidItem (only if not already backed up)
 */
async function backupPlaidItem(plaidItem) {
  try {
    const backupFile = getCurrentBackupFilePath();
    const existingTokens = readExistingBackupEntries(backupFile);
    
    // CRITICAL: Never overwrite existing access tokens
    if (existingTokens.has(plaidItem.accessToken)) {
      return {
        success: true,
        message: `Access token already backed up - preserving existing data`,
        entriesAdded: 0,
        totalEntries: existingTokens.size,
        backupFile,
      };
    }

    const entry = plaidItemToBackupEntry(plaidItem);
    const csvLine = backupEntryToCsvLine(entry);
    
    // Create file with header if it doesn't exist
    const fileExists = existsSync(backupFile);
    const content = fileExists ? `\n${csvLine}` : `${getCsvHeader()}\n${csvLine}`;
    
    // Append to file (atomic write)
    const tempFile = `${backupFile}.tmp`;
    writeFileSync(tempFile, content, { flag: fileExists ? 'a' : 'w' });
    
    // Atomic rename
    if (!fileExists) {
      // If new file, just rename temp to final
      writeFileSync(backupFile, content);
    } else {
      // If existing file, append to it
      writeFileSync(backupFile, `\n${csvLine}`, { flag: 'a' });
    }
    
    console.log(`[BACKUP] Added access token for ${plaidItem.institutionName || plaidItem.institutionId} to backup`);
    
    return {
      success: true,
      message: `Successfully backed up access token for ${plaidItem.institutionName || plaidItem.institutionId}`,
      entriesAdded: 1,
      totalEntries: existingTokens.size + 1,
      backupFile,
    };
  } catch (error) {
    console.error('[BACKUP] Error backing up PlaidItem:', error);
    return {
      success: false,
      message: `Failed to backup access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      entriesAdded: 0,
      totalEntries: 0,
      backupFile: getCurrentBackupFilePath(),
    };
  }
}

/**
 * Backup all PlaidItems from database
 */
async function backupAllPlaidItems(prisma) {
  try {
    const plaidItems = await prisma.plaidItem.findMany();
    const backupFile = getCurrentBackupFilePath();
    const existingTokens = readExistingBackupEntries(backupFile);
    
    let entriesAdded = 0;
    let errors = 0;
    
    for (const plaidItem of plaidItems) {
      try {
        // CRITICAL: Never overwrite existing access tokens
        if (existingTokens.has(plaidItem.accessToken)) {
          continue; // Skip if already backed up
        }
        
        const result = await backupPlaidItem(plaidItem);
        if (result.success) {
          entriesAdded++;
          existingTokens.add(plaidItem.accessToken);
        } else {
          errors++;
        }
      } catch (error) {
        console.error(`[BACKUP] Error backing up PlaidItem ${plaidItem.id}:`, error);
        errors++;
      }
    }
    
    return {
      success: errors === 0,
      message: `Backup completed: ${entriesAdded} new entries added, ${errors} errors`,
      entriesAdded,
      totalEntries: existingTokens.size,
      backupFile,
    };
  } catch (error) {
    console.error('[BACKUP] Error in backupAllPlaidItems:', error);
    return {
      success: false,
      message: `Failed to backup all PlaidItems: ${error instanceof Error ? error.message : 'Unknown error'}`,
      entriesAdded: 0,
      totalEntries: 0,
      backupFile: getCurrentBackupFilePath(),
    };
  }
}

/**
 * Get backup statistics
 */
function getBackupStats() {
  const backupFile = getCurrentBackupFilePath();
  const exists = existsSync(backupFile);
  
  if (!exists) {
    return {
      backupFile,
      exists: false,
      entryCount: 0,
    };
  }
  
  try {
    const content = readFileSync(backupFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const entryCount = Math.max(0, lines.length - 1); // Subtract header
    
    const stats = require('fs').statSync(backupFile);
    
    return {
      backupFile,
      exists: true,
      entryCount,
      lastModified: stats.mtime,
    };
  } catch (error) {
    console.error('[BACKUP] Error getting backup stats:', error);
    return {
      backupFile,
      exists: true,
      entryCount: 0,
    };
  }
}

/**
 * List all backup files
 */
function listBackupFiles() {
  const backupDir = getBackupDirectory();
  const files = [];
  
  try {
    const fs = require('fs');
    const backupFiles = fs.readdirSync(backupDir)
      .filter((file) => file.startsWith('access-tokens-') && file.endsWith('.csv'))
      .sort()
      .reverse(); // Most recent first
    
    for (const file of backupFiles) {
      const filePath = join(backupDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const entryCount = Math.max(0, lines.length - 1); // Subtract header
      
      files.push({
        filename: file,
        date: file.replace('access-tokens-', '').replace('.csv', ''),
        size: stats.size,
        entryCount,
      });
    }
  } catch (error) {
    console.error('[BACKUP] Error listing backup files:', error);
  }
  
  return files;
}

/**
 * Clean up old backup files (keep last 30 days)
 */
function cleanupOldBackups() {
  try {
    const backupFiles = listBackupFiles();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let filesRemoved = 0;
    const fs = require('fs');
    
    for (const file of backupFiles) {
      const fileDate = new Date(file.date);
      if (fileDate < thirtyDaysAgo) {
        const filePath = join(getBackupDirectory(), file.filename);
        fs.unlinkSync(filePath);
        filesRemoved++;
        console.log(`[BACKUP] Removed old backup file: ${file.filename}`);
      }
    }
    
    return {
      success: true,
      message: `Cleaned up ${filesRemoved} old backup files`,
      filesRemoved,
    };
  } catch (error) {
    console.error('[BACKUP] Error cleaning up old backups:', error);
    return {
      success: false,
      message: `Failed to clean up old backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      filesRemoved: 0,
    };
  }
}

module.exports = {
  backupPlaidItem,
  backupAllPlaidItems,
  getBackupStats,
  listBackupFiles,
  cleanupOldBackups,
}; 