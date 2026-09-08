import React from 'react';

export interface ReliabilityLevel {
  score: number;
  label: string;
  shortLabel: string;
  description: string;
}

export const RELIABILITY_LEVELS: ReliabilityLevel[] = [
  {
    score: 1.0,
    label: 'Sumber Primer',
    shortLabel: 'Primer',
    description: 'Kitab mu\'tamad, naskah asli, atau dokumen primer terverifikasi',
  },
  {
    score: 0.7,
    label: 'Sumber Sekunder',
    shortLabel: 'Sekunder',
    description: 'Syarah, ringkasan, atau terjemahan beranotasi',
  },
  {
    score: 0.4,
    label: 'Sumber Tersier',
    shortLabel: 'Tersier',
    description: 'Catatan kajian, ikhtisar umum, atau artikel bebas',
  },
  {
    score: 0.1,
    label: 'Belum Diverifikasi',
    shortLabel: 'Belum Diverifikasi',
    description: 'Kutipan lisan atau tanpa catatan sanad rujukan yang pasti',
  },
];

export function getReliabilityLevel(score: number): ReliabilityLevel {
  if (score >= 0.85) return RELIABILITY_LEVELS[0];
  if (score >= 0.55) return RELIABILITY_LEVELS[1];
  if (score >= 0.25) return RELIABILITY_LEVELS[2];
  return RELIABILITY_LEVELS[3];
}

interface ReliabilityBadgeProps {
  score?: number;
  className?: string;
  showDescription?: boolean;
}

export function ReliabilityBadge({
  score = 1.0,
  className = '',
  showDescription = false,
}: ReliabilityBadgeProps) {
  const level = getReliabilityLevel(score);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono border border-gray-200 bg-gray-50 text-gray-700 ${className}`}
      title={`${level.label}: ${level.description} (Skor: ${score.toFixed(1)})`}
    >
      <span>{level.shortLabel}</span>
      {showDescription && (
        <span className="ml-1 text-gray-400 font-sans text-[9px] font-normal">
          &middot; {level.description}
        </span>
      )}
    </span>
  );
}
