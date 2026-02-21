"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Loader2,
  ArrowLeft,
  GraduationCap,
  ClipboardList,
  MessageSquare,
  HelpCircle,
} from "lucide-react";

interface Course {
  id: number;
  name: string;
  courseCode: string;
  term: string | null;
}

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  contentId: number | null;
  pageUrl: string | null;
}

interface Module {
  id: number;
  name: string;
  position: number;
  items: ModuleItem[];
}

interface CourseBrowserProps {
  domain: string;
  token: string;
  connectionId: Id<"canvasConnections">;
  onMaterialReady: (materialId: Id<"materials">) => void;
}

function getItemIcon(type: string) {
  switch (type) {
    case "Page":
      return <FileText className="h-4 w-4 text-primary" />;
    case "Assignment":
      return <ClipboardList className="h-4 w-4 text-primary" />;
    case "Discussion":
      return <MessageSquare className="h-4 w-4 text-primary" />;
    case "Quiz":
      return <HelpCircle className="h-4 w-4 text-primary" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

export function CourseBrowser({
  domain,
  token,
  connectionId,
  onMaterialReady,
}: CourseBrowserProps) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [modules, setModules] = useState<Module[] | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingContent, setFetchingContent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useAction(api.canvas.fetchCourses);
  const fetchModules = useAction(api.canvas.fetchModules);
  const fetchContent = useAction(api.canvas.fetchContent);
  const createMaterial = useMutation(api.materials.create);

  async function loadCourses() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourses({ domain, token });
      setCourses(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch courses");
    } finally {
      setLoading(false);
    }
  }

  async function loadModules(course: Course) {
    setLoading(true);
    setError(null);
    setSelectedCourse(course);
    try {
      const result = await fetchModules({
        domain,
        token,
        courseId: String(course.id),
      });
      setModules(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch modules");
    } finally {
      setLoading(false);
    }
  }

  async function selectItem(item: ModuleItem) {
    setFetchingContent(item.id);
    setError(null);
    try {
      const result = await fetchContent({
        domain,
        token,
        courseId: String(selectedCourse!.id),
        itemType: item.type,
        itemId: item.contentId ? String(item.contentId) : undefined,
        pageUrl: item.pageUrl ?? undefined,
      });

      const materialId = await createMaterial({
        content: result.content,
        source: "canvas",
        title: result.title,
        courseId: String(selectedCourse!.id),
        courseName: selectedCourse!.name,
        canvasConnectionId: connectionId,
      });

      onMaterialReady(materialId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch content"
      );
    } finally {
      setFetchingContent(null);
    }
  }

  // Initial state -- show "Load Courses" button
  if (!courses) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <GraduationCap className="h-5 w-5 text-primary" />
            Your Courses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <Button onClick={loadCourses} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="mr-2 h-4 w-4" />
            )}
            {loading ? "Loading courses..." : "Load My Courses"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Modules view
  if (selectedCourse && modules) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedCourse(null);
                setModules(null);
              }}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to courses</span>
            </Button>
            <CardTitle className="text-card-foreground text-base">
              {selectedCourse.name}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <ScrollArea className="h-80">
            <div className="flex flex-col gap-3">
              {modules.map((mod) => (
                <div key={mod.id} className="flex flex-col gap-1">
                  <h4 className="text-sm font-medium text-muted-foreground px-2">
                    {mod.name}
                  </h4>
                  <div className="flex flex-col gap-0.5">
                    {mod.items
                      .filter((item) =>
                        ["Page", "Assignment", "Discussion", "Quiz"].includes(
                          item.type
                        )
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => selectItem(item)}
                          disabled={fetchingContent !== null}
                          className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-card-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                          {fetchingContent === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            getItemIcon(item.type)
                          )}
                          <span className="flex-1 truncate">{item.title}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    {mod.items.filter((item) =>
                      ["Page", "Assignment", "Discussion", "Quiz"].includes(
                        item.type
                      )
                    ).length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No readable items in this module
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {modules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No modules found in this course
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Courses list
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <GraduationCap className="h-5 w-5 text-primary" />
          Select a Course
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <ScrollArea className="h-80">
          <div className="flex flex-col gap-1">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => loadModules(course)}
                disabled={loading}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <BookOpen className="h-5 w-5 text-primary shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-card-foreground truncate">
                    {course.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {course.courseCode}
                    {course.term ? ` - ${course.term}` : ""}
                  </span>
                </div>
                {loading && selectedCourse?.id === course.id ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary shrink-0" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
