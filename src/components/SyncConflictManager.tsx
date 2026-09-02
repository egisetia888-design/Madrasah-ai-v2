import React, { useState } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useNotesStore } from '../store/notesStore';
import { useWritingStore } from '../store/writingStore';
import { useLibraryStore } from '../store/libraryStore';
import { useProjectsStore } from '../store/projectsStore';
import { SyncConflictModal } from './SyncConflictModal';
import { syncSaveNote, syncSaveDraft, syncSaveBook, syncSaveProject } from '../lib/firestoreSync';

export function SyncConflictManager() {
  const notes = useNotesStore((state) => state.notes);
  const drafts = useWritingStore((state) => state.drafts);
  const books = useLibraryStore((state) => state.books);
  const projects = useProjectsStore((state) => state.projects);

  const [activeConflict, setActiveConflict] = useState<{
    entityType: 'note' | 'draft' | 'book' | 'project';
    entityName: string;
    data: any;
  } | null>(null);

  // Find any conflicting entities
  const conflictNote = notes.find((n) => n.syncStatus === 'conflict' && n.conflict);
  const conflictDraft = drafts.find((d) => d.syncStatus === 'conflict' && d.conflict);
  const conflictBook = books.find((b) => b.syncStatus === 'conflict' && b.conflict);
  const conflictProject = projects.find((p) => p.syncStatus === 'conflict' && p.conflict);

  const totalConflicts = [conflictNote, conflictDraft, conflictBook, conflictProject].filter(Boolean).length;

  if (totalConflicts === 0 && !activeConflict) {
    return null;
  }

  const handleResolveLocal = async () => {
    if (!activeConflict) return;
    const { entityType, data } = activeConflict;
    const nextRevision = (data.conflict?.remoteRevision || data.revision || 1) + 1;
    const resolvedItem = {
      ...data,
      revision: nextRevision,
      syncStatus: 'pending_sync' as const,
      conflict: undefined,
      updatedAt: Date.now(),
    };

    if (entityType === 'note') {
      useNotesStore.setState((state) => ({
        notes: state.notes.map((n) => (n.id === data.id ? resolvedItem : n)),
      }));
      await syncSaveNote(resolvedItem);
    } else if (entityType === 'draft') {
      useWritingStore.setState((state) => ({
        drafts: state.drafts.map((d) => (d.id === data.id ? resolvedItem : d)),
      }));
      await syncSaveDraft(resolvedItem);
    } else if (entityType === 'book') {
      useLibraryStore.setState((state) => ({
        books: state.books.map((b) => (b.id === data.id ? resolvedItem : b)),
      }));
      await syncSaveBook(resolvedItem);
    } else if (entityType === 'project') {
      useProjectsStore.setState((state) => ({
        projects: state.projects.map((p) => (p.id === data.id ? resolvedItem : p)),
      }));
      await syncSaveProject(resolvedItem);
    }

    setActiveConflict(null);
  };

  const handleResolveRemote = () => {
    if (!activeConflict) return;
    const { entityType, data } = activeConflict;
    const remoteData = {
      ...data.conflict.remoteData,
      syncStatus: 'synced' as const,
      conflict: undefined,
    };

    if (entityType === 'note') {
      useNotesStore.setState((state) => ({
        notes: state.notes.map((n) => (n.id === data.id ? remoteData : n)),
      }));
    } else if (entityType === 'draft') {
      useWritingStore.setState((state) => ({
        drafts: state.drafts.map((d) => (d.id === data.id ? remoteData : d)),
      }));
    } else if (entityType === 'book') {
      useLibraryStore.setState((state) => ({
        books: state.books.map((b) => (b.id === data.id ? remoteData : b)),
      }));
    } else if (entityType === 'project') {
      useProjectsStore.setState((state) => ({
        projects: state.projects.map((p) => (p.id === data.id ? remoteData : p)),
      }));
    }

    setActiveConflict(null);
  };

  return (
    <>
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center justify-between text-white text-xs sm:text-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-gray-300 shrink-0" />
          <span className="font-medium">
            Terdeteksi {totalConflicts} konflik data antara versi lokal dan Cloud.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {conflictNote && (
            <button
              onClick={() => setActiveConflict({ entityType: 'note', entityName: `Catatan: ${conflictNote.title}`, data: conflictNote })}
              className="px-2.5 py-1 bg-white text-gray-900 hover:bg-gray-100 rounded-md font-medium text-xs transition-colors"
            >
              Resolusi Catatan
            </button>
          )}
          {conflictDraft && (
            <button
              onClick={() => setActiveConflict({ entityType: 'draft', entityName: `Tulisan: ${conflictDraft.title}`, data: conflictDraft })}
              className="px-2.5 py-1 bg-white text-gray-900 hover:bg-gray-100 rounded-md font-medium text-xs transition-colors"
            >
              Resolusi Tulisan
            </button>
          )}
          {conflictBook && (
            <button
              onClick={() => setActiveConflict({ entityType: 'book', entityName: `Buku: ${conflictBook.title}`, data: conflictBook })}
              className="px-2.5 py-1 bg-white text-gray-900 hover:bg-gray-100 rounded-md font-medium text-xs transition-colors"
            >
              Resolusi Buku
            </button>
          )}
          {conflictProject && (
            <button
              onClick={() => setActiveConflict({ entityType: 'project', entityName: `Proyek: ${conflictProject.title}`, data: conflictProject })}
              className="px-2.5 py-1 bg-white text-gray-900 hover:bg-gray-100 rounded-md font-medium text-xs transition-colors"
            >
              Resolusi Proyek
            </button>
          )}
        </div>
      </div>

      {activeConflict && (
        <SyncConflictModal
          isOpen={true}
          onClose={() => setActiveConflict(null)}
          entityName={activeConflict.entityName}
          localData={activeConflict.data}
          onResolveLocal={handleResolveLocal}
          onResolveRemote={handleResolveRemote}
        />
      )}
    </>
  );
}
