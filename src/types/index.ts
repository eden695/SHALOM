// Data models and TypeScript types for SHALOM (Personal Edition)

export type LockMode = 'pin' | 'password' | 'pattern';

export type LockableFeatureId =
  | 'prayers'
  | 'parole'
  | 'calendar'
  | 'contacts'
  | 'messaging'
  | 'settings';

export interface SecurityConfig {
  isEnabled: boolean;
  lockMode: LockMode;
  secretHash: string;
  lockOnLaunch: boolean;
  lockedFeatures: LockableFeatureId[];
}

export type PrayerCategory =
  | 'personnelle'
  | 'famille'
  | 'sante'
  | 'travail'
  | 'etudes'
  | 'finances'
  | 'relations'
  | 'reconnaissance'
  | 'intercession'
  | 'autre';

export type PrayerStatus =
  | 'nouvelle'
  | 'en_priere'
  | 'en_attente'
  | 'en_evolution'
  | 'exaucee'
  | 'archivee';

export interface PrayerItem {
  id: string;
  title: string;
  description: string;
  category: PrayerCategory;
  bibleVerse?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  status: PrayerStatus;
  isPrivate: boolean;
  authorizedPersons?: string[];
  authorizedContactIds?: string[];
  nextFollowUpDate?: string;
  history?: Array<{
    date: string;
    text: string;
  }>;
  answeredAt?: string;
}

export interface TestimonyItem {
  id: string;
  title: string;
  content: string;
  date: string;
  bibleVerse?: string;
  category: PrayerCategory;
  prayerId?: string;
  authorName?: string;
  mediaBlobKey?: string;
  mediaType?: 'image' | 'video';
  mediaMimeType?: string;
  createdAt: string;
}

export interface PrayerGroup {
  id: string;
  name: string;
  description?: string;
  memberContactIds: string[];
  prayerIds: string[];
  createdAt: string;
}

export type ParoleType = 'predication' | 'exhortation' | 'enseignement';

export type ActivityGenre =
  | 'culte_dominical'
  | 'culte_enseignement'
  | 'reunion_priere'
  | 'seminaire'
  | 'veillee'
  | 'convention'
  | 'conference'
  | 'formation'
  | 'reunion_speciale'
  | 'autre';

export interface RecordedParole {
  id: string;
  title: string;
  type: ParoleType;
  speaker: string;
  moderator?: string;
  activityGenre: ActivityGenre;
  bibleVerse?: string;
  notes?: string;
  date: string;
  durationSeconds: number;
  mediaType: 'audio' | 'video';
  mimeType: string;
  blobKey?: string;
  fileSizeFormatted?: string;
  createdAt: string;
}

export type ContactCategory =
  | 'famille'
  | 'ami'
  | 'frere_soeur'
  | 'intercesseur'
  | 'pasteur'
  | 'personnel'
  | 'autre';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  category: ContactCategory;
  notes?: string;
  address?: string;
  neighborhood?: string;
  createdAt: string;
  isArchived?: boolean;
}

export type CalendarActivityType =
  | 'priere'
  | 'meditation'
  | 'jeune'
  | 'culte'
  | 'reunion'
  | 'autre';

export interface CalendarActivity {
  id: string;
  title: string;
  activityType: CalendarActivityType;
  date: string;
  endDate?: string;
  time: string;
  location?: string;
  description?: string;
  status: 'a_venir' | 'accompli';
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  category:
    | 'encouragement'
    | 'condoleances'
    | 'anniversaire'
    | 'remerciement'
    | 'demande_priere'
    | 'temoignage';
  content: string;
}

export interface ShareHistoryItem {
  id: string;
  contactName: string;
  contactPhone: string;
  messageText: string;
  channel: 'whatsapp' | 'sms';
  status: 'en_attente' | 'ouvert' | 'confirme_envoye' | 'ignore' | 'echec';
  timestamp: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  theme: 'light' | 'dark';
  createdAt: string;
}
