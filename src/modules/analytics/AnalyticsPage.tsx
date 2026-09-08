import React, { useMemo } from 'react';
import { Book, FileText, Briefcase, Brain, Edit3, Map, Clock, TrendingUp, BookOpen } from 'lucide-react';
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
  const readingLogs = useLibraryStore(state => state.readingLogs || []);
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

  // 7-day reading velocity data
  const last7DaysData = useMemo(() => {
    const days: { dateStr: string; label: string; pages: number }[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      
      const dayPages = readingLogs.reduce((acc, log) => {
        const logDateKey = new Date(log.date).toISOString().split('T')[0];
        return logDateKey === dateKey ? acc + (log.pagesRead || 0) : acc;
      }, 0);

      days.push({
        dateStr: dateKey,
        label: dayLabel,
        pages: dayPages,
      });
    }
    return days;
  }, [readingLogs]);

  const totalPagesRead = useMemo(() => {
    if (readingLogs.length > 0) {
      return readingLogs.reduce((sum, l) => sum + (l.pagesRead || 0), 0);
    }
    return books.reduce((sum, b) => sum + (b.progress || 0), 0);
  }, [readingLogs, books]);

  const avgPagesLast7Days = useMemo(() => {
    const sum = last7DaysData.reduce((acc, d) => acc + d.pages, 0);
    return Math.round((sum / 7) * 10) / 10;
  }, [last7DaysData]);

  const recentLogsWithBook = useMemo(() => {
    return [...readingLogs]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map(log => ({
        ...log,
        bookTitle: books.find(b => b.id === log.bookId)?.title || 'Buku Tidak Ditemukan'
      }));
  }, [readingLogs, books]);

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
          <h1 className="text-3xl font-display font-bold tracking-tight text-gray-900">Analitik Ruang Kerja</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Rekapitulasi interaksi, progres baca, dan produktivitas Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {overviewStats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-300 transition-colors">
            <stat.icon className="w-6 h-6 text-gray-400 mb-3" />
            <span className="text-3xl font-bold font-mono text-gray-900">{stat.value}</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Reading Velocity Section */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-display font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-700" />
              Aktivitas Membaca (7 Hari Terakhir)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Kecepatan dan konsistensi membaca harian berdasarkan riwayat sesi.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Total Dibaca:</span>
              <span className="font-mono font-bold text-gray-900">{totalPagesRead} hal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Rata-rata:</span>
              <span className="font-mono font-bold text-gray-900">{avgPagesLast7Days} hal/hari</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Sesi:</span>
              <span className="font-mono font-bold text-gray-900">{readingLogs.length} sesi</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} unit=" hal" />
                <RechartsTooltip
                  cursor={{ fill: '#f9fafb' }}
                  formatter={(value: any) => [`${value} halaman`, 'Dibaca']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Bar dataKey="pages" fill="#111827" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-6 pt-4 lg:pt-0">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Sesi Baca Terakhir
            </h4>
            {recentLogsWithBook.length > 0 ? (
              <div className="space-y-2.5">
                {recentLogsWithBook.map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">{log.bookTitle}</span>
                      <span className="font-mono bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded shrink-0">
                        +{log.pagesRead} hal
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                      <span>hal. {log.startPage} → {log.endPage}</span>
                      <span>{new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-4">
                <BookOpen className="w-6 h-6 text-gray-300 mb-2" />
                <p>Belum ada riwayat sesi.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Catat progres buku di Pustaka untuk merekam riwayat sesi.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-display font-bold text-gray-900 uppercase tracking-wider mb-6">Distribusi Catatan (Zettelkasten)</h3>
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
          <h3 className="text-sm font-display font-bold text-gray-900 uppercase tracking-wider mb-6">Status Pustaka Buku</h3>
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
