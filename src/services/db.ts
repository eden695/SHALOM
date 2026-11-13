// IndexedDB Persistent Storage Service for SHALOM (Personal Edition)
// 100% Client-side, Serverless, and WebView compatible

import {
  PrayerItem,
  TestimonyItem,
  PrayerGroup,
  Contact,
  CalendarActivity,
  RecordedParole,
  MessageTemplate,
  UserProfile,
} from '../types';

const DB_NAME = 'shalom_db';
const DB_VERSION = 2;

export const STORES = {
  PROFILES: 'profiles',
  PRAYERS: 'prayers',
  TESTIMONIES: 'testimonies',
  PRAYER_GROUPS: 'prayer_groups',
  CONTACTS: 'contacts',
  CALENDAR_ACTIVITIES: 'calendar_activities',
  RECORDINGS: 'recordings',
  MEDIA_BLOBS: 'media_blobs',
  MESSAGE_TEMPLATES: 'message_templates',
  SHARE_HISTORY: 'share_history',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

class ShalomDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.dbPromise = null;
        reject(new Error('IndexedDB non disponible sur ce navigateur.'));
        return;
      }

      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          this.dbPromise = null;
          reject(new Error('Délai dépassé lors de l’ouverture du stockage local.'));
        }
      }, 3000);

      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        clearTimeout(timeoutId);
        this.dbPromise = null;
        reject(err);
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        Object.values(STORES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        try {
          await this.seedInitialDataIfEmpty(db);
          await this.removeLegacyDemoContacts(db);
        } catch (err) {
          console.warn('Seed warning:', err);
        }
        this.requestPersistentStorage().catch(() => {});
        resolve(db);
      };

      request.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.dbPromise = null;
        reject(new Error('IndexedDB bloqué par un autre onglet.'));
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.dbPromise = null;
        reject(new Error(`Erreur d'ouverture d'IndexedDB: ${request.error?.message}`));
      };
    });

    return this.dbPromise;
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as T[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: StoreName, id: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as T) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends { id: string }>(storeName: StoreName, item: T): Promise<T> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(storeName: StoreName, id: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItems(storeName: StoreName, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      ids.forEach((id) => store.delete(id));
      transaction.oncomplete = () => resolve(ids.length);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      try {
        const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        if (already) return true;
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    }
    return false;
  }

  // Store Binary Media reliably as ArrayBuffer + mimeType
  async saveMediaBlob(id: string, blob: Blob, overrideMimeType?: string): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const mimeType = overrideMimeType || blob.type || 'application/octet-stream';
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MEDIA_BLOBS, 'readwrite');
      const store = transaction.objectStore(STORES.MEDIA_BLOBS);
      const request = store.put({
        id,
        buffer,
        mimeType,
        size: buffer.byteLength,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getMediaBlob(id: string): Promise<Blob | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MEDIA_BLOBS, 'readonly');
      const store = transaction.objectStore(STORES.MEDIA_BLOBS);
      const request = store.get(id);
      request.onsuccess = () => {
        const res = request.result;
        if (!res) {
          resolve(null);
          return;
        }
        if (res.buffer) {
          resolve(new Blob([res.buffer], { type: res.mimeType || 'audio/webm' }));
          return;
        }
        if (res.blob instanceof Blob) {
          resolve(res.blob);
          return;
        }
        resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageEstimate(): Promise<{
    usageMB: number;
    quotaMB: number;
    percentage: number;
    persisted: boolean;
  }> {
    let persisted = false;
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (typeof navigator.storage.persisted === 'function') {
        try {
          persisted = await navigator.storage.persisted();
        } catch {
          persisted = false;
        }
      }
      if (navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          const usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
          const quotaMB = Math.round((estimate.quota || 0) / (1024 * 1024));
          const percentage = quotaMB > 0 ? Math.min(100, Math.round((usageMB / quotaMB) * 100)) : 0;
          return { usageMB, quotaMB, percentage, persisted };
        } catch {
          // fallback
        }
      }
    }
    return { usageMB: 1.0, quotaMB: 1000, percentage: 0.1, persisted };
  }

  async purgeOrphanMediaBlobs(): Promise<number> {
    const [recordings, testimonies, blobs] = await Promise.all([
      this.getAll<RecordedParole>(STORES.RECORDINGS),
      this.getAll<TestimonyItem>(STORES.TESTIMONIES),
      this.getAll<{ id: string }>(STORES.MEDIA_BLOBS),
    ]);
    const activeKeys = new Set<string>();
    recordings.forEach((r) => {
      if (r.blobKey) activeKeys.add(r.blobKey);
      r.photoBlobKeys?.forEach((k) => activeKeys.add(k));
    });
    testimonies.forEach((t) => {
      if (t.mediaBlobKey) activeKeys.add(t.mediaBlobKey);
    });
    const orphanIds = blobs.map((b) => b.id).filter((id) => !activeKeys.has(id));
    if (orphanIds.length > 0) {
      await this.deleteItems(STORES.MEDIA_BLOBS, orphanIds);
    }
    return orphanIds.length;
  }

  async exportBackup(includeMediaBlobs = false): Promise<string> {
    await this.openDB();
    const backupData: Record<string, unknown> = {
      app: 'SHALOM',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      stores: {},
    };

    const targetStores = Object.values(STORES).filter(
      (s) => includeMediaBlobs || s !== STORES.MEDIA_BLOBS
    );

    for (const storeName of targetStores) {
      const items = await this.getAll(storeName);
      (backupData.stores as Record<string, unknown>)[storeName] = items;
    }

    return JSON.stringify(backupData, null, 2);
  }

  async restoreBackup(jsonString: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const data = JSON.parse(jsonString);
      if (!data.app || data.app !== 'SHALOM' || !data.stores) {
        return { success: false, message: 'Format de fichier de sauvegarde SHALOM invalide.', count: 0 };
      }

      let importedCount = 0;
      for (const [storeName, items] of Object.entries(data.stores)) {
        if (Object.values(STORES).includes(storeName as StoreName) && Array.isArray(items)) {
          for (const item of items) {
            if (item && (item as { id?: string }).id) {
              await this.put(storeName as StoreName, item as { id: string });
              importedCount++;
            }
          }
        }
      }

      return {
        success: true,
        message: `Restauration réussie (${importedCount} éléments importés).`,
        count: importedCount,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      return { success: false, message: `Échec de la restauration : ${msg}`, count: 0 };
    }
  }

  private async removeLegacyDemoContacts(db: IDBDatabase): Promise<void> {
    try {
      if (localStorage.getItem('shalom_cleaned_demo_contacts_v1')) return;
    } catch {
      // ignore restricted localStorage
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORES.CONTACTS, 'readwrite');
      const store = tx.objectStore(STORES.CONTACTS);
      const checkAndDelete = (id: string, expectedPhone: string) => {
        const req = store.get(id);
        req.onsuccess = () => {
          const item = req.result as Contact | undefined;
          if (item && item.phone === expectedPhone) {
            store.delete(id);
          }
        };
      };
      checkAndDelete('c_1', '+33612345678');
      checkAndDelete('c_2', '+33687654321');
      tx.oncomplete = () => {
        try {
          localStorage.setItem('shalom_cleaned_demo_contacts_v1', '1');
        } catch {
          // ignore
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  }

  private async seedInitialDataIfEmpty(db: IDBDatabase): Promise<void> {
    const checkCount = (storeName: string): Promise<number> => {
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    };

    const putAll = (storeName: string, items: Array<{ id: string }>) => {
      return new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    };

    if ((await checkCount(STORES.PROFILES)) === 0) {
      const defaultUser: UserProfile = {
        id: 'user_main',
        fullName: 'Utilisateur',
        phone: '',
        email: '',
        theme: 'light',
        createdAt: new Date().toISOString(),
      };
      await putAll(STORES.PROFILES, [defaultUser]);
    }

    if ((await checkCount(STORES.MESSAGE_TEMPLATES)) === 0) {
      const templates: MessageTemplate[] = [
        {
          id: 'tpl_encouragement',
          title: 'Parole d’encouragement',
          category: 'encouragement',
          content:
            '« Que le Dieu de l’espérance vous remplisse de toute joie et de toute paix dans la foi » (Romains 15:13). Bon courage {{prenom}}, je prie pour toi !',
        },
        {
          id: 'tpl_demande_priere',
          title: 'Partager un sujet de prière',
          category: 'demande_priere',
          content:
            'Bonjour {{prenom}}, je voulais te confier un sujet de prière cette semaine : {{theme}}. Merci pour ton soutien dans la prière !',
        },
        {
          id: 'tpl_remerciement',
          title: 'Remerciement fraternel',
          category: 'remerciement',
          content:
            'Merci infiniment {{prenom}} pour ton soutien et tes prières. Que le Seigneur te bénisse abondamment !',
        },
        {
          id: 'tpl_anniversaire',
          title: 'Vœux d’anniversaire',
          category: 'anniversaire',
          content:
            'Joyeux anniversaire béni {{prenom}} ! Que le Seigneur couronne cette nouvelle année de vie de paix, de santé et de grâce.',
        },
        {
          id: 'tpl_temoignage',
          title: 'Partager un témoignage',
          category: 'temoignage',
          content:
            'Bonjour {{prenom}}, je voulais partager avec toi une grâce du Seigneur : {{theme}}. À Lui toute la gloire !',
        },
      ];
      await putAll(STORES.MESSAGE_TEMPLATES, templates);
    }

    if ((await checkCount(STORES.PRAYERS)) === 0) {
      const initialPrayers: PrayerItem[] = [
        {
          id: 'p_1',
          title: 'Sagesse et paix pour mes décisions',
          description: 'Demande de discernement et de paix pour les choix de cette année.',
          category: 'personnelle',
          bibleVerse: 'Jacques 1:5',
          status: 'en_priere',
          isPrivate: true,
          nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      await putAll(STORES.PRAYERS, initialPrayers);
    }

    if ((await checkCount(STORES.TESTIMONIES)) === 0) {
      const initialTestimony: TestimonyItem = {
        id: 't_1',
        title: 'Paix retrouvée dans ma semaine',
        content: 'Le Seigneur m’a apaisé au milieu d’une situation difficile grâce à sa Parole.',
        date: new Date().toISOString().split('T')[0],
        bibleVerse: 'Jean 14:27',
        category: 'reconnaissance',
        createdAt: new Date().toISOString(),
      };
      await putAll(STORES.TESTIMONIES, [initialTestimony]);
    }

    if ((await checkCount(STORES.CALENDAR_ACTIVITIES)) === 0) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const calItem: CalendarActivity = {
        id: 'cal_1',
        title: 'Temps de prière & méditation du matin',
        activityType: 'priere',
        date: tomorrow,
        time: '06h30 - 07h15',
        description: 'Lecture des Psaumes et prière personnelle.',
        status: 'a_venir',
        createdAt: new Date().toISOString(),
      };
      await putAll(STORES.CALENDAR_ACTIVITIES, [calItem]);
    }

    if ((await checkCount(STORES.PRAYER_GROUPS)) === 0) {
      const grp: PrayerGroup = {
        id: 'pg_1',
        name: 'Mes partenaires de prière',
        description: 'Personnes de confiance avec qui partager mes sujets.',
        memberContactIds: [],
        prayerIds: [],
        createdAt: new Date().toISOString(),
      };
      await putAll(STORES.PRAYER_GROUPS, [grp]);
    }
  }
}

export const dbService = new ShalomDB();
