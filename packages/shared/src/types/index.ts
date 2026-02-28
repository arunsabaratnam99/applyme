export type Provider = 'google' | 'github';

export type JobCategory = 'software' | 'business';

export type EmploymentType = 'full_time' | 'internship' | 'co_op';

export type WorkplaceType = 'remote' | 'hybrid' | 'onsite';

export type SourceType =
  | 'ashby'
  | 'lever'
  | 'greenhouse'
  | 'jobbank_ca'
  | 'linkedin'
  | 'indeed'
  | 'github_repo';

export type ApplyType = 'url' | 'email';

export type CompanyTier = 'tier1' | 'standard';

export type ApplyMethod = 'email' | 'ats_api' | 'autofill_queue' | 'manual';

export type AtsType =
  | 'workday'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'taleo'
  | 'icims'
  | 'linkedin'
  | 'indeed'
  | 'unknown';

export type ApplicationStatus =
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type DraftStatus = 'pending' | 'approved' | 'sent' | 'queued_autofill';

export type AutofillQueueStatus = 'pending' | 'opened' | 'completed' | 'failed' | 'expired';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface UserProfile {
  userId: string;
  locations: string[];
  preferredRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  visaAuth: string | null;
  keywords: string[];
  roles: string[];
  excludeKeywords: string[];
  country: string;
  jobCategories: JobCategory[];
  employmentTypes: EmploymentType[];
}

export interface Resume {
  id: string;
  userId: string;
  label: string;
  isDefault: boolean;
  createdAt: Date;
  versions: ResumeVersion[];
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  versionLabel: string;
  r2Key: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Job {
  id: string;
  sourceId: string;
  externalId: string;
  canonicalUrlHash: string;
  fingerprint: string;
  company: string;
  title: string;
  location: string;
  country: string;
  workplaceType: WorkplaceType | null;
  postedAt: Date | null;
  descriptionPlain: string;
  jobUrl: string;
  applyUrl: string;
  applyType: ApplyType;
  applyEmail: string | null;
  sourceType: SourceType;
  jobCategory: JobCategory;
  employmentType: EmploymentType;
  createdAt: Date;
}

export interface JobMatch {
  id: string;
  userId: string;
  jobId: string;
  score: number;
  reasons: MatchReason[];
  notifiedAt: Date | null;
  createdAt: Date;
  job?: Job;
}

export interface MatchReason {
  type:
    | 'keyword_match'
    | 'watchlist_company'
    | 'watchlist_role'
    | 'location_match'
    | 'remote_match'
    | 'recency'
    | 'employment_type_match'
    | 'category_match';
  label: string;
  score: number;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  itemType: 'company' | 'role' | 'keyword';
  value: string;
  atsUrl: string | null;
  companyTier: CompanyTier;
  autoDiscoverPeers: boolean;
}

export interface CompanyPeer {
  id: string;
  anchorCompany: string;
  peerCompany: string;
  similarityScore: number;
  peerTags: string[];
  source: 'curated' | 'inferred';
}

export interface ApplicationDraft {
  id: string;
  userId: string;
  jobId: string;
  resumeVersionId: string;
  coverLetter: string;
  qaBundle: QABundle;
  status: DraftStatus;
  requiresApproval: boolean;
  applyMethod: ApplyMethod;
  createdAt: Date;
  expiresAt: Date;
  job?: Job;
}

export interface QABundle {
  answers: QAAnswer[];
}

export interface QAAnswer {
  question: string;
  answer: string;
  fieldKey: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  draftId: string | null;
  status: ApplicationStatus;
  appliedAt: Date;
  notes: string | null;
  submittedData: SubmittedApplicationData;
  applyMethod: ApplyMethod;
  expiresAt: Date;
  job?: Job;
  timeline?: ApplicationTimelineEvent[];
}

export interface SubmittedApplicationData {
  name: string;
  email: string;
  resumeVersionId: string;
  resumeVersionLabel: string;
  coverLetter: string;
  answers: QAAnswer[];
  timestamp: string;
  applyMethod: ApplyMethod;
  applyUrl: string;
}

export interface ApplicationTimelineEvent {
  id: string;
  applicationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface AutofillQueueItem {
  id: string;
  userId: string;
  jobId: string;
  draftId: string;
  applyUrl: string;
  atsType: AtsType;
  fieldMap: FieldMap;
  status: AutofillQueueStatus;
  createdAt: Date;
  expiresAt: Date;
  job?: Job;
}

export interface FieldMap {
  fields: FieldMapping[];
  atsType: AtsType;
  domain: string;
  learnedAt: string | null;
}

export interface FieldMapping {
  fieldKey: string;
  selector: string | null;
  label: string;
  profileValue: string | null;
  inputType: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'file' | 'radio' | 'checkbox';
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}

export interface NotificationPrefs {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  digestMode: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  sentAt: Date | null;
  readAt: Date | null;
}
