import { Timestamp } from 'firebase/firestore';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Timestamp;
  adminUid: string;
  whatsappNumber: string;
  settings: {
    timezone: string;
    language: string;
  };
}

export interface Member {
  id: string;
  orgId: string;
  displayName: string;
  phoneNumber: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: Timestamp;
  whatsappJid: string;
}

export interface Event {
  id: string;
  orgId: string;
  ancestors: string[];
  name: string;
  description: string;
  date: Timestamp;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Timestamp;
  whatsappGroups: string[];
  coordinators: string[];
}

export interface Task {
  id: string;
  orgId: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  assignedTo: string[];
  status: 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'blocked';
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  sourceMessageId: string | null;
}

export interface ProjectMembership {
  contactId: string;
  projectId: string;
  orgId: string;
  tenantId: string;
  inviteChannel: 'phone' | 'email';
  inviteValue: string;
  invitedBy: string;
  invitedAt: string;
  status: 'invited' | 'active' | 'revoked';
  role: 'external_contributor';
  capabilities: string[];
}

export interface OrgInvite {
  inviteValue: string;      // normalized lowercase email
  inviteeName?: string | null; // display name, when known — email-only invites have none
  orgId: string;
  tenantId: string;         // must equal inviteValue's domain — enforced at write time
  invitedBy: string;        // uid, or "fello_agent" if invited via the ADK tool
  invitedAt: string;        // ISO string, matches project-memberships.ts convention
  status: 'invited' | 'active' | 'revoked';
  access: 'team';           // fixed default for directory-sourced invites
  capabilities: string[];   // [] — team tier gets no elevated capabilities by default
  sourceType: 'directory_suggestion' | 'manual';
  sourceSuggestionId: string | null;
}

export interface InviteSuggestion {
  id: string;
  orgId: string;
  tenantId: string;
  name: string;
  email: string;
  sourceDriveFileId: string;
  sourceFileName: string;
  sourceDocumentId: string;
  status: 'pending' | 'approved' | 'dismissed' | 'invited';
  detectedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export type ActionResult<T> = { data: T; error: null } | { data: null; error: string };
