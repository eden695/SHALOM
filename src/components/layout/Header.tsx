import React, { useState } from 'react';
import { Sun, Moon, ShieldCheck, Shield, Download, ArrowLeft } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface HeaderProps {
  pageTitle: string;
  showBackButton?: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSecurityEnabled: boolean;
  isUnlocked: boolean;
  onLockClick: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  showBackButton = false,
  isDarkMode,
  onToggleDarkMode,
  isSecurityEnabled,
  isUnlocked,
  onLockClick,
  onGoHome,
}) => {
  const { isInstallable, install, isIOS } = usePWAInstall();
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-[#060d1d]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {showBackButton ? (
            <button
              type="button"
              onClick={onGoHome}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
              aria-label="Retour à l'accueil"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoHome}
              className="lg:hidden w-8 h-8 rounded-lg overflow-hidden border border-amber-400/40 bg-[#0b1f42] shrink-0"
              aria-label="Accueil SHALOM"
            >
              <img
                src="./shalom_logo.jpg"
                alt="SHALOM"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-[1.06]"
              />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate font-display">
              {pageTitle}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 lg:hidden leading-none mt-0.5">
              SHALOM · La foi au quotidien
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInstallable && (
            <button
              type="button"
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Installer</span>
            </button>
          )}

          {isIOS && (
            <button
              type="button"
              onClick={() => setShowIosPrompt(true)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              + iOS
            </button>
          )}

          {isSecurityEnabled && (
            <button
              type="button"
              onClick={onLockClick}
              className={`h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border transition ${
                isUnlocked
                  ? 'text-emerald-700 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'text-amber-700 border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 dark:text-amber-300'
              }`}
              title="Verrouiller l'application maintenant"
            >
              {isUnlocked ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              <span className="hidden sm:inline">Verrouiller</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Basculer le thème"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 transition"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {showIosPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 text-center">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Installer SHALOM sur iPhone / iPad
            </h4>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left">
              1. Touchez l’icône <strong>Partager</strong> dans Safari.<br />
              2. Touchez <strong>Sur l’écran d’accueil</strong>.<br />
              3. Accédez à SHALOM même hors-ligne.
            </p>
            <button
              type="button"
              onClick={() => setShowIosPrompt(false)}
              className="mt-4 w-full rounded-xl bg-blue-700 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
