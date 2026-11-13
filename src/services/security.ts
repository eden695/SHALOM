// Local Security & Multi-Mode Lock Service for SHALOM (Personal)
// Supports PIN, Password, and 3x3 Pattern Grid — SHA-256 hashed locally

import { SecurityConfig, LockableFeatureId } from '../types';

const SECURITY_SALT = 'SHALOM_SECURITY_SALT_JEAN_14_27_V2';
const SECURITY_STORAGE_KEY = 'shalom_security_config_v2';

export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + SECURITY_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySecret(entered: string, storedHash: string): Promise<boolean> {
  const enteredHash = await hashSecret(entered);
  return enteredHash === storedHash;
}

export function getSecurityConfig(): SecurityConfig {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY);
    if (!raw) {
      return {
        isEnabled: false,
        lockMode: 'pin',
        secretHash: '',
        lockOnLaunch: false,
        lockedFeatures: [],
      };
    }
    return JSON.parse(raw) as SecurityConfig;
  } catch {
    return {
      isEnabled: false,
      lockMode: 'pin',
      secretHash: '',
      lockOnLaunch: false,
      lockedFeatures: [],
    };
  }
}

export function saveSecurityConfig(config: SecurityConfig): void {
  localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(config));
}

// --- In-memory Session Unlock Tracking ---

let appSessionUnlocked = false;
const unlockedFeatures = new Set<string>();

export function isAppSessionUnlocked(): boolean {
  return appSessionUnlocked;
}

export function setAppSessionUnlocked(val: boolean): void {
  appSessionUnlocked = val;
  if (!val) {
    unlockedFeatures.clear();
  }
}

export function isFeatureSessionUnlocked(featureId: LockableFeatureId): boolean {
  if (appSessionUnlocked) return true;
  return unlockedFeatures.has(featureId);
}

export function unlockFeatureSession(featureId: LockableFeatureId): void {
  unlockedFeatures.add(featureId);
}

export function lockAllSessions(): void {
  appSessionUnlocked = false;
  unlockedFeatures.clear();
}

export const LOCKABLE_FEATURES: Array<{ id: LockableFeatureId; label: string }> = [
  { id: 'prayers', label: 'Mes Prières & Témoignages' },
  { id: 'parole', label: 'Parole Divine (Audio / Vidéo)' },
  { id: 'calendar', label: 'Mon Calendrier Personnel' },
  { id: 'contacts', label: 'Mes Contacts' },
  { id: 'messaging', label: 'Partage WhatsApp / SMS' },
  { id: 'settings', label: 'Paramètres & Sauvegarde' },
];
