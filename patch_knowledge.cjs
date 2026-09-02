const fs = require('fs');
let code = fs.readFileSync('src/store/knowledgeStore.ts', 'utf8');

code = code.replace(
  /updateConcept: \(id, data\) => set\(\(state\) => \(\{\s*concepts: state.concepts.map\(\(c\) =>\s*c.id === id \? \{ ...c, ...data, ...updateSyncMetadata\(c\) \} : c\s*\)\s*\}\)\),/,
  `updateConcept: (id, data) => set((state) => {
        const updatedConcepts = state.concepts.map((c) => {
          if (c.id === id) {
            const updated = { ...c, ...data, ...updateSyncMetadata(c) };
            syncSaveConcept(updated);
            return updated;
          }
          return c;
        });
        return { concepts: updatedConcepts };
      }),`
);

code = code.replace(
  /deleteConcept: \(id\) => set\(\(state\) => \(\{\s*concepts: state.concepts.filter\(\(c\) => c.id !== id\),\s*relations: state.relations.filter\(\(r\) => r.sourceNodeId !== id && r.targetNodeId !== id\)\s*\}\)\),/,
  `deleteConcept: (id) => {
        set((state) => ({
          concepts: state.concepts.filter((c) => c.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
        syncDeleteConcept(id);
      },`
);

code = code.replace(
  /updateSourceFragment: \(id, data\) => set\(\(state\) => \(\{\s*sourceFragments: state.sourceFragments.map\(\(f\) =>\s*f.id === id \? \{ ...f, ...data \} : f\s*\)\s*\}\)\),/,
  `updateSourceFragment: (id, data) => set((state) => {
        const updatedFragments = state.sourceFragments.map((f) => {
          if (f.id === id) {
            const updated = { ...f, ...data, ...updateSyncMetadata(f) };
            syncSaveSourceFragment(updated);
            return updated;
          }
          return f;
        });
        return { sourceFragments: updatedFragments };
      }),`
);

code = code.replace(
  /deleteSourceFragment: \(id\) => set\(\(state\) => \(\{\s*sourceFragments: state.sourceFragments.filter\(\(f\) => f.id !== id\),\s*relations: state.relations.filter\(\(r\) => r.sourceNodeId !== id && r.targetNodeId !== id\)\s*\}\)\),/,
  `deleteSourceFragment: (id) => {
        set((state) => ({
          sourceFragments: state.sourceFragments.filter((f) => f.id !== id),
          relations: state.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id)
        }));
        syncDeleteSourceFragment(id);
      },`
);

code = code.replace(
  /updateRelation: \(id, data\) => set\(\(state\) => \(\{\s*relations: state.relations.map\(\(r\) =>\s*r.id === id \? \{ ...r, ...data \} : r\s*\)\s*\}\)\),/,
  `updateRelation: (id, data) => set((state) => {
        const updatedRelations = state.relations.map((r) => {
          if (r.id === id) {
            const updated = { ...r, ...data, ...updateSyncMetadata(r) };
            syncSaveRelation(updated);
            return updated;
          }
          return r;
        });
        return { relations: updatedRelations };
      }),`
);

code = code.replace(
  /deleteRelation: \(id\) => set\(\(state\) => \(\{\s*relations: state.relations.filter\(\(r\) => r.id !== id\)\s*\}\)\),/,
  `deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id)
        }));
        syncDeleteRelation(id);
      },`
);

fs.writeFileSync('src/store/knowledgeStore.ts', code);
