"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectForm } from "@/components/canvas/connect-form";
import { CourseBrowser, type MaterialData } from "@/components/canvas/course-browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, BookOpen, Zap, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [connection, setConnection] = useState<{
    domain: string;
    token: string;
  } | null>(null);

  const [pasteContent, setPasteContent] = useState("");

  function handleMaterialReady(material: MaterialData) {
    // Store material in sessionStorage and navigate
    sessionStorage.setItem("studyvoice_material", JSON.stringify(material));
    router.push("/tutor");
  }

  function handlePaste() {
    if (!pasteContent.trim()) return;
    sessionStorage.setItem(
      "studyvoice_material",
      JSON.stringify({
        title: "Pasted Content",
        content: pasteContent.trim(),
        courseName: "Manual Input",
        courseId: "",
      })
    );
    router.push("/tutor");
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Mic className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">
              StudyVoice
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Powered by VAPI + Speechmatics + Convex
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance md:text-5xl">
            Talk to your course material
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-balance">
            Connect your Canvas LMS, pick a module, and start a voice
            conversation with an AI tutor that knows your syllabus.
          </p>
          <div className="flex items-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Canvas API
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="h-4 w-4 text-primary" />
              Voice AI
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Real-time
            </div>
          </div>
        </div>

        {/* Connection Flow */}
        <div className="mx-auto max-w-lg">
          <Tabs defaultValue="canvas">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="canvas">Connect Canvas</TabsTrigger>
              <TabsTrigger value="paste">Paste Content</TabsTrigger>
            </TabsList>

            <TabsContent value="canvas" className="mt-4">
              {!connection ? (
                <ConnectForm
                  onConnected={(domain, token) =>
                    setConnection({ domain, token })
                  }
                />
              ) : (
                <CourseBrowser
                  domain={connection.domain}
                  token={connection.token}
                  onMaterialReady={handleMaterialReady}
                />
              )}
            </TabsContent>

            <TabsContent value="paste" className="mt-4">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">
                    Paste Course Material
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Textarea
                    placeholder="Paste your lecture notes, assignment text, or any course material here..."
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    className="min-h-40 bg-secondary text-secondary-foreground"
                  />
                  <Button
                    onClick={handlePaste}
                    disabled={!pasteContent.trim()}
                    className="w-full"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Start Tutoring
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-card-foreground mb-8">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Connect",
                desc: "Link your Canvas LMS account with a personal access token",
              },
              {
                step: "2",
                title: "Select",
                desc: "Browse your courses and pick a module or assignment to study",
              },
              {
                step: "3",
                title: "Talk",
                desc: "Have a voice conversation with your AI tutor about the material",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-card-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
