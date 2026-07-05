import { z } from 'zod';

export const milestoneMetadataSchema = z.object({
  milestoneId: z.number().int().nonnegative(),
  description: z.string().min(1, 'Description is required')
});

export const userProfileSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  role: z.enum(['client', 'freelancer', 'both']).optional()
});

export const disputeSchema = z.object({
  escrowId: z.number().int().nonnegative(),
  raisedBy: z.string().min(1, 'raisedBy is required'),
  reason: z.string().min(1, 'Reason is required'),
  evidenceUrls: z.array(z.string()).optional().default([])
});
