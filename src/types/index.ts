export type UUID = string;

export type SyncStatus = 'local_only' | 'pending_sync' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface ConflictData {
  detectedAt: number;
  localRevision: number;
  remoteRevision: number;
  remoteData: any;
  reason: 'concurrent_edit' | 'stale_local';
  resolution?: 'local_wins' | 'remote_wins' | 'manual_merge';
}

export interface SyncMetadata {
  revision: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  conflict?: ConflictData;
}

export interface Author extends SyncMetadata {
  id: UUID;
  name: string;
  createdAt: number;
}

export interface Category extends SyncMetadata {
  id: UUID;
  name: string;
  createdAt: number;
}

export type BookStatus = 'wishlist' | 'owned' | 'reading' | 'finished' | 'summarized' | 'connected' | 'applied' | 'published';

export interface Book extends SyncMetadata {
  id: UUID;
  title: string;
  authorId: UUID | null;
  categoryId: UUID | null;
  status: BookStatus;
  progress: number;
  totalPages?: number;
  coverImage?: string;
  isEstimatedPages?: boolean;
  createdAt: number;
}

export interface BookInfoResponse {
  totalPages: number;
  coverUrl: string;
  isEstimated: boolean;
}

export type NoteType = 'fleeting' | 'literature' | 'permanent' | 'knowledge' | 'project' | 'writing' | 'personal' | 'research';
export type NoteStatus = 'unprocessed' | 'processed';

export interface SourceFragment extends SyncMetadata {
  id: UUID;
  sourceId: UUID | null;
  quote: string;
  location: string;
  context?: string;
  reliabilityScore: number;
  createdAt: number;
}

export type ConceptEvolutionStatus = 'emerging' | 'defined' | 'mastered';

export type EpistemicDomain = 'umum' | 'akidah' | 'fiqih' | 'tasawuf' | 'sejarah';

export interface Concept extends SyncMetadata {
  id: UUID;
  name: string;
  definition: string;
  aliases: string[];
  evolutionStatus: ConceptEvolutionStatus;
  epistemicDomain?: EpistemicDomain;
  createdAt: number;
}

export interface Note extends SyncMetadata {
  id: UUID;
  title: string;
  content: string;
  rawQuote?: string;
  referenceCitation?: string;
  type: NoteType;
  status: NoteStatus;
  sourceId?: UUID | null;
  folderId: UUID | null;
  tags: UUID[];
  embedding?: number[];
  icon?: string;
  epistemicDomain?: EpistemicDomain;
  createdAt: number;
}

export interface Folder extends SyncMetadata {
  id: UUID;
  name: string;
  parentId: UUID | null;
  createdAt: number;
}

export interface Tag extends SyncMetadata {
  id: UUID;
  name: string;
}

export interface LearningPath extends SyncMetadata {
  id: UUID;
  title: string;
  description: string;
  createdAt: number;
}

export interface Phase extends SyncMetadata {
  id: UUID;
  pathId: UUID;
  title: string;
  order: number;
}

export type CompetencyStatus = 'not-started' | 'in-progress' | 'done';

export interface Competency extends SyncMetadata {
  id: UUID;
  phaseId: UUID;
  title: string;
  status: CompetencyStatus;
  order: number;
  bookIds: UUID[];
  outputIds: UUID[];
  assessmentStatus?: 'pending' | 'passed' | 'failed';
}

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type ProjectStatus = 'planned' | 'active' | 'review' | 'completed' | 'archived';

export interface Project extends SyncMetadata {
  id: UUID;
  title: string;
  description: string;
  status: ProjectStatus;
  dueDate?: number;
  createdAt: number;
}

export interface Task extends SyncMetadata {
  id: UUID;
  projectId: UUID | null;
  title: string;
  status: TaskStatus;
  order: number;
  createdAt: number;
}

export type WritingStatus = 'idea' | 'outline' | 'draft' | 'editing' | 'review' | 'published';

export interface Draft extends SyncMetadata {
  id: UUID;
  title: string;
  content: string;
  status: WritingStatus;
  embedding?: number[];
  icon?: string;
  tags?: string[];
  createdAt: number;
}

export type NodeType = 'note' | 'book' | 'author' | 'concept' | 'writing' | 'project' | 'source_fragment';

export interface Node {
  id: UUID;
  label: string;
  type: NodeType;
}

export interface Edge {
  id: UUID;
  source: UUID;
  target: UUID;
  label?: string;
  verifiedBySystem?: boolean;
}

export type RelationType = 'supports' | 'contradicts' | 'expands_on' | 'defines' | 'is_a' | 'part_of' | 'references' | 'applies';
export type RelationCreator = 'user' | 'ai_agent';

export interface Relation extends SyncMetadata {
  id: UUID;
  sourceNodeId: UUID;
  targetNodeId: UUID;
  relationType: RelationType;
  confidenceScore: number;
  createdBy: RelationCreator;
  explanation?: string;
  verifiedBySystem: boolean;
  createdAt: number;
}


export interface Deck extends SyncMetadata {
  id: UUID;
  name: string;
  description: string;
  noteId?: UUID | null;
  conceptId?: UUID | null;
  createdAt: number;
}

export interface Flashcard extends SyncMetadata {
  id: UUID;
  front: string;
  back: string;
  deckId: UUID | null;
  noteId?: UUID | null;
  conceptId?: UUID | null;
  interval: number;
  repetition: number;
  efactor: number;
  dueDate: number;
  createdAt: number;
}
