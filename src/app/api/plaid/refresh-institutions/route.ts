import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";
import { institutionLogos } from "@/lib/institutionLogos";

function formatLogoUrl(
  logo: string | null | undefined,
  institutionId: string
): string | null {
  console.log(`Formatting logo for institution ${institutionId}:`, {
    plaidLogo: logo,
    fallbackLogo: institutionLogos[institutionId],
  });

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
  console.log(`Using fallback logo for ${institutionId}:`, fallbackLogo);
  return fallbackLogo || null;
}

export async function POST() {
  try {
    const items = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
      },
    });
    const results = [];

    for (const item of items) {
      try {
        console.log(`Processing institution: ${item.institutionId}`);

        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: item.institutionId,
          country_codes: [CountryCode.Us],
          options: {
            include_optional_metadata: true,
          },
        });

        const institution = institutionResponse.data.institution;
        console.log(`Institution details:`, {
          id: item.institutionId,
          name: institution.name,
          hasPlaidLogo: !!institution.logo,
          hasFallbackLogo: !!institutionLogos[item.institutionId],
        });

        const logo = formatLogoUrl(institution.logo, item.institutionId);
        console.log(`Final logo URL:`, logo);

        await prisma.plaidItem.update({
          where: { id: item.id },
          data: {
            institutionName: institution.name,
            institutionLogo: logo,
          },
        });

        results.push({
          id: item.id,
          institutionId: item.institutionId,
          status: "success",
          name: institution.name,
          logo: logo ? "present" : "missing",
        });
      } catch (error) {
        console.error(
          `Error updating institution ${item.institutionId}:`,
          error
        );
        results.push({
          id: item.id,
          institutionId: item.institutionId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error refreshing institutions:", error);
    return NextResponse.json(
      { error: "Failed to refresh institutions" },
      { status: 500 }
    );
  }
}
