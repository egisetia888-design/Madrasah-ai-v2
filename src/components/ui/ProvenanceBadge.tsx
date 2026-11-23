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
    updateRelation(relation.id, { verifiedBySystem: true });
  };

  if (relation.createdBy === 'user') {
    return (
      <span className={`text-[11px] font-mono text-gray-500 ${className}`}>
        Manual
      </span>
    );
  }

  if (relation.verifiedBySystem) {
    return (
      <span className={`text-[11px] font-mono text-gray-500 ${className}`}>
        AI · terverifikasi
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-gray-100 border border-gray-200 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors ${className}`}
      title="Ketuk untuk mengonfirmasi relasi ini"
    >
      AI · perlu verifikasi
    </button>
  );
}
