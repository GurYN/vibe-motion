import { z } from "zod";

// Project creation schema
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  width: z.number().int().min(1).max(7680).default(1920),
  height: z.number().int().min(1).max(4320).default(1080),
  fps: z.number().int().min(1).max(120).default(30),
  durationInFrames: z.number().int().min(1).max(108000).default(300), // Max 1 hour at 30fps
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Project update schema
export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  width: z.number().int().min(1).max(7680).optional(),
  height: z.number().int().min(1).max(4320).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  durationInFrames: z.number().int().min(1).max(108000).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// Project ID schema
export const projectIdSchema = z.object({
  id: z.string().uuid("Invalid project ID"),
});
