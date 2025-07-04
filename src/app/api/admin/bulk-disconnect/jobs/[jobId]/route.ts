import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Get job details with results
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

    return NextResponse.json({
      id: job.id,
      createdAt: job.createdAt,
      totalTokens: job.totalTokens,
      successCount: job.successCount,
      failureCount: job.failureCount,
      status: job.status,
      reportPath: job.reportPath,
      results: job.results.map((result: any) => ({
        id: result.id,
        accessToken: result.accessToken,
        institutionId: result.institutionId,
        institutionName: result.institutionName,
        success: result.success,
        errorMessage: result.errorMessage,
        retryCount: result.retryCount,
        createdAt: result.createdAt,
      })),
    });

  } catch (error) {
    console.error("[BULK DISCONNECT JOB DETAILS] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch job details",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 