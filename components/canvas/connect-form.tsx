"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Id } from "@/convex/_generated/dataModel";
import { Globe, KeyRound, ArrowRight, Loader2 } from "lucide-react";

interface ConnectFormProps {
  onConnected: (connectionId: Id<"canvasConnections">, domain: string, token: string) => void;
}

export function ConnectForm({ onConnected }: ConnectFormProps) {
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveConnection = useMutation(api.canvasConnections.save);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanDomain = domain
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");

      const connectionId = await saveConnection({
        domain: cleanDomain,
        token,
      });

      onConnected(connectionId, cleanDomain, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-card-foreground">Connect to Canvas</CardTitle>
        <CardDescription>
          Enter your Canvas LMS domain and personal access token to browse your courses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain" className="flex items-center gap-2 text-card-foreground">
              <Globe className="h-4 w-4 text-primary" />
              Canvas Domain
            </Label>
            <Input
              id="domain"
              placeholder="yourschool.instructure.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="bg-secondary text-secondary-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {"The URL you use to access Canvas (without https://)"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="token" className="flex items-center gap-2 text-card-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              Access Token
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Your personal access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="bg-secondary text-secondary-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {"Settings > Approved Integrations > + New Access Token"}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={loading || !domain || !token} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {loading ? "Connecting..." : "Connect to Canvas"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
