import { useState, useEffect } from 'react';
import { Clock, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HijriClockProps {
  mobileCompact?: boolean;
}

export function HijriClock({ mobileCompact = false }: HijriClockProps) {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hijriDate = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(time);

  const hijriDateFull = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(time);

  const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(time);
  const dayNameFull = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(time);

  const currentTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const currentTimeShort = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (mobileCompact) {
    return (
      <button 
        onClick={() => navigate('/analytics')}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-all text-left group shrink-0"
        title="Buka Analisis"
      >
        <div className="flex flex-col items-end text-right">
          <span className="text-[11px] font-semibold text-gray-900 tracking-tight leading-none">{dayName}, {hijriDate}</span>
          <span className="text-[9px] text-gray-500 font-mono font-medium flex items-center justify-end gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5" /> {currentTimeShort}
          </span>
        </div>
        <div className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center text-gray-500 group-hover:text-gray-900 group-hover:bg-gray-100 transition-colors">
          <BarChart2 className="w-3.5 h-3.5" />
        </div>
      </button>
    );
  }

  return (
    <button 
      onClick={() => navigate('/analytics')}
      className="flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 hover:shadow transition-all group"
    >
      <div className="flex flex-col items-end text-right">
        <span className="text-xs font-semibold text-gray-900 tracking-tight text-right">{dayNameFull}, {hijriDateFull}</span>
        <span className="text-[10px] text-gray-500 font-medium font-mono flex items-center justify-end gap-1">
          <Clock className="w-3 h-3" /> {currentTime} WIB
        </span>
      </div>
      <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-gray-900 group-hover:bg-gray-100 transition-colors">
        <BarChart2 className="w-4 h-4" />
      </div>
    </button>
  );
}
