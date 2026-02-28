import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const JobCategorySchema = z.enum(['software', 'business']);
export const EmploymentTypeSchema = z.enum(['full_time', 'internship', 'co_op']);
export const WorkplaceTypeSchema = z.enum(['remote', 'hybrid', 'onsite']);
export const SourceTypeSchema = z.enum([
  'ashby',
  'lever',
  'greenhouse',
  'jobbank_ca',
  'linkedin',
  'indeed',
  'github_repo',
]);
export const ApplyTypeSchema = z.enum(['url', 'email']);
export const CompanyTierSchema = z.enum(['tier1', 'standard']);
export const ApplyMethodSchema = z.enum(['email', 'ats_api', 'autofill_queue', 'manual']);
export const AtsTypeSchema = z.enum([
  'workday',
  'greenhouse',
  'lever',
  'ashby',
  'taleo',
  'icims',
  'linkedin',
  'indeed',
  'unknown',
]);
export const ApplicationStatusSchema = z.enum([
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]);
export const DraftStatusSchema = z.enum(['pending', 'approved', 'sent', 'queued_autofill']);
export const AutofillQueueStatusSchema = z.enum([
  'pending',
  'opened',
  'completed',
  'failed',
  'expired',
]);

// ─── Profile ─────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  locations: z.array(z.string().min(1)).optional(),
  preferredRemote: z.boolean().optional(),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  visaAuth: z.string().nullable().optional(),
  keywords: z.array(z.string().min(1)).optional(),
  roles: z.array(z.string().min(1)).optional(),
  excludeKeywords: z.array(z.string().min(1)).optional(),
  jobCategories: z.array(JobCategorySchema).min(1).optional(),
  employmentTypes: z.array(EmploymentTypeSchema).min(1).optional(),
});

// ─── Resume ──────────────────────────────────────────────────────────────────

export const CreateResumeSchema = z.object({
  label: z.string().min(1).max(100),
  isDefault: z.boolean().optional().default(false),
});

export const CreateResumeVersionSchema = z.object({
  versionLabel: z.string().min(1).max(100),
  isDefault: z.boolean().optional().default(false),
  mimeType: z.enum(['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const JobsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  category: JobCategorySchema.optional(),
  employmentType: EmploymentTypeSchema.optional(),
  workplaceType: WorkplaceTypeSchema.optional(),
});

// ─── Matches ─────────────────────────────────────────────────────────────────

export const MatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  minScore: z.coerce.number().min(0).max(100).optional(),
});

// ─── Drafts ──────────────────────────────────────────────────────────────────

export const CreateDraftSchema = z.object({
  jobId: z.string().uuid(),
  resumeVersionId: z.string().uuid(),
  coverLetter: z.string().min(1).max(5000),
  qaBundle: z.object({
    answers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
      fieldKey: z.string(),
    })),
  }),
});

export const ApproveDraftSchema = z.object({
  resumeVersionId: z.string().uuid().optional(),
  coverLetter: z.string().max(5000).optional(),
});

// ─── Applications ─────────────────────────────────────────────────────────────

export const CreateApplicationSchema = z.object({
  jobId: z.string().uuid(),
  draftId: z.string().uuid().nullable().optional(),
  applyMethod: ApplyMethodSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateApplicationStatusSchema = z.object({
  status: ApplicationStatusSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export const ApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  status: ApplicationStatusSchema.optional(),
  applyMethod: ApplyMethodSchema.optional(),
});

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const AddWatchlistItemSchema = z.object({
  itemType: z.enum(['company', 'role', 'keyword']),
  value: z.string().min(1).max(200),
  atsUrl: z.string().url().nullable().optional(),
  companyTier: CompanyTierSchema.optional().default('standard'),
  autoDiscoverPeers: z.boolean().optional().default(false),
});

export const UpdateWatchlistItemSchema = z.object({
  companyTier: CompanyTierSchema.optional(),
  autoDiscoverPeers: z.boolean().optional(),
  atsUrl: z.string().url().nullable().optional(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export const PushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export const UpdateNotificationPrefsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  digestMode: z.boolean().optional(),
});

// ─── Autofill Queue ───────────────────────────────────────────────────────────

export const CompleteAutofillSchema = z.object({
  submittedFields: z.record(z.string()),
});

export const LearnFieldsSchema = z.object({
  atsType: AtsTypeSchema,
  domain: z.string(),
  fields: z.array(z.object({
    fieldKey: z.string(),
    selector: z.string().nullable(),
    label: z.string(),
    inputType: z.enum(['text', 'email', 'tel', 'select', 'textarea', 'file', 'radio', 'checkbox']),
  })),
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

export const CreateJobSourceSchema = z.object({
  sourceType: SourceTypeSchema,
  config: z.record(z.unknown()),
  enabled: z.boolean().optional().default(true),
});
