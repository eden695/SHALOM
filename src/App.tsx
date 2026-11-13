import React, { useState, useEffect } from 'react';
import { useShalomDB } from './hooks/useShalomDB';
import { Header } from './components/layout/Header';
import { Sidebar, NAV_ITEMS } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { Dashboard } from './components/dashboard/Dashboard';
import { PrayerModule } from './components/prayers/PrayerModule';
import { ParoleModule } from './components/parole/ParoleModule';
import { UnifiedCalendarModule } from './components/calendar/UnifiedCalendarModule';
import { ContactsModule } from './components/contacts/ContactsModule';
import { MessagingModule } from './components/messaging/MessagingModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { LockModal } from './components/security/LockModal';
import {
  getSecurityConfig,
  isAppSessionUnlocked,
  setAppSessionUnlocked,
  isFeatureSessionUnlocked,
  unlockFeatureSession,
  lockAllSessions,
} from './services/security';
import { Contact, SecurityConfig, LockableFeatureId } from './types';

export default function App() {
  const { userProfile, loading } = useShalomDB();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Theme Management
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('shalom_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('shalom_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('shalom_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Local Security Lock State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [isLaunchLockOpen, setIsLaunchLockOpen] = useState<boolean>(() => {
    const cfg = getSecurityConfig();
    return cfg.isEnabled && cfg.lockOnLaunch && !!cfg.secretHash && !isAppSessionUnlocked();
  });
  const [pendingFeatureUnlock, setPendingFeatureUnlock] = useState<{
    tab: string;
    lockId: LockableFeatureId;
  } | null>(null);

  const handleLockNow = () => {
    lockAllSessions();
    if (securityConfig.isEnabled && securityConfig.secretHash) {
      setIsLaunchLockOpen(true);
    }
  };

  const handleSelectTab = (tab: string) => {
    const lockableIds: LockableFeatureId[] = [
      'prayers',
      'parole',
      'calendar',
      'contacts',
      'messaging',
      'settings',
    ];

    const isFeatureProtected =
      securityConfig.isEnabled &&
      !!securityConfig.secretHash &&
      lockableIds.includes(tab as LockableFeatureId) &&
      securityConfig.lockedFeatures.includes(tab as LockableFeatureId) &&
      !isFeatureSessionUnlocked(tab as LockableFeatureId);

    if (isFeatureProtected) {
      setPendingFeatureUnlock({
        tab,
        lockId: tab as LockableFeatureId,
      });
      return;
    }

    setActiveTab(tab);
  };

  const [campaignContacts, setCampaignContacts] = useState<Contact[] | undefined>(undefined);

  const handleStartCampaignWithContacts = (targetContacts: Contact[]) => {
    setCampaignContacts(targetContacts);
    handleSelectTab('messaging');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f8fa] dark:bg-[#060d1d] text-slate-800 dark:text-slate-100 p-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400/50 shadow-xl mb-4 animate-pulse">
          <img
            src="./shalom_logo.jpg"
            alt="SHALOM"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-[1.06]"
          />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#0b1f42] dark:text-white font-display">
          SHALOM
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Chargement de votre espace personnel...
        </p>
      </div>
    );
  }

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab);
  const pageTitle = activeNavItem?.label || 'SHALOM';

  return (
    <div className="min-h-screen flex bg-[#f7f8fa] dark:bg-[#060d1d] text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar
        userName={userProfile?.fullName}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        lockedFeatures={securityConfig.isEnabled ? securityConfig.lockedFeatures : []}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          pageTitle={pageTitle}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isSecurityEnabled={securityConfig.isEnabled}
          isUnlocked={isAppSessionUnlocked() || !isLaunchLockOpen}
          onLockClick={handleLockNow}
          onGoHome={() => handleSelectTab('dashboard')}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={handleSelectTab}
              onOpenNewPrayer={() => handleSelectTab('prayers')}
              onOpenNewParole={() => handleSelectTab('parole')}
              onOpenShareModal={() => handleSelectTab('messaging')}
            />
          )}

          {activeTab === 'prayers' && (
            <PrayerModule
              onShareWithContacts={(recipients) => {
                setCampaignContacts(recipients);
                handleSelectTab('messaging');
              }}
              onOpenWhatsAppShare={(text: string) => {
                const encoded = encodeURIComponent(text);
                window.open(`https://wa.me/?text=${encoded}`, '_blank');
              }}
            />
          )}

          {activeTab === 'parole' && <ParoleModule />}

          {activeTab === 'calendar' && <UnifiedCalendarModule />}

          {activeTab === 'contacts' && (
            <ContactsModule onStartCampaignWithContacts={handleStartCampaignWithContacts} />
          )}

          {activeTab === 'messaging' && (
            <MessagingModule
              initialContacts={campaignContacts}
              onClose={() => {
                setCampaignContacts(undefined);
                handleSelectTab('dashboard');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
              onLockNow={handleLockNow}
              onSecurityChanged={(cfg) => setSecurityConfig(cfg)}
            />
          )}
        </main>
      </div>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        lockedFeatures={securityConfig.isEnabled ? securityConfig.lockedFeatures : []}
      />

      {securityConfig.isEnabled && securityConfig.secretHash && (
        <LockModal
          isOpen={isLaunchLockOpen}
          lockMode={securityConfig.lockMode}
          storedHash={securityConfig.secretHash}
          title="Ouverture Protégée — SHALOM"
          subtitle="Saisissez votre identification pour ouvrir l’application"
          onUnlocked={() => {
            setAppSessionUnlocked(true);
            setIsLaunchLockOpen(false);
          }}
        />
      )}

      {pendingFeatureUnlock && securityConfig.secretHash && (
        <LockModal
          isOpen={!!pendingFeatureUnlock}
          lockMode={securityConfig.lockMode}
          storedHash={securityConfig.secretHash}
          title="Fonctionnalité Verrouillée"
          subtitle="Confirmez votre identité pour accéder à cet espace"
          onUnlocked={() => {
            unlockFeatureSession(pendingFeatureUnlock.lockId);
            const target = pendingFeatureUnlock.tab;
            setPendingFeatureUnlock(null);
            setActiveTab(target);
          }}
          onCancel={() => setPendingFeatureUnlock(null)}
        />
      )}
    </div>
  );
}
