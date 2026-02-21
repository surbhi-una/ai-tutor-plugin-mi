"use node";

import { action } from "./_generated/server";

export const getJwt = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.SPEECHMATICS_API_KEY;
    if (!apiKey) throw new Error("SPEECHMATICS_API_KEY not configured");

    const res = await fetch(
      "https://mp.speechmatics.com/v1/api_keys?type=flow",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Speechmatics JWT error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return { jwt: data.key_value };
  },
});
