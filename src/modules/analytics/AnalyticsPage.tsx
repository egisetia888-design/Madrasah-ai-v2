import React from 'react';
import { Book, FileText, Briefcase, Brain, Edit3, Map } from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { useLibraryStore } from '../../store/libraryStore';
import { useNotesStore } from '../../store/notesStore';
import { useCurriculumStore } from '../../store/curriculumStore';
import { useReviewStore } from '../../store/reviewStore';
import { useWritingStore } from '../../store/writingStore';
import { useProjectsStore } from '../../store/projectsStore';

export function AnalyticsPage() {
  const books = useLibraryStore(state => state.books);
  const notes = useNotesStore(state => state.notes);
  const competencies = useCurriculumStore(state => state.competencies);
  const flashcards = useReviewStore(state => state.flashcards);
  const drafts = useWritingStore(state => state.drafts);
  const projects = useProjectsStore(state => state.projects);

  const notesDistribution = [
    { name: 'Knowledge', value: notes.filter(n => n.type === 'knowledge').length },
    { name: 'Project', value: notes.filter(n => n.type === 'project').length },
    { name: 'Writing', value: notes.filter(n => n.type === 'writing').length },
    { name: 'Personal', value: notes.filter(n => n.type === 'personal').length }
  ].filter(d => d.value > 0);

  const statusDistribution = [
    { name: 'Membaca', value: books.filter(b => b.status === 'reading').length },
    { name: 'Selesai', value: books.filter(b => b.status === 'finished').length },
    { name: 'Wishlist', value: books.filter(b => b.status === 'wishlist').length },
    { name: 'Dimiliki', value: books.filter(b => b.status === 'owned').length }
  ].filter(d => d.value > 0);
  
  const COLORS = ['#111827', '#374151', '#4b5563', '#6b7280', '#9ca3af'];

  const overviewStats = [
    { label: 'Buku', value: books.length, icon: Book },
    { label: 'Catatan', value: notes.length, icon: FileText },
    { label: 'Proyek', value: projects.length, icon: Briefcase },
    { label: 'Kompetensi', value: competencies.length, icon: Map },
    { label: 'Flashcard', value: flashcards.length, icon: Brain },
    { label: 'Tulisan', value: drafts.length, icon: Edit3 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analitik Ruang Kerja</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Rekapitulasi interaksi dan progres Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {overviewStats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-300 transition-colors">
            <stat.icon className="w-6 h-6 text-gray-400 mb-3" />
            <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Distribusi Catatan (Zettelkasten)</h3>
          {notesDistribution.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={notesDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {notesDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-sm text-gray-500 border-2 border-dashed border-gray-100 rounded-xl">
              <FileText className="w-8 h-8 text-gray-300 mb-2" />
              <p>Belum ada data catatan</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Status Pustaka Buku</h3>
          {statusDistribution.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} />
                  <RechartsTooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                  />
                  <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-sm text-gray-500 border-2 border-dashed border-gray-100 rounded-xl">
              <Book className="w-8 h-8 text-gray-300 mb-2" />
              <p>Belum ada data buku</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
