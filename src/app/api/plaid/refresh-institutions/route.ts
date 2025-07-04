import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";
import { institutionLogos } from "@/lib/institutionLogos";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";

function formatLogoUrl(
  logo: string | null | undefined,
  institutionId: string
): string | null {
  // Removed verbose debug logging

  // First try the Plaid-provided logo
  if (logo) {
    // Check if it's already a data URL or regular URL
    if (logo.startsWith("data:") || logo.startsWith("http")) {
      return logo;
    }
    // Otherwise, assume it's a base64 string and format it as a data URL
    return `data:image/png;base64,${logo}`;
  }

  // If no Plaid logo, try the fallback logo
  const fallbackLogo = institutionLogos[institutionId];
  // Removed verbose debug logging
  return fallbackLogo || null;
}

export async function POST(request: NextRequest) {
  try {
    const { institutionId } = await request.json();

    if (!institutionId) {
      return NextResponse.json(
        { error: "Institution ID is required" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    const appInstanceId = getAppInstanceId();

    // Get updated institution information from Plaid
    const institutionResponse = await trackPlaidApiCall(
      () => plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      }),
      {
        endpoint: '/institutions/get_by_id',
        institutionId,
        userId,
        appInstanceId,
        requestData: { institutionId, countryCodes: [CountryCode.Us] }
      }
    );

    const institution = institutionResponse.data.institution;

    // Update the PlaidItem with new institution information
    await prisma.plaidItem.updateMany({
      where: { institutionId },
      data: {
        institutionName: institution.name ?? null,
        institutionLogo: institution.logo ?? null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Institution information refreshed successfully",
      institution: {
        id: institution.institution_id,
        name: institution.name,
        logo: institution.logo,
      },
    });
  } catch (error) {
    console.error("Error refreshing institution:", error);
    return NextResponse.json(
      { error: "Failed to refresh institution" },
      { status: 500 }
    );
  }
}
