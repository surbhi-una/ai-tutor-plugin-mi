"use client";

import { type ReactNode } from "react";

let ConvexProviderComponent: React.ComponentType<{ children: ReactNode }> | null = null;

// Only initialize Convex if the URL is set
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ConvexProvider, ConvexReactClient } = require("convex/react");
    const client = new ConvexReactClient(convexUrl);
    ConvexProviderComponent = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
  } catch {
    // Convex not available, skip
  }
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (ConvexProviderComponent) {
    return <ConvexProviderComponent>{children}</ConvexProviderComponent>;
  }
  return <>{children}</>;
}
