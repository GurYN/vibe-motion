"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Folder, Trash2, Film, Image as ImageIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const RESOLUTION_PRESETS = [
  { label: "1080p (1920x1080)", width: 1920, height: 1080 },
  { label: "720p (1280x720)", width: 1280, height: 720 },
  { label: "4K (3840x2160)", width: 3840, height: 2160 },
  { label: "Square (1080x1080)", width: 1080, height: 1080 },
  { label: "Portrait (1080x1920)", width: 1080, height: 1920 },
  { label: "Custom", width: 0, height: 0 },
];

interface Project {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    assets: number;
    exports: number;
  };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    width: 1920,
    height: 1080,
    fps: 30,
  });
  const [isCustomResolution, setIsCustomResolution] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newProject.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });

      if (res.ok) {
        setShowCreateDialog(false);
        setNewProject({
          name: "",
          description: "",
          width: 1920,
          height: 1080,
          fps: 30,
        });
        setIsCustomResolution(false);
        fetchProjects();
      } else {
        const error = await res.json();
        console.error("Failed to create project:", error);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Vibe Motion</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AlertDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
          >
            <AlertDialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Create New Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Create a new Remotion video project
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Video"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your project..."
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Resolution</Label>
                  <Select
                    value={
                      isCustomResolution
                        ? "Custom"
                        : RESOLUTION_PRESETS.find(
                            (p) =>
                              p.width === newProject.width &&
                              p.height === newProject.height
                          )?.label || "Custom"
                    }
                    onValueChange={(value) => {
                      const preset = RESOLUTION_PRESETS.find(
                        (p) => p.label === value
                      );
                      if (preset) {
                        if (preset.width === 0) {
                          setIsCustomResolution(true);
                        } else {
                          setIsCustomResolution(false);
                          setNewProject({
                            ...newProject,
                            width: preset.width,
                            height: preset.height,
                          });
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTION_PRESETS.map((preset) => (
                        <SelectItem key={preset.label} value={preset.label}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCustomResolution && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label htmlFor="width" className="text-xs">
                          Width
                        </Label>
                        <Input
                          id="width"
                          type="number"
                          value={newProject.width}
                          onChange={(e) =>
                            setNewProject({
                              ...newProject,
                              width: parseInt(e.target.value) || 1920,
                            })
                          }
                          min={1}
                          max={7680}
                        />
                      </div>
                      <div>
                        <Label htmlFor="height" className="text-xs">
                          Height
                        </Label>
                        <Input
                          id="height"
                          type="number"
                          value={newProject.height}
                          onChange={(e) =>
                            setNewProject({
                              ...newProject,
                              height: parseInt(e.target.value) || 1080,
                            })
                          }
                          min={1}
                          max={4320}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Frame Rate</Label>
                  <Select
                    value={newProject.fps.toString()}
                    onValueChange={(v) =>
                      setNewProject({
                        ...newProject,
                        fps: parseInt(v),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[24, 25, 30, 50, 60].map((f) => (
                        <SelectItem key={f} value={f.toString()}>
                          {f} fps
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={createProject} disabled={creating}>
                  {creating ? "Creating..." : "Create Project"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Your Projects</h2>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Folder className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first video project to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="group relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {project.description || "No description"}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{project.name}
                            &quot;? This will permanently delete all assets and
                            exports.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteProject(project.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary">
                      {project.width}x{project.height}
                    </Badge>
                    <Badge variant="secondary">{project.fps} fps</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      {project._count.assets} assets
                    </span>
                    <span className="flex items-center gap-1">
                      <Film className="h-4 w-4" />
                      {project._count.exports} exports
                    </span>
                  </div>
                  <Button className="w-full mt-4" asChild>
                    <a href={`/editor/${project.id}`}>Open Editor</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
