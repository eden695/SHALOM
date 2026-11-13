// Reactive state hook for SHALOM Personal App
import { useState, useEffect, useCallback } from 'react';
import { dbService, STORES } from '../services/db';
import {
  UserProfile,
  PrayerItem,
  TestimonyItem,
  PrayerGroup,
  Contact,
  CalendarActivity,
  RecordedParole,
  MessageTemplate,
  ShareHistoryItem,
} from '../types';

export function useShalomDB() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [testimonies, setTestimonies] = useState<TestimonyItem[]>([]);
  const [prayerGroups, setPrayerGroups] = useState<PrayerGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [calendarActivities, setCalendarActivities] = useState<CalendarActivity[]>([]);
  const [recordings, setRecordings] = useState<RecordedParole[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [shareHistory, setShareHistory] = useState<ShareHistoryItem[]>([]);

  const reloadData = useCallback(async () => {
    try {
      const [
        profiles,
        pList,
        tList,
        pgList,
        cList,
        calList,
        rList,
        mtList,
        shList,
      ] = await Promise.all([
        dbService.getAll<UserProfile>(STORES.PROFILES),
        dbService.getAll<PrayerItem>(STORES.PRAYERS),
        dbService.getAll<TestimonyItem>(STORES.TESTIMONIES),
        dbService.getAll<PrayerGroup>(STORES.PRAYER_GROUPS),
        dbService.getAll<Contact>(STORES.CONTACTS),
        dbService.getAll<CalendarActivity>(STORES.CALENDAR_ACTIVITIES),
        dbService.getAll<RecordedParole>(STORES.RECORDINGS),
        dbService.getAll<MessageTemplate>(STORES.MESSAGE_TEMPLATES),
        dbService.getAll<ShareHistoryItem>(STORES.SHARE_HISTORY),
      ]);

      setUserProfile(profiles[0] || null);
      setPrayers(pList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTestimonies(tList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPrayerGroups(pgList);
      setContacts(cList.sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setCalendarActivities(calList.sort((a, b) => a.date.localeCompare(b.date)));
      setRecordings(rList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setMessageTemplates(mtList);
      setShareHistory(shList.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch (err) {
      console.error('Erreur chargement données SHALOM:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  return {
    loading,
    userProfile,
    prayers,
    testimonies,
    prayerGroups,
    contacts,
    calendarActivities,
    recordings,
    messageTemplates,
    shareHistory,
    reloadData,
  };
}
