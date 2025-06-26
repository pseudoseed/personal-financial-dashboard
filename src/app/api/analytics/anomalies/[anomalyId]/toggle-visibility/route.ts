import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anomalyId: string }> }
) {
  try {
    const { anomalyId } = await params;
    const { isHidden } = await request.json();

    // Update the anomaly result
    const updatedAnomaly = await (prisma as any).anomalyDetectionResult.update({
      where: { id: anomalyId },
      data: { isHidden },
    });

    return NextResponse.json({ success: true, anomaly: updatedAnomaly });
  } catch (error) {
    const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    console.log('Error toggling anomaly visibility:', {
      message: errorMessage,
      errorType: error ? typeof error : 'null/undefined'
    });
    return NextResponse.json({ error: 'Failed to toggle anomaly visibility' }, { status: 500 });
  }
} 