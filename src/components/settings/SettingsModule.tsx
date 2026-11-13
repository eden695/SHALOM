import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Download,
  Upload,
  HardDrive,
  User,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  KeyRound,
  Grid3X3,
  Hash,
  Image as ImageIcon,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import {
  hashSecret,
  getSecurityConfig,
  saveSecurityConfig,
  setAppSessionUnlocked,
  LOCKABLE_FEATURES,
} from '../../services/security';
import {
  UserProfile,
  LockMode,
  LockableFeatureId,
  SecurityConfig,
} from '../../types';
import { PatternGrid } from '../security/PatternGrid';

interface SettingsModuleProps {
  initialSubTab?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLockNow: () => void;
  onSecurityChanged: (cfg: SecurityConfig) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  initialSubTab = 'general',
  isDarkMode,
  onToggleDarkMode,
  onLockNow,
  onSecurityChanged,
}) => {
  const { userProfile, reloadData } = useShalomDB();
  const [subTab, setSubTab] = useState<string>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [userForm, setUserForm] = useState<UserProfile>({
    id: userProfile?.id || 'user_main',
    fullName: userProfile?.fullName || 'Mon Espace SHALOM',
    phone: userProfile?.phone || '',
    email: userProfile?.email || '',
    theme: userProfile?.theme || 'light',
    createdAt: userProfile?.createdAt || new Date().toISOString(),
  });

  // Security Protection Config State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [draftLockMode, setDraftLockMode] = useState<LockMode>(() => getSecurityConfig().lockMode);
  const [draftLockOnLaunch, setDraftLockOnLaunch] = useState<boolean>(
    () => getSecurityConfig().lockOnLaunch
  );
  const [draftLockedFeatures, setDraftLockedFeatures] = useState<LockableFeatureId[]>(
    () => getSecurityConfig().lockedFeatures
  );

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [patternStep1, setPatternStep1] = useState<string>('');
  const [patternStep2, setPatternStep2] = useState<string>('');
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  const [storageStats, setStorageStats] = useState<{
    usageMB: number;
    quotaMB: number;
    percentage: number;
  }>({ usageMB: 0, quotaMB: 1000, percentage: 0 });
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) setUserForm(userProfile);
    dbService.getStorageEstimate().then(setStorageStats);
  }, [userProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await dbService.put(STORES.PROFILES, userForm);
    setSaveNotice('Profil enregistré.');
    reloadData();
  };

  const toggleFeatureLock = (featureId: LockableFeatureId) => {
    setDraftLockedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId]
    );
  };

  const handleSaveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityNotice(null);

    let secretToHash = '';
    const needsNewSecret =
      !securityConfig.secretHash ||
      securityConfig.lockMode !== draftLockMode ||
      newPin.length > 0 ||
      newPassword.length > 0 ||
      patternStep1.length > 0;

    if (needsNewSecret) {
      if (draftLockMode === 'pin') {
        if (!/^\d{4}$/.test(newPin)) {
          setSecurityNotice('Le code PIN doit contenir exactement 4 chiffres.');
          return;
        }
        if (newPin !== confirmPin) {
          setSecurityNotice('Les deux codes PIN ne correspondent pas.');
          return;
        }
        secretToHash = newPin;
      } else if (draftLockMode === 'password') {
        if (newPassword.length < 4) {
          setSecurityNotice('Le mot de passe doit contenir au moins 4 caractères.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setSecurityNotice('Les deux mots de passe ne correspondent pas.');
          return;
        }
        secretToHash = newPassword;
      } else if (draftLockMode === 'pattern') {
        if (!patternStep1 || patternStep1.split('-').length < 4) {
          setSecurityNotice('Tracez un schéma reliant au moins 4 points.');
          return;
        }
        if (patternStep1 !== patternStep2) {
          setSecurityNotice('Les deux schémas tracés ne correspondent pas.');
          setPatternStep1('');
          setPatternStep2('');
          return;
        }
        secretToHash = patternStep1;
      }
    }

    const finalHash = secretToHash ? await hashSecret(secretToHash) : securityConfig.secretHash;

    if (!draftLockOnLaunch && draftLockedFeatures.length === 0) {
      setSecurityNotice(
        'Sélectionnez au moins « Verrouiller l’ouverture de l’application » ou une fonctionnalité à protéger.'
      );
      return;
    }

    const nextConfig: SecurityConfig = {
      isEnabled: true,
      lockMode: draftLockMode,
      secretHash: finalHash,
      lockOnLaunch: draftLockOnLaunch,
      lockedFeatures: draftLockedFeatures,
    };

    saveSecurityConfig(nextConfig);
    setSecurityConfig(nextConfig);
    onSecurityChanged(nextConfig);
    setAppSessionUnlocked(true);

    setNewPin('');
    setConfirmPin('');
    setNewPassword('');
    setConfirmPassword('');
    setPatternStep1('');
    setPatternStep2('');
    setSecurityNotice('Protection enregistrée et activée.');
  };

  const handleDisableSecurity = () => {
    const disabled: SecurityConfig = {
      isEnabled: false,
      lockMode: draftLockMode,
      secretHash: '',
      lockOnLaunch: false,
      lockedFeatures: [],
    };
    saveSecurityConfig(disabled);
    setSecurityConfig(disabled);
    setDraftLockOnLaunch(false);
    setDraftLockedFeatures([]);
    onSecurityChanged(disabled);
    setAppSessionUnlocked(true);
    setSecurityNotice('Protection désactivée.');
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      const jsonBackup = await dbService.exportBackup(false);
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shalom_sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setRestoreMessage('Sauvegarde JSON téléchargée.');
    } catch {
      setRestoreMessage('Erreur lors de la sauvegarde.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const result = await dbService.restoreBackup(content);
      setRestoreMessage(result.message);
      if (result.success) reloadData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadLogo = async (format: 'png' | 'jpg') => {
    const fileName = `shalom_logo_520x520.${format}`;
    try {
      const response = await fetch(`/${fileName}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSaveNotice(`Logo ${fileName} téléchargé.`);
    } catch {
      setSaveNotice('Erreur lors du téléchargement du logo.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Settings className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>Paramètres & Sécurité</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Profil personnel, protection au choix et sauvegarde locale
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          {[
            { id: 'general', label: 'Mon Profil' },
            { id: 'security', label: 'Protection au choix' },
            { id: 'backup', label: 'Sauvegarde' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                subTab === t.id
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Mon Profil */}
      {subTab === 'general' && (
        <div className="max-w-xl space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {saveNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {saveNotice}
              </div>
            )}

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Mon Profil & Apparence</span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nom ou Prénom</label>
                <input
                  type="text"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={userForm.phone || ''}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Thème visuel</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <span>Mode Sombre / Nuit</span>
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 font-bold"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                    <span>{isDarkMode ? 'Activé' : 'Désactivé'}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition"
            >
              Enregistrer
            </button>
          </form>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <ImageIcon className="w-4 h-4" />
              <span>Logo officiel SHALOM (520 × 520 px)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-slate-200/70 dark:border-slate-700/70 shrink-0 bg-slate-100 dark:bg-slate-900">
                <img
                  src="/shalom_logo_520x520.png"
                  alt="Logo SHALOM 520x520"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2.5 flex-1 text-center sm:text-left">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Téléchargez le logo en haute netteté <strong>520 × 520 px</strong> pour vos documents, réseaux ou icônes externes.
                </p>

                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('png')}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PNG transparent (520×520)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('jpg')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JPG plein cadre (520×520)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Protection au choix */}
      {subTab === 'security' && (
        <form onSubmit={handleSaveSecurityPolicy} className="max-w-2xl space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Protection & Verrouillage au choix</span>
              </div>
              {securityConfig.isEnabled && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onLockNow}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verrouiller</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableSecurity}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                  >
                    Désactiver
                  </button>
                </div>
              )}
            </div>

            {securityNotice && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold text-blue-800 dark:text-blue-300">
                {securityNotice}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Que souhaitez-vous protéger ?
              </h3>

              <label className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Bloquer l’ouverture de l’application
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Demande une identification au démarrage
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={draftLockOnLaunch}
                  onChange={(e) => setDraftLockOnLaunch(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LOCKABLE_FEATURES.map((feat) => {
                  const checked = draftLockedFeatures.includes(feat.id);
                  return (
                    <label
                      key={feat.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                        checked
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="truncate">{feat.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFeatureLock(feat.id)}
                        className="accent-blue-700 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Mode de verrouillage
              </h3>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'pin', label: 'Code PIN', icon: Hash },
                  { id: 'password', label: 'Mot de passe', icon: KeyRound },
                  { id: 'pattern', label: 'Schéma 3×3', icon: Grid3X3 },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = draftLockMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setDraftLockMode(m.id as LockMode);
                        setSecurityNotice(null);
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
                {securityConfig.secretHash && securityConfig.lockMode === draftLockMode && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    Un secret ({draftLockMode}) est déjà configuré. Laissez vide pour le conserver.
                  </p>
                )}

                {draftLockMode === 'pin' && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Nouveau PIN (4 chiffres)</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Confirmer</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                )}

                {draftLockMode === 'password' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Mot de passe</label>
                      <input
                        type="password"
                        placeholder="Min. 4 caractères"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Confirmer</label>
                      <input
                        type="password"
                        placeholder="Confirmer"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                )}

                {draftLockMode === 'pattern' && (
                  <div className="text-center space-y-2">
                    {!patternStep1 ? (
                      <PatternGrid
                        label="Étape 1/2 : Tracez votre schéma (min. 4 points)"
                        onPatternComplete={(pat) => {
                          if (pat.split('-').length >= 4) {
                            setPatternStep1(pat);
                          } else {
                            setSecurityNotice('Reliez au moins 4 points.');
                          }
                        }}
                      />
                    ) : !patternStep2 ? (
                      <div className="space-y-2">
                        <PatternGrid
                          label="Étape 2/2 : Confirmez le même schéma"
                          onPatternComplete={(pat) => setPatternStep2(pat)}
                        />
                        <button
                          type="button"
                          onClick={() => setPatternStep1('')}
                          className="text-xs text-slate-500 underline"
                        >
                          Recommencer
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Schéma prêt à être enregistré.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Enregistrer la protection</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. Sauvegarde */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <HardDrive className="w-4 h-4" />
              <span>Stockage Local</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="tabular-nums">Utilisé : {storageStats.usageMB} Mo</span>
                <span className="tabular-nums">Quota : {storageStats.quotaMB} Mo</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-700 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, storageStats.percentage)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Toutes vos données restent enregistrées localement sur cet appareil.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Download className="w-4 h-4" />
              <span>Exporter / Restaurer (JSON)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={backupLoading}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Sauvegarde</span>
              </button>

              <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurer</span>
                <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
              </label>
            </div>

            {restoreMessage && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {restoreMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
