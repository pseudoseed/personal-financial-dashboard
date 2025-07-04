import { NextRequest, NextResponse } from 'next/server';
import { initializeStartupBackup, isStartupBackupCompleted } from '@/lib/startupBackup';

// Global flag to track if backup has been attempted in this server instance
let backupAttempted = false;

export async function GET(request: NextRequest) {
  try {
    // Check if backup has already been completed
    if (isStartupBackupCompleted()) {
      return NextResponse.json({
        success: true,
        message: 'Startup backup already completed',
        completed: true,
        attempted: backupAttempted,
      });
    }

    // Mark as attempted
    backupAttempted = true;

    // Run the startup backup
    await initializeStartupBackup();

    return NextResponse.json({
      success: true,
      message: 'Startup backup completed successfully',
      completed: true,
      attempted: backupAttempted,
    });

  } catch (error) {
    console.error('[API] Startup backup error:', error);
    backupAttempted = true;
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to complete startup backup',
        error: error instanceof Error ? error.message : 'Unknown error',
        attempted: backupAttempted,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { force = false } = body;

    // If force is true, reset the completion status
    if (force) {
      const { resetStartupBackupStatus } = await import('@/lib/startupBackup');
      resetStartupBackupStatus();
      backupAttempted = false;
    }

    // Check if backup has already been completed
    if (isStartupBackupCompleted()) {
      return NextResponse.json({
        success: true,
        message: 'Startup backup already completed',
        completed: true,
        attempted: backupAttempted,
      });
    }

    // Mark as attempted
    backupAttempted = true;

    // Run the startup backup
    await initializeStartupBackup();

    return NextResponse.json({
      success: true,
      message: 'Startup backup completed successfully',
      completed: true,
      attempted: backupAttempted,
    });

  } catch (error) {
    console.error('[API] Startup backup error:', error);
    backupAttempted = true;
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to complete startup backup',
        error: error instanceof Error ? error.message : 'Unknown error',
        attempted: backupAttempted,
      },
      { status: 500 }
    );
  }
} 