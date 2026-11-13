// Phone Contact Directory & vCard (.vcf) Import Helper for SHALOM
import { dbService, STORES } from './db';
import { Contact } from '../types';

export interface PickContactsResult {
  status: 'success' | 'cancelled' | 'unsupported' | 'iframe_blocked';
  contacts: Contact[];
  addedCount: number;
  message?: string;
}

const normalizePhone = (phone: string): string => phone.replace(/[^0-9+]/g, '');

export function isNativeContactPickerSupported(): boolean {
  const nav = navigator as unknown as {
    contacts?: { select?: unknown };
  };
  return !!(nav.contacts && typeof nav.contacts.select === 'function' && 'ContactsManager' in window);
}

export async function pickContactsFromDevice(
  existingContacts: Contact[]
): Promise<PickContactsResult> {
  const nav = navigator as unknown as {
    contacts?: {
      select: (
        props: string[],
        opts: { multiple: boolean }
      ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
    };
  };

  if (!nav.contacts || typeof nav.contacts.select !== 'function') {
    return {
      status: 'unsupported',
      contacts: [],
      addedCount: 0,
      message:
        'L’accès direct au répertoire natif est uniquement pris en charge sur Chrome/Android (ou application installée). Utilisez « Importer .vcf » (exporté depuis l’app Contacts de votre téléphone) ou ajoutez un contact manuellement.',
    };
  }

  try {
    const picked = await nav.contacts.select(['name', 'tel', 'email'], { multiple: true });
    if (!picked || picked.length === 0) {
      return { status: 'cancelled', contacts: [], addedCount: 0 };
    }

    const existingByPhone = new Map<string, Contact>();
    existingContacts.forEach((c) => {
      const norm = normalizePhone(c.phone);
      if (norm) existingByPhone.set(norm, c);
    });

    const selectedOrCreated: Contact[] = [];
    let addedCount = 0;

    for (let i = 0; i < picked.length; i++) {
      const p = picked[i];
      const rawPhone = p.tel?.[0]?.trim() || '';
      if (!rawPhone) continue;

      const norm = normalizePhone(rawPhone);
      const already = existingByPhone.get(norm);
      if (already) {
        selectedOrCreated.push(already);
        continue;
      }

      const rawName = (p.name?.[0] || 'Contact').trim();
      const parts = rawName.split(/\s+/);
      const newContact: Contact = {
        id: `c_tel_${Date.now()}_${i}`,
        firstName: parts[0] || rawName,
        lastName: parts.slice(1).join(' '),
        phone: rawPhone,
        email: p.email?.[0]?.trim() || undefined,
        category: 'personnel',
        createdAt: new Date().toISOString(),
      };

      await dbService.put(STORES.CONTACTS, newContact);
      existingByPhone.set(norm, newContact);
      selectedOrCreated.push(newContact);
      addedCount++;
    }

    return {
      status: 'success',
      contacts: selectedOrCreated,
      addedCount,
      message:
        selectedOrCreated.length > 0
          ? `${selectedOrCreated.length} contact(s) sélectionné(s) depuis votre téléphone.`
          : 'Aucun numéro de téléphone valide trouvé dans la sélection.',
    };
  } catch (err: unknown) {
    const errName = err instanceof DOMException ? err.name : '';
    const errMsg = err instanceof Error ? err.message : '';
    if (
      errName === 'SecurityError' ||
      errMsg.toLowerCase().includes('top-level') ||
      errMsg.toLowerCase().includes('iframe')
    ) {
      return {
        status: 'iframe_blocked',
        contacts: [],
        addedCount: 0,
        message:
          'Le navigateur bloque l’ouverture du répertoire depuis un aperçu intégré. Ouvrez le site directement dans votre navigateur ou utilisez « Importer .vcf ».',
      };
    }
    return {
      status: 'cancelled',
      contacts: [],
      addedCount: 0,
      message: 'Sélection dans le répertoire annulée.',
    };
  }
}

export async function importContactsFromVcfOrCsv(
  file: File,
  existingContacts: Contact[]
): Promise<{ contacts: Contact[]; addedCount: number }> {
  const text = await file.text();
  if (!text) return { contacts: [], addedCount: 0 };

  const existingByPhone = new Map<string, Contact>();
  existingContacts.forEach((c) => {
    const norm = normalizePhone(c.phone);
    if (norm) existingByPhone.set(norm, c);
  });

  const importedContacts: Contact[] = [];
  let addedCount = 0;

  if (file.name.toLowerCase().endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
    const cards = text.split(/BEGIN:VCARD/i).slice(1);
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const fnMatch = card.match(/^FN(?:;[^:]*)?:(.+)$/im);
      const nMatch = card.match(/^N(?:;[^:]*)?:([^;\r\n]*);?([^;\r\n]*)/im);
      const telMatches = Array.from(card.matchAll(/^TEL(?:;[^:]*)?:(.+)$/gim));
      const emailMatch = card.match(/^EMAIL(?:;[^:]*)?:(.+)$/im);

      const fallbackName = nMatch
        ? `${nMatch[2]?.trim() || ''} ${nMatch[1]?.trim() || ''}`.trim()
        : '';
      const fullName = (fnMatch?.[1]?.trim() || fallbackName || 'Contact').replace(/\r/g, '');
      const rawPhone = (telMatches[0]?.[1]?.trim() || '').replace(/\r/g, '');

      if (!rawPhone) continue;

      const norm = normalizePhone(rawPhone);
      const already = existingByPhone.get(norm);
      if (already) {
        importedContacts.push(already);
        continue;
      }

      const nameParts = fullName.split(/\s+/);
      const newContact: Contact = {
        id: `c_vcf_${Date.now()}_${i}`,
        firstName: nameParts[0] || fullName,
        lastName: nameParts.slice(1).join(' '),
        phone: rawPhone,
        email: emailMatch?.[1]?.trim().replace(/\r/g, '') || undefined,
        category: 'personnel',
        createdAt: new Date().toISOString(),
      };
      await dbService.put(STORES.CONTACTS, newContact);
      existingByPhone.set(norm, newContact);
      importedContacts.push(newContact);
      addedCount++;
    }
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.replace(/(^"|"$)/g, '').trim());
      if (parts.length >= 3 && parts[0] && parts[2]) {
        const norm = normalizePhone(parts[2]);
        const already = existingByPhone.get(norm);
        if (already) {
          importedContacts.push(already);
          continue;
        }
        const newContact: Contact = {
          id: `c_imp_${Date.now()}_${i}`,
          firstName: parts[0],
          lastName: parts[1] || '',
          phone: parts[2],
          email: parts[3] || undefined,
          category: (parts[4] as Contact['category']) || 'personnel',
          neighborhood: parts[5] || undefined,
          address: parts[6] || undefined,
          notes: parts[7] || undefined,
          createdAt: new Date().toISOString(),
        };
        await dbService.put(STORES.CONTACTS, newContact);
        existingByPhone.set(norm, newContact);
        importedContacts.push(newContact);
        addedCount++;
      }
    }
  }

  return { contacts: importedContacts, addedCount };
}
