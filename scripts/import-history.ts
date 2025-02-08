import { PrismaClient } from "@prisma/client";
import { parse, CsvError } from "csv-parse";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface CSVRecord {
  Month: string;
  [key: string]: string;
}

async function importBalances() {
  // Get all accounts from the database
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      name: true,
      nickname: true,
    },
  });

  // Create a map of account nicknames to IDs
  const accountMap = new Map(
    accounts
      .filter((a) => a.nickname) // Only include accounts with nicknames
      .map((a) => [a.nickname, a.id])
  );

  // Read and parse the CSV file
  const csvPath = path.join(__dirname, "import.csv");
  const fileContent = fs.readFileSync(csvPath, "utf-8");

  // Parse CSV
  const records: CSVRecord[] = await new Promise((resolve, reject) => {
    parse(
      fileContent,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
      (err: CsvError | undefined, records: CSVRecord[]) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });

  console.log(`Found ${records.length} records in CSV`);

  // Process each record
  for (const record of records) {
    const month = record.Month;
    const date = new Date(`${month}-01`);

    // Process each account column
    for (const [csvName, amount] of Object.entries(record)) {
      if (csvName === "Month") continue;

      // Skip empty values
      if (!amount) continue;

      // Get the account ID directly from the CSV column name (which should match nickname)
      const accountId = accountMap.get(csvName);
      if (!accountId) {
        console.log(`No account found with nickname: ${csvName}`);
        continue;
      }

      // Parse the amount (remove "$" and "," and convert to number)
      const parsedAmount = parseFloat(amount.replace(/[$,]/g, ""));
      if (isNaN(parsedAmount)) {
        console.log(`Invalid amount for ${csvName}: ${amount}`);
        continue;
      }

      // Check if balance already exists
      const existingBalance = await prisma.accountBalance.findFirst({
        where: {
          accountId,
          date: {
            gte: new Date(date.getFullYear(), date.getMonth(), 1),
            lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
          },
          current: parsedAmount,
        },
      });

      if (existingBalance) {
        console.log(
          `Balance already exists for ${csvName} on ${month}: $${parsedAmount}`
        );
        continue;
      }

      // Create new balance record
      try {
        await prisma.accountBalance.create({
          data: {
            accountId,
            date,
            current: parsedAmount,
            available: parsedAmount,
          },
        });
        console.log(
          `Imported balance for ${csvName} on ${month}: $${parsedAmount}`
        );
      } catch (error) {
        console.error(`Error importing balance for ${csvName}:`, error);
      }
    }
  }
}

// Run the import
importBalances()
  .then(() => {
    console.log("Import completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
