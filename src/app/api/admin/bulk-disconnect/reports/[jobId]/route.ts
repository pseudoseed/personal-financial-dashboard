import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Get job details
    const job = await (prisma as any).bulkDisconnectJob.findUnique({
      where: { id: jobId },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (!job.reportPath) {
      return NextResponse.json(
        { error: "No report available for this job" },
        { status: 404 }
      );
    }

    // Check if report file exists
    const fullReportPath = join(process.cwd(), job.reportPath);
    if (!existsSync(fullReportPath)) {
      return NextResponse.json(
        { error: "Report file not found" },
        { status: 404 }
      );
    }

    // Read and return the report file
    const reportContent = readFileSync(fullReportPath, 'utf-8');
    const reportData = JSON.parse(reportContent);

    // Return as JSON with proper headers
    return new NextResponse(reportContent, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bulk-disconnect-job-${jobId}.json"`,
      },
    });

  } catch (error) {
    console.error("[BULK DISCONNECT REPORT] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve report",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 