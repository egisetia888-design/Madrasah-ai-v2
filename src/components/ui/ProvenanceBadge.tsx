import React from 'react';
import { Relation } from '../../types';
import { useKnowledgeStore } from '../../store/knowledgeStore';

interface ProvenanceBadgeProps {
  relation: Relation;
  className?: string;
}

export function ProvenanceBadge({ relation, className = "" }: ProvenanceBadgeProps) {
  const updateRelation = useKnowledgeStore(state => state.updateRelation);

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateRelation(relation.id, {
      verifiedBySystem: true,
      verifiedAt: Date.now(),
    });
  };

  if (relation.createdBy === 'user') {
    return (
      <span className={`text-[11px] font-mono text-gray-500 ${className}`}>
        Manual
      </span>
    );
  }

  const confidencePct =
    typeof relation.confidenceScore === 'number' && Number.isFinite(relation.confidenceScore)
      ? Math.round(Math.min(1, Math.max(0, relation.confidenceScore)) * 100)
      : null;

  if (relation.verifiedBySystem) {
    return (
      <span className={`text-[11px] font-mono text-gray-500 tabular-nums ${className}`}>
        AI · terverifikasi{confidencePct !== null ? ` · ${confidencePct}%` : ''}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      className={`inline-flex items-center min-h-[36px] sm:min-h-0 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-lg text-[11px] font-mono font-medium tabular-nums bg-gray-100 border border-gray-200 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors ${className}`}
      title="Ketuk satu kali untuk mengonfirmasi relasi AI ini"
    >
      AI · perlu verifikasi{confidencePct !== null ? ` · ${confidencePct}%` : ''}
    </button>
  );
}
