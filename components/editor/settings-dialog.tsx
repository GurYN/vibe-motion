"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

interface SettingsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdate: (project: Project) => void;
}

const RESOLUTION_PRESETS = [
  { label: "1080p (1920x1080)", width: 1920, height: 1080 },
  { label: "720p (1280x720)", width: 1280, height: 720 },
  { label: "4K (3840x2160)", width: 3840, height: 2160 },
  { label: "Square (1080x1080)", width: 1080, height: 1080 },
  { label: "Portrait (1080x1920)", width: 1080, height: 1920 },
  { label: "Custom", width: 0, height: 0 },
];

const FPS_OPTIONS = [24, 25, 30, 50, 60];

export function SettingsDialog({
  project,
  open,
  onOpenChange,
  onProjectUpdate,
}: SettingsDialogProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [width, setWidth] = useState(project.width);
  const [height, setHeight] = useState(project.height);
  const [fps, setFps] = useState(project.fps);
  const [isCustomResolution, setIsCustomResolution] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description || "");
      setWidth(project.width);
      setHeight(project.height);
      setFps(project.fps);
      setError(null);

      // Check if current resolution matches a preset
      const matchingPreset = RESOLUTION_PRESETS.find(
        (p) => p.width === project.width && p.height === project.height
      );
      setIsCustomResolution(!matchingPreset || matchingPreset.width === 0);
    }
  }, [open, project]);

  const handleResolutionChange = (value: string) => {
    const preset = RESOLUTION_PRESETS.find((p) => p.label === value);
    if (preset) {
      if (preset.width === 0) {
        setIsCustomResolution(true);
      } else {
        setIsCustomResolution(false);
        setWidth(preset.width);
        setHeight(preset.height);
      }
    }
  };

  const getCurrentResolutionLabel = () => {
    if (isCustomResolution) return "Custom";
    const preset = RESOLUTION_PRESETS.find(
      (p) => p.width === width && p.height === height
    );
    return preset?.label || "Custom";
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          width,
          height,
          fps,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update project");
      }

      const data = await res.json();
      onProjectUpdate(data.project);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Configure your project settings. Changes will be applied to new renders.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Project Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Video Project"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of your project"
            />
          </div>

          {/* Resolution */}
          <div className="grid gap-2">
            <Label>Resolution</Label>
            <Select
              value={getCurrentResolutionLabel()}
              onValueChange={handleResolutionChange}
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
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
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
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                    min={1}
                    max={4320}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Frame Rate */}
          <div className="grid gap-2">
            <Label>Frame Rate</Label>
            <Select
              value={fps.toString()}
              onValueChange={(v) => setFps(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FPS_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f.toString()}>
                    {f} fps
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
