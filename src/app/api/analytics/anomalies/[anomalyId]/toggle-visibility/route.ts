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
    console.error('Error toggling anomaly visibility:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to toggle anomaly visibility' }, { status: 500 });
  }
} 