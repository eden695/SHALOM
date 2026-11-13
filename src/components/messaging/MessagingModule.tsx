import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  SkipForward,
  ExternalLink,
  Check,
  Search,
  CheckSquare,
  Square,
  Smartphone,
  Upload,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { pickContactsFromDevice, importContactsFromVcfOrCsv } from '../../services/phoneContacts';
import { useShalomDB } from '../../hooks/useShalomDB';
import { Contact, MessageTemplate, ShareHistoryItem } from '../../types';

interface MessagingModuleProps {
  initialContacts?: Contact[];
  onClose?: () => void;
}

export const MessagingModule: React.FC<MessagingModuleProps> = ({
  initialContacts,
  onClose,
}) => {
  const { contacts, messageTemplates, reloadData } = useShalomDB();

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialContacts && initialContacts.length > 0 ? initialContacts.map((c) => c.id) : []
  );
  const [extraRecipients, setExtraRecipients] = useState<Contact[]>(() =>
    initialContacts
      ? initialContacts.filter((ic) => !contacts.some((c) => c.id === ic.id))
      : []
  );
  const [recipientSearch, setRecipientSearch] = useState('');
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  useEffect(() => {
    if (initialContacts && initialContacts.length > 0) {
      setSelectedIds(initialContacts.map((c) => c.id));
      const extras = initialContacts.filter((ic) => !contacts.some((c) => c.id === ic.id));
      setExtraRecipients(extras);
    }
  }, [initialContacts, contacts]);

  const allAvailableContacts = [...extraRecipients, ...contacts];
  const filteredDirectory = allAvailableContacts.filter((c) => {
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      fullName.includes(recipientSearch.toLowerCase()) ||
      c.phone.includes(recipientSearch)
    );
  });

  const targetContacts = allAvailableContacts.filter((c) => selectedIds.includes(c.id));

  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    messageTemplates[0]?.id || ''
  );
  const [customMessage, setCustomMessage] = useState<string>(
    messageTemplates[0]?.content || 'Que la paix du Seigneur vous accompagne !'
  );
  const [themeVariable, setThemeVariable] = useState('La Paix Divine');

  useEffect(() => {
    if (!selectedTemplateId && messageTemplates.length > 0) {
      setSelectedTemplateId(messageTemplates[0].id);
      setCustomMessage(messageTemplates[0].content);
    }
  }, [messageTemplates, selectedTemplateId]);

  const [campaignStarted, setCampaignStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [campaignResults, setCampaignResults] = useState<
    Array<{ contact: Contact; status: 'confirme_envoye' | 'ignore' | 'echec' }>
  >([]);

  const activeContact = targetContacts[currentIndex];

  const renderMessageForContact = (templateText: string, contact: Contact) => {
    const today = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(new Date());

    return templateText
      .replace(/{{prenom}}/g, contact.firstName)
      .replace(/{{nom}}/g, contact.lastName)
      .replace(/{{theme}}/g, themeVariable)
      .replace(/{{date}}/g, today);
  };

  const currentPreviewMessage = activeContact
    ? renderMessageForContact(customMessage, activeContact)
    : '';

  const handleToggleRecipient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllFiltered = () => {
    const filteredIds = filteredDirectory.map((c) => c.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handlePickPhoneContacts = async () => {
    const res = await pickContactsFromDevice(allAvailableContacts);
    if (res.message) setInfoBanner(res.message);
    if (res.status === 'success' && res.contacts.length > 0) {
      const pickedIds = res.contacts.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pickedIds])));
      reloadData();
    }
  };

  const handleImportVcf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { contacts: imported, addedCount } = await importContactsFromVcfOrCsv(
      file,
      allAvailableContacts
    );
    if (imported.length > 0) {
      const importedIds = imported.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...importedIds])));
      setInfoBanner(
        `${imported.length} contact(s) sélectionné(s) (${addedCount} nouveau(x) ajouté(s)).`
      );
      reloadData();
    } else {
      setInfoBanner('Aucun contact valide trouvé dans ce fichier.');
    }
    e.target.value = '';
  };

  const handleQuickAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim() || !quickPhone.trim()) return;
    const parts = quickName.trim().split(/\s+/);
    const contact: Contact = {
      id: `c_quick_${Date.now()}`,
      firstName: parts[0] || quickName.trim(),
      lastName: parts.slice(1).join(' '),
      phone: quickPhone.trim(),
      category: 'personnel',
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.CONTACTS, contact);
    setSelectedIds((prev) => Array.from(new Set([...prev, contact.id])));
    setQuickName('');
    setQuickPhone('');
    setShowQuickAdd(false);
    setInfoBanner(`${contact.firstName} ajouté(e) et sélectionné(e).`);
    reloadData();
  };

  const handleSelectTemplate = (tpl: MessageTemplate) => {
    setSelectedTemplateId(tpl.id);
    setCustomMessage(tpl.content);
  };

  const handleStartCampaign = () => {
    if (targetContacts.length === 0) {
      setInfoBanner('Veuillez sélectionner au moins un destinataire dans la liste.');
      return;
    }
    setInfoBanner(null);
    setCampaignStarted(true);
    setCurrentIndex(0);
    setWaitingConfirmation(false);
    setCampaignResults([]);
  };

  const handleOpenExternalApp = () => {
    if (!activeContact) return;

    let cleanPhone = activeContact.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('0')) {
      cleanPhone = '+33' + cleanPhone.slice(1);
    }

    const encodedText = encodeURIComponent(currentPreviewMessage);
    const appUrl =
      channel === 'whatsapp'
        ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedText}`
        : `sms:${cleanPhone}?body=${encodedText}`;

    window.open(appUrl, '_blank');
    setWaitingConfirmation(true);
  };

  const handleConfirmResult = async (status: 'confirme_envoye' | 'ignore' | 'echec') => {
    if (!activeContact) return;

    const historyItem: ShareHistoryItem = {
      id: `share_${Date.now()}`,
      contactName: `${activeContact.firstName} ${activeContact.lastName}`.trim(),
      contactPhone: activeContact.phone,
      messageText: currentPreviewMessage,
      channel,
      status,
      timestamp: new Date().toISOString(),
    };

    await dbService.put(STORES.SHARE_HISTORY, historyItem);
    setCampaignResults((prev) => [...prev, { contact: activeContact, status }]);

    if (currentIndex + 1 < targetContacts.length) {
      setCurrentIndex((prev) => prev + 1);
      setWaitingConfirmation(false);
    } else {
      setCurrentIndex(targetContacts.length);
      setWaitingConfirmation(false);
      reloadData();
    }
  };

  const isCampaignFinished = campaignStarted && currentIndex >= targetContacts.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Partage WhatsApp & SMS</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choisissez vos destinataires dans votre répertoire et envoyez un message personnel avec confirmation manuelle.
          </p>
        </div>
      </div>

      {infoBanner && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{infoBanner}</span>
          </span>
          <button type="button" onClick={() => setInfoBanner(null)} className="font-bold underline shrink-0">
            Fermer
          </button>
        </div>
      )}

      {!campaignStarted ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Canal d’envoi
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                    channel === 'whatsapp'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    WA
                  </div>
                  <div className="text-left">
                    <span className="text-xs block font-bold">WhatsApp</span>
                    <span className="text-[10px] text-slate-500">Texte prérempli</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel('sms')}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                    channel === 'sms'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold ring-2 ring-blue-600/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    SMS
                  </div>
                  <div className="text-left">
                    <span className="text-xs block font-bold">SMS Natif</span>
                    <span className="text-[10px] text-slate-500">Messagerie du téléphone</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Votre message
              </label>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pb-1">
                {messageTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedTemplateId === tpl.id
                        ? 'bg-blue-700 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Variables :</span>
                {['{{prenom}}', '{{nom}}', '{{theme}}'].map((v) => (
                  <code key={v} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600">
                    {v}
                  </code>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sujet / thème ({'{{theme}}'})
                </label>
                <input
                  type="text"
                  value={themeVariable}
                  onChange={(e) => setThemeVariable(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                3. Destinataires ({targetContacts.length})
              </label>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handlePickPhoneContacts}
                  className="w-full px-3 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Ouvrir le répertoire du téléphone</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <label className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Importer .vcf</span>
                    <input type="file" accept=".vcf,.csv" onChange={handleImportVcf} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowQuickAdd((prev) => !prev)}
                    className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Saisir un numéro</span>
                  </button>
                </div>

                {showQuickAdd && (
                  <form
                    onSubmit={handleQuickAddContact}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Nom complet"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="tel"
                        required
                        placeholder="+33 6..."
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                      >
                        OK
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un contact..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleToggleAllFiltered}
                    className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Tout cocher / décocher
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {filteredDirectory.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleRecipient(c.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
                        checked
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white block truncate">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{c.phone}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredDirectory.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Aucun contact trouvé.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartCampaign}
                disabled={targetContacts.length === 0}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Send className="w-4 h-4" />
                <span>
                  Envoyer ({targetContacts.length} sélectionné{targetContacts.length > 1 ? 's' : ''})
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : isCampaignFinished ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 shadow-xl max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Envoi Terminé !
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tous les destinataires sélectionnés ont été traités.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {campaignResults.filter((r) => r.status === 'confirme_envoye').length}
              </span>
              <span className="text-[11px] block font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">
                Confirmés
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-2xl font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {campaignResults.filter((r) => r.status === 'ignore').length}
              </span>
              <span className="text-[11px] block font-semibold text-slate-500 mt-0.5">
                Ignorés
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40">
              <span className="text-2xl font-bold text-red-700 dark:text-red-300 tabular-nums">
                {campaignResults.filter((r) => r.status === 'echec').length}
              </span>
              <span className="text-[11px] block font-semibold text-red-800 dark:text-red-300 mt-0.5">
                Échecs
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCampaignStarted(false);
                setCurrentIndex(0);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Nouveau message
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 shadow-xl max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                Contact {currentIndex + 1} sur {targetContacts.length}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {activeContact.firstName} {activeContact.lastName}
              </h3>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-500">
                {activeContact.phone}
              </span>
              <span className="text-[10px] block text-slate-400">
                {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {currentPreviewMessage}
          </div>

          {!waitingConfirmation ? (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleOpenExternalApp}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ouvrir {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmResult('ignore')}
                  className="hover:underline flex items-center gap-1"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Ignorer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignStarted(false)}
                  className="text-red-500 hover:underline"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 space-y-3 text-center">
              <h4 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Le message a-t-il été envoyé ?
              </h4>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmResult('confirme_envoye')}
                  className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Envoyé</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmResult('ignore')}
                  className="py-2.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Ignorer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmResult('echec')}
                  className="py-2.5 px-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold text-xs flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Échec</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
