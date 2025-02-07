import { NextResponse } from "next/server";

export async function GET() {
  const COINBASE_SCOPES = ["wallet:accounts:read"].join(" ");
  const authUrl =
    `https://www.coinbase.com/oauth/authorize?` +
    `client_id=${process.env.COINBASE_CLIENT_ID}&` +
    `redirect_uri=${process.env.COINBASE_REDIRECT_URI}&` +
    `response_type=code&` +
    `scope=${COINBASE_SCOPES}`;

  return NextResponse.json({ authUrl });
}
