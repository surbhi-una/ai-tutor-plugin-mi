import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SPEECHMATICS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      "https://mp.speechmatics.com/v1/api_keys?type=flow",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ttl: 3600 }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Speechmatics API error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ jwt: data.key_value });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get JWT" },
      { status: 500 }
    );
  }
}
