import Ably from 'ably';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const client = new Ably.Rest(process.env.ABLY_API_KEY!);

  const tokenRequest = await client.auth.createTokenRequest({
    clientId: "user-" + Math.random().toString(36).substring(2, 8),
  });

  return NextResponse.json(tokenRequest);
}
