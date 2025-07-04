import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { 
  backupAllPlaidItems, 
  getBackupStats, 
  listBackupFiles, 
  cleanupOldBackups 
} from "@/lib/accessTokenBackup";

export async function GET() {
  try {
    // Get current backup stats
    const stats = getBackupStats();
    
    // List all backup files
    const backupFiles = listBackupFiles();
    
    return NextResponse.json({
      currentBackup: stats,
      backupFiles,
      totalBackupFiles: backupFiles.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    console.error("Error getting backup info:", {
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: "Failed to get backup information" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Perform full backup
    const result = await backupAllPlaidItems(prisma);
    
    // Clean up old backups
    const cleanupResult = cleanupOldBackups();
    
    return NextResponse.json({
      backup: result,
      cleanup: cleanupResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    console.error("Error performing backup:", {
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: "Failed to perform backup" },
      { status: 500 }
    );
  }
} 