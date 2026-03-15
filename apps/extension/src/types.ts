export interface ResumeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
  summary: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface FieldMapEntry {
  fieldKey: string;
  selector: string | null;
  label: string;
  profileValue: string;
  inputType: string;
}

export interface FieldMap {
  fields: FieldMapEntry[];
  atsType: string;
  domain: string;
  learnedAt: string | null;
}

export interface QueueItem {
  id: string;
  jobId: string;
  applyUrl: string;
  atsType: AtsType;
  fieldMap: FieldMap;
  resumeData: ResumeData;
}

export interface AutofillProfile {
  atsType: string;
  enabled: boolean;
  fieldOverrides: Record<string, string>;
  unknownFields: Array<{ fieldKey: string; label: string; userValue: string }>;
}

export type AtsType =
  | 'ashby'
  | 'lever'
  | 'greenhouse'
  | 'workable'
  | 'smartrecruiters'
  | 'jobvite'
  | 'icims'
  | 'taleo'
  | 'successfactors'
  | 'jobbank_ca'
  | 'unknown';

export type MessageType =
  | { type: 'GET_QUEUE' }
  | { type: 'QUEUE_RESULT'; items: QueueItem[] }
  | { type: 'AUTOFILL_START'; item: QueueItem }
  | { type: 'AUTOFILL_DONE'; itemId: string; success: boolean; error?: string }
  | { type: 'REPORT_UNKNOWN_FIELD'; itemId: string; fieldKey: string; label: string }
  | { type: 'AUTOFILL_ERROR'; itemId: string; errorDetail: string }
  | { type: 'GET_AUTH_TOKEN' }
  | { type: 'AUTH_TOKEN_RESULT'; token: string | null }
  | { type: 'GET_PROFILES' }
  | { type: 'PROFILES_RESULT'; profiles: AutofillProfile[] };

export interface StorageState {
  authToken: string | null;
  apiBase: string;
  lastSync: number;
}
