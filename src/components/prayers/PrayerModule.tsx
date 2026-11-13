import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Clock,
  Sparkles,
  Lock,
  Globe,
  Share2,
  Trash2,
  Edit2,
  BookOpen,
  Users,
  Image as ImageIcon,
  Video,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import { PrayerItem, TestimonyItem, PrayerCategory, PrayerStatus, Contact } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface PrayerModuleProps {
  onShareWithContacts?: (contacts: Contact[], text: string) => void;
  onOpenWhatsAppShare?: (text: string) => void;
}

const TestimonyMediaPreview: React.FC<{
  blobKey?: string;
  mediaType?: 'image' | 'video';
}> = ({ blobKey, mediaType }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    if (blobKey) {
      dbService.getMediaBlob(blobKey).then((blob) => {
        if (active && blob) {
          objUrl = URL.createObjectURL(blob);
          setUrl(objUrl);
        }
      });
    }
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [blobKey]);

  if (!blobKey || !url) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
      {mediaType === 'video' ? (
        <video src={url} controls playsInline className="w-full max-h-56 object-contain" />
      ) : (
        <img
          src={url}
          alt="Média du témoignage"
          className="w-full max-h-56 object-cover"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

export const PrayerModule: React.FC<PrayerModuleProps> = ({
  onShareWithContacts,
  onOpenWhatsAppShare,
}) => {
  const { prayers, testimonies, contacts, reloadData } = useShalomDB();
  const [activeTab, setActiveTab] = useState<'requests' | 'testimonies'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Prayer Modal
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState<PrayerItem | null>(null);
  const [prayerForm, setPrayerForm] = useState<{
    title: string;
    description: string;
    category: PrayerCategory;
    bibleVerse: string;
    notes: string;
    status: PrayerStatus;
    isPrivate: boolean;
    authorizedContactIds: string[];
    nextFollowUpDate: string;
  }>({
    title: '',
    description: '',
    category: 'personnelle',
    bibleVerse: '',
    notes: '',
    status: 'en_priere',
    isPrivate: true,
    authorizedContactIds: [],
    nextFollowUpDate: '',
  });

  // Directory Contact Picker Modal when selecting "Partageable"
  const [isDirectoryPickerOpen, setIsDirectoryPickerOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');

  // Testimony Modal + Media attachment
  const [isTestimonyModalOpen, setIsTestimonyModalOpen] = useState(false);
  const [testimonyForm, setTestimonyForm] = useState<{
    title: string;
    content: string;
    bibleVerse: string;
    category: PrayerCategory;
    authorName: string;
  }>({
    title: '',
    content: '',
    bibleVerse: '',
    category: 'reconnaissance',
    authorName: '',
  });
  const [testimonyMediaFile, setTestimonyMediaFile] = useState<{
    file: File;
    mediaType: 'image' | 'video';
    previewUrl: string;
  } | null>(null);

  // Evolution modal
  const [evolutionPrayer, setEvolutionPrayer] = useState<PrayerItem | null>(null);
  const [evolutionNote, setEvolutionNote] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'prayer' | 'testimony'>('prayer');

  const CATEGORIES: { id: PrayerCategory; label: string }[] = [
    { id: 'personnelle', label: 'Prière Personnelle' },
    { id: 'famille', label: 'Famille' },
    { id: 'sante', label: 'Santé & Guérison' },
    { id: 'travail', label: 'Travail & Emploi' },
    { id: 'etudes', label: 'Études & Examens' },
    { id: 'finances', label: 'Finances & Pourvoyance' },
    { id: 'relations', label: 'Relations & Réconciliation' },
    { id: 'reconnaissance', label: 'Reconnaissance & Louange' },
    { id: 'intercession', label: 'Intercession Spéciale' },
    { id: 'autre', label: 'Autre' },
  ];

  const STATUSES: { id: PrayerStatus; label: string; textClass: string }[] = [
    { id: 'nouvelle', label: 'Nouvelle', textClass: 'text-slate-600 dark:text-slate-300' },
    { id: 'en_priere', label: 'En Prière', textClass: 'text-blue-700 dark:text-blue-400' },
    { id: 'en_evolution', label: 'En Évolution', textClass: 'text-amber-700 dark:text-amber-400' },
    { id: 'en_attente', label: 'En Attente', textClass: 'text-purple-700 dark:text-purple-400' },
    { id: 'exaucee', label: 'Exaucée', textClass: 'text-emerald-700 dark:text-emerald-400' },
    { id: 'archivee', label: 'Archivée', textClass: 'text-slate-400' },
  ];

  const filteredPrayers = prayers.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.bibleVerse && p.bibleVerse.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenAddPrayer = () => {
    setEditingPrayer(null);
    setPrayerForm({
      title: '',
      description: '',
      category: 'personnelle',
      bibleVerse: '',
      notes: '',
      status: 'en_priere',
      isPrivate: true,
      authorizedContactIds: [],
      nextFollowUpDate: '',
    });
    setIsPrayerModalOpen(true);
  };

  const handleOpenEditPrayer = (p: PrayerItem) => {
    setEditingPrayer(p);
    setPrayerForm({
      title: p.title,
      description: p.description,
      category: p.category,
      bibleVerse: p.bibleVerse || '',
      notes: p.notes || '',
      status: p.status,
      isPrivate: p.isPrivate,
      authorizedContactIds: p.authorizedContactIds || [],
      nextFollowUpDate: p.nextFollowUpDate || '',
    });
    setIsPrayerModalOpen(true);
  };

  const handleToggleShareable = (shareable: boolean) => {
    setPrayerForm((prev) => ({ ...prev, isPrivate: !shareable }));
    if (shareable) {
      // Automatically open the contact directory picker when user selects Partageable
      setIsDirectoryPickerOpen(true);
    }
  };

  const handleToggleAuthorizedContact = (contactId: string) => {
    setPrayerForm((prev) => {
      const exists = prev.authorizedContactIds.includes(contactId);
      return {
        ...prev,
        authorizedContactIds: exists
          ? prev.authorizedContactIds.filter((id) => id !== contactId)
          : [...prev.authorizedContactIds, contactId],
      };
    });
  };

  const handleSavePrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerForm.title.trim()) return;

    const selectedContacts = contacts.filter((c) =>
      prayerForm.authorizedContactIds.includes(c.id)
    );
    const authNames = selectedContacts.map((c) => `${c.firstName} ${c.lastName}`.trim());

    const now = new Date().toISOString();
    const itemToSave: PrayerItem = {
      id: editingPrayer ? editingPrayer.id : `p_${Date.now()}`,
      title: prayerForm.title.trim(),
      description: prayerForm.description.trim(),
      category: prayerForm.category,
      bibleVerse: prayerForm.bibleVerse.trim() || undefined,
      notes: prayerForm.notes.trim() || undefined,
      status: prayerForm.status,
      isPrivate: prayerForm.isPrivate,
      authorizedContactIds: !prayerForm.isPrivate ? prayerForm.authorizedContactIds : undefined,
      authorizedPersons: !prayerForm.isPrivate && authNames.length > 0 ? authNames : undefined,
      nextFollowUpDate: prayerForm.nextFollowUpDate || undefined,
      history: editingPrayer ? editingPrayer.history : [],
      createdAt: editingPrayer ? editingPrayer.createdAt : now,
      updatedAt: now,
      answeredAt:
        prayerForm.status === 'exaucee'
          ? editingPrayer?.answeredAt || now.split('T')[0]
          : undefined,
    };

    await dbService.put(STORES.PRAYERS, itemToSave);

    if (prayerForm.status === 'exaucee' && (!editingPrayer || editingPrayer.status !== 'exaucee')) {
      const autoTestimony: TestimonyItem = {
        id: `test_${Date.now()}`,
        title: `Prière Exaucée : ${itemToSave.title}`,
        content: itemToSave.description,
        date: new Date().toISOString().split('T')[0],
        bibleVerse: itemToSave.bibleVerse,
        category: itemToSave.category,
        prayerId: itemToSave.id,
        authorName: 'Témoignage SHALOM',
        createdAt: now,
      };
      await dbService.put(STORES.TESTIMONIES, autoTestimony);
    }

    setIsPrayerModalOpen(false);
    reloadData();
  };

  const handleSharePrayerToSelected = (prayer: PrayerItem) => {
    const text = `🙏 *SUJET DE PRIÈRE - SHALOM*\n\n*${prayer.title}*\n${prayer.description}\n${
      prayer.bibleVerse ? `\n📖 ${prayer.bibleVerse}` : ''
    }\n\nMerci de porter ce sujet dans vos prières.`;

    const targetContacts = contacts.filter((c) =>
      prayer.authorizedContactIds?.includes(c.id)
    );

    if (targetContacts.length > 0 && onShareWithContacts) {
      onShareWithContacts(targetContacts, text);
    } else if (onOpenWhatsAppShare) {
      onOpenWhatsAppShare(text);
    } else if (navigator.share) {
      navigator.share({ title: prayer.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Sujet de prière copié !');
    }
  };

  const handleAddEvolution = async () => {
    if (!evolutionPrayer || !evolutionNote.trim()) return;
    const now = new Date().toISOString().split('T')[0];
    const updatedHistory = [
      ...(evolutionPrayer.history || []),
      { date: now, text: evolutionNote.trim() },
    ];
    const updated: PrayerItem = {
      ...evolutionPrayer,
      history: updatedHistory,
      updatedAt: new Date().toISOString(),
    };
    await dbService.put(STORES.PRAYERS, updated);
    setEvolutionPrayer(null);
    setEvolutionNote('');
    reloadData();
  };

  const handleSelectTestimonyMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (testimonyMediaFile?.previewUrl) {
      URL.revokeObjectURL(testimonyMediaFile.previewUrl);
    }
    const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    setTestimonyMediaFile({ file, mediaType, previewUrl });
  };

  const handleSaveTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonyForm.title.trim() || !testimonyForm.content.trim()) return;

    let mediaBlobKey: string | undefined;
    let mediaType: 'image' | 'video' | undefined;
    let mediaMimeType: string | undefined;

    if (testimonyMediaFile) {
      mediaBlobKey = `test_media_${Date.now()}`;
      mediaType = testimonyMediaFile.mediaType;
      mediaMimeType = testimonyMediaFile.file.type;
      await dbService.saveMediaBlob(mediaBlobKey, testimonyMediaFile.file, mediaMimeType);
      URL.revokeObjectURL(testimonyMediaFile.previewUrl);
    }

    const newTestimony: TestimonyItem = {
      id: `test_${Date.now()}`,
      title: testimonyForm.title.trim(),
      content: testimonyForm.content.trim(),
      date: new Date().toISOString().split('T')[0],
      bibleVerse: testimonyForm.bibleVerse.trim() || undefined,
      category: testimonyForm.category,
      authorName: testimonyForm.authorName.trim() || 'Fidèle SHALOM',
      mediaBlobKey,
      mediaType,
      mediaMimeType,
      createdAt: new Date().toISOString(),
    };

    await dbService.put(STORES.TESTIMONIES, newTestimony);
    setTestimonyMediaFile(null);
    setTestimonyForm({
      title: '',
      content: '',
      bibleVerse: '',
      category: 'reconnaissance',
      authorName: '',
    });
    setIsTestimonyModalOpen(false);
    reloadData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    if (deleteType === 'prayer') {
      await dbService.deleteItem(STORES.PRAYERS, deletingId);
    } else {
      const t = testimonies.find((item) => item.id === deletingId);
      if (t?.mediaBlobKey) {
        await dbService.deleteItem(STORES.MEDIA_BLOBS, t.mediaBlobKey);
      }
      await dbService.deleteItem(STORES.TESTIMONIES, deletingId);
    }
    setDeletingId(null);
    reloadData();
  };

  const handleShareTestimony = (t: TestimonyItem) => {
    const text = `🙌 *TÉMOIGNAGE DE FOI - SHALOM*\n\n*${t.title}*\n${t.content}\n\n${
      t.bibleVerse ? `📖 ${t.bibleVerse}\n\n` : ''
    }« Rendez grâces au Seigneur, car il est bon ! »`;
    if (onOpenWhatsAppShare) {
      onOpenWhatsAppShare(text);
    } else if (navigator.share) {
      navigator.share({ title: t.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Témoignage copié dans le presse-papier !');
    }
  };

  const filteredDirectoryContacts = contacts.filter((c) => {
    const q = directorySearch.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.phone.includes(directorySearch)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
            Vie de Prière & Témoignages
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Journal personnel, requêtes partageables avec votre répertoire et témoignages de gloire
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'requests'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Requêtes ({prayers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('testimonies')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'testimonies'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Témoignages ({testimonies.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Prayer Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une requête, un verset..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">Toutes catégories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">Tous statuts</option>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenAddPrayer}
              className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Prière</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPrayers.map((prayer) => {
              const statusObj = STATUSES.find((s) => s.id === prayer.status);
              const catObj = CATEGORIES.find((c) => c.id === prayer.category);

              return (
                <div
                  key={prayer.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${statusObj?.textClass}`}>
                          {statusObj?.label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{catObj?.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prayer.isPrivate ? (
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <Lock className="w-3 h-3" /> Privée
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                            <Globe className="w-3 h-3" /> Partageable
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{prayer.createdAt.split('T')[0]}</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {prayer.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {prayer.description}
                    </p>

                    {prayer.bibleVerse && (
                      <p className="text-xs text-blue-800 dark:text-blue-300 font-serif italic flex items-start gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                        <span>{prayer.bibleVerse}</span>
                      </p>
                    )}

                    {!prayer.isPrivate && prayer.authorizedPersons && prayer.authorizedPersons.length > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Partagé avec : {prayer.authorizedPersons.join(', ')}</span>
                      </p>
                    )}

                    {prayer.nextFollowUpDate && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Rappel : {prayer.nextFollowUpDate}</span>
                      </p>
                    )}

                    {prayer.history && prayer.history.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Évolutions ({prayer.history.length})
                        </span>
                        {prayer.history.slice(-2).map((h, idx) => (
                          <div key={idx} className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                              [{h.date}]
                            </span>{' '}
                            {h.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEvolutionPrayer(prayer)}
                        className="text-blue-700 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Évolution</span>
                      </button>

                      {!prayer.isPrivate && (
                        <button
                          type="button"
                          onClick={() => handleSharePrayerToSelected(prayer)}
                          className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmettre</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPrayer(prayer)}
                        aria-label="Modifier"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingId(prayer.id);
                          setDeleteType('prayer');
                        }}
                        aria-label="Supprimer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPrayers.length === 0 && (
              <div className="col-span-full py-12 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800">
                <HeartHandshake className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Aucune requête trouvée.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddPrayer}
                  className="mt-3 px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
                >
                  Ajouter une requête de prière
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Testimonies */}
      {activeTab === 'testimonies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Célébrez les prières exaucées avec photo ou vidéo à l’appui.
            </p>
            <button
              type="button"
              onClick={() => setIsTestimonyModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Publier un Témoignage</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonies.map((testimony) => (
              <div
                key={testimony.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      Témoignage Exaucé
                    </span>
                    <span className="tabular-nums">{testimony.date}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {testimony.title}
                  </h3>

                  {testimony.mediaBlobKey && (
                    <TestimonyMediaPreview
                      blobKey={testimony.mediaBlobKey}
                      mediaType={testimony.mediaType}
                    />
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {testimony.content}
                  </p>

                  {testimony.bibleVerse && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-serif italic">
                      {testimony.bibleVerse}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400">
                    Par {testimony.authorName || 'Fidèle SHALOM'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleShareTestimony(testimony)}
                    className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1.5 hover:underline"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Partager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeletingId(testimony.id);
                      setDeleteType('testimony');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {testimonies.length === 0 && (
              <div className="col-span-full py-12 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800">
                <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Aucun témoignage enregistré pour le moment.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTestimonyModalOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Publier le premier témoignage
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: New / Edit Prayer */}
      <Modal
        isOpen={isPrayerModalOpen}
        onClose={() => setIsPrayerModalOpen(false)}
        title={editingPrayer ? 'Modifier la Prière' : 'Nouvelle Requête de Prière'}
        subtitle="Confidentialité locale : choisissez si la prière reste privée ou partagée avec des contacts précis"
      >
        <form onSubmit={handleSavePrayer} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Titre du sujet de prière *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Guérison, examen, protection..."
              value={prayerForm.title}
              onChange={(e) => setPrayerForm({ ...prayerForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catégorie *
              </label>
              <select
                value={prayerForm.category}
                onChange={(e) => setPrayerForm({ ...prayerForm, category: e.target.value as PrayerCategory })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Statut *
              </label>
              <select
                value={prayerForm.status}
                onChange={(e) => setPrayerForm({ ...prayerForm, status: e.target.value as PrayerStatus })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description détaillée
            </label>
            <textarea
              rows={3}
              value={prayerForm.description}
              onChange={(e) => setPrayerForm({ ...prayerForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Verset biblique d’appui
              </label>
              <input
                type="text"
                placeholder="Ex: Jérémie 30:17"
                value={prayerForm.bibleVerse}
                onChange={(e) => setPrayerForm({ ...prayerForm, bibleVerse: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prochain rappel
              </label>
              <input
                type="date"
                value={prayerForm.nextFollowUpDate}
                onChange={(e) => setPrayerForm({ ...prayerForm, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Privacy vs Directory Selection */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Confidentialité & Partage
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggleShareable(false)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  prayerForm.isPrivate
                    ? 'bg-white dark:bg-[#0f2b5c] border-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Privée (Moi seul)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleShareable(true)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  !prayerForm.isPrivate
                    ? 'bg-white dark:bg-[#0f2b5c] border-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Partageable</span>
              </button>
            </div>

            {!prayerForm.isPrivate && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>{prayerForm.authorizedContactIds.length}</strong> personne(s) sélectionnée(s) dans le répertoire
                </div>
                <button
                  type="button"
                  onClick={() => setIsDirectoryPickerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Ouvrir le répertoire</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPrayerModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Directory Contact Picker for Shareable Prayer */}
      <Modal
        isOpen={isDirectoryPickerOpen}
        onClose={() => setIsDirectoryPickerOpen(false)}
        title="Sélectionner les personnes autorisées"
        subtitle="Choisissez dans votre répertoire à qui partager ce sujet de prière"
        maxWidth="md"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un nom ou numéro..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {filteredDirectoryContacts.map((c) => {
              const checked = prayerForm.authorizedContactIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleToggleAuthorizedContact(c.id)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                    checked
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {c.phone} · {c.category}
                    </span>
                  </div>
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
              );
            })}

            {filteredDirectoryContacts.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">
                Aucun contact trouvé dans le répertoire.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              {prayerForm.authorizedContactIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => setIsDirectoryPickerOpen(false)}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
            >
              Valider la sélection
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Evolution */}
      <Modal
        isOpen={!!evolutionPrayer}
        onClose={() => setEvolutionPrayer(null)}
        title="Ajouter une Évolution"
        subtitle={evolutionPrayer?.title}
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            placeholder="Note d’évolution ou réponse constatée..."
            value={evolutionNote}
            onChange={(e) => setEvolutionNote(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEvolutionPrayer(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAddEvolution}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Publish Testimony (with Image / Video upload) */}
      <Modal
        isOpen={isTestimonyModalOpen}
        onClose={() => {
          setIsTestimonyModalOpen(false);
          if (testimonyMediaFile?.previewUrl) URL.revokeObjectURL(testimonyMediaFile.previewUrl);
          setTestimonyMediaFile(null);
        }}
        title="Publier un Témoignage"
        subtitle="Partagez ce que Dieu a accompli avec photo ou vidéo facultative"
      >
        <form onSubmit={handleSaveTestimony} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Titre du témoignage *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Dieu a répondu à notre prière..."
              value={testimonyForm.title}
              onChange={(e) => setTestimonyForm({ ...testimonyForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Récit du témoignage *
            </label>
            <textarea
              rows={4}
              required
              value={testimonyForm.content}
              onChange={(e) => setTestimonyForm({ ...testimonyForm, content: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Optional Image or Video attachment */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Image ou vidéo (facultatif)
              </span>
              <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Choisir un fichier</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleSelectTestimonyMedia}
                  className="hidden"
                />
              </label>
            </div>

            {testimonyMediaFile && (
              <div className="space-y-1.5">
                {testimonyMediaFile.mediaType === 'video' ? (
                  <video
                    src={testimonyMediaFile.previewUrl}
                    controls
                    className="w-full max-h-40 rounded-lg bg-black"
                  />
                ) : (
                  <img
                    src={testimonyMediaFile.previewUrl}
                    alt="Aperçu"
                    className="w-full max-h-40 object-cover rounded-lg"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(testimonyMediaFile.previewUrl);
                    setTestimonyMediaFile(null);
                  }}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  Retirer le média
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Verset biblique
              </label>
              <input
                type="text"
                placeholder="Ex: Psaume 103:1-2"
                value={testimonyForm.bibleVerse}
                onChange={(e) => setTestimonyForm({ ...testimonyForm, bibleVerse: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Auteur / Famille
              </label>
              <input
                type="text"
                placeholder="Ex: Sœur Sarah"
                value={testimonyForm.authorName}
                onChange={(e) => setTestimonyForm({ ...testimonyForm, authorName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTestimonyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Publier
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Supprimer cet élément ?"
        message="Cette action est irréversible et supprimera définitivement cette entrée de votre stockage local."
        confirmLabel="Supprimer"
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
