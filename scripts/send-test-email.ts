import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Define interfaces (copied from refresh-data.ts)
interface AccountChange {
  name: string;
  nickname: string | null;
  previousBalance: number;
  currentBalance: number;
  change: number;
  isPositive: boolean;
  type: string;
}

interface InstitutionChange {
  name: string;
  accounts: AccountChange[];
}

// Configure email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Helper function to format money
handlebars.registerHelper("formatMoney", (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

// Helper to check if an account is a loan or credit account
handlebars.registerHelper("isLoanOrCredit", (type: string) => {
  if (!type) return false;
  const accountType = type.toLowerCase();
  return accountType === "credit" || accountType === "loan";
});

// Helper to get absolute value
handlebars.registerHelper("absValue", (value: number) => {
  return Math.abs(value);
});

async function sendTestEmail(): Promise<void> {
  try {
    // Get current account data
    const accounts = await prisma.account.findMany({
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate net worth
    const netWorth = accounts.reduce((total, account) => {
      const balance = account.balances[0]?.current || 0;
      return total + balance;
    }, 0);

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      select: {
        name: true,
        amount: true,
        date: true,
        categoryAi: true,
      },
    });

    // Check for significant changes (simplified logic)
    const hasChanges = netWorth !== 0 || recentTransactions.length > 0;

    if (!hasChanges) {
      // Create sample data for test email
    }

    // Prepare email content
    const emailContent = `
      <h2>Daily Financial Summary</h2>
      <p><strong>Net Worth:</strong> $${netWorth.toLocaleString()}</p>
      <h3>Recent Transactions:</h3>
      <ul>
        ${recentTransactions.map(t => 
          `<li>${t.name} - $${t.amount.toFixed(2)} (${t.categoryAi || 'Uncategorized'})</li>`
        ).join('')}
      </ul>
    `;

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: 'Daily Financial Summary',
      html: emailContent,
    };

    await transporter.sendMail(mailOptions);
    console.log("Test email sent successfully!");

  } catch (error) {
    console.error("Error sending test email:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function sendEmail(
  changes: InstitutionChange[],
  totalChange: number,
  netWorth: number,
  totalAssets: number,
  totalLiabilities: number
): Promise<void> {
  const templatePath = path.join(__dirname, "email-template.html");
  const template = handlebars.compile(fs.readFileSync(templatePath, "utf-8"));

  // Calculate the total number of accounts with changes
  const totalAccountsChanged = changes.reduce(
    (total, institution) => total + institution.accounts.length,
    0
  );

  const html = template({
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    hasChanges: changes.length > 0,
    institutions: changes,
    totalChange,
    isTotalPositive: totalChange > 0,
    totalAccountsChanged,
    netWorth,
    isNetWorthPositive: netWorth >= 0,
    totalAssets,
    totalLiabilities,
  });

  // You can customize the recipient for test emails
  const recipientEmail = process.argv[2] || "eibrahim@gmail.com";

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: "Financial Dashboard Update - TEST",
    html,
  };

  await transporter.sendMail(mailOptions);
}

// Run the script
sendTestEmail();
