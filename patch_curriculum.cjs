const fs = require('fs');
let code = fs.readFileSync('src/store/curriculumStore.ts', 'utf8');

code = code.replace(
  /addPath: \(pathData\) => set\(\(state\) => \(\{\s*paths: \[\s*\{\s*\.\.\.pathData,\s*id: pathData\.id \|\| crypto\.randomUUID\(\),\s*createdAt: Date\.now\(\),\s*\.\.\.createSyncMetadata\(\),\s*\},\s*\.\.\.state\.paths\s*\]\s*\}\)\),/,
  `addPath: (pathData) => {
        const newPath = {
            ...pathData,
            id: pathData.id || crypto.randomUUID(),
            createdAt: Date.now(),
            ...createSyncMetadata(),
        };
        set((state) => ({
          paths: [newPath, ...state.paths]
        }));
        syncSaveLearningPath(newPath);
      },`
);

code = code.replace(
  /updatePath: \(id, updates\) => set\(\(state\) => \(\{\s*paths: state\.paths\.map\(p => p\.id === id \? \{ \.\.\.p, \.\.\.updates, \.\.\.updateSyncMetadata\(p\) \} : p\)\s*\}\)\),/,
  `updatePath: (id, updates) => set((state) => {
        const updatedPaths = state.paths.map(p => {
          if (p.id === id) {
            const updated = { ...p, ...updates, ...updateSyncMetadata(p) };
            syncSaveLearningPath(updated);
            return updated;
          }
          return p;
        });
        return { paths: updatedPaths };
      }),`
);

code = code.replace(
  /deletePath: \(id\) => set\(\(state\) => \(\{\s*paths: state\.paths\.filter\(p => p\.id !== id\),\s*phases: state\.phases\.filter\(ph => ph\.pathId !== id\),\s*\/\/ Simplification: competencies deletion cascading would be handled more robustly in prod\s*\}\)\),/,
  `deletePath: (id) => {
        set((state) => ({
          paths: state.paths.filter(p => p.id !== id),
          phases: state.phases.filter(ph => ph.pathId !== id)
        }));
        syncDeleteLearningPath(id);
      },`
);

code = code.replace(
  /addPhase: \(phase\) => set\(\(state\) => \(\{\s*phases: \[\s*\.\.\.state\.phases,\s*\{\s*\.\.\.phase,\s*id: phase\.id \|\| crypto\.randomUUID\(\),\s*\.\.\.createSyncMetadata\(\),\s*\}\s*\]\s*\}\)\),/,
  `addPhase: (phase) => {
        const newPhase = {
            ...phase,
            id: phase.id || crypto.randomUUID(),
            ...createSyncMetadata(),
        };
        set((state) => ({
          phases: [...state.phases, newPhase]
        }));
        syncSavePhase(newPhase);
      },`
);

code = code.replace(
  /updatePhase: \(id, updates\) => set\(\(state\) => \(\{\s*phases: state\.phases\.map\(ph => ph\.id === id \? \{ \.\.\.ph, \.\.\.updates, \.\.\.updateSyncMetadata\(ph\) \} : ph\)\s*\}\)\),/,
  `updatePhase: (id, updates) => set((state) => {
        const updatedPhases = state.phases.map(ph => {
          if (ph.id === id) {
            const updated = { ...ph, ...updates, ...updateSyncMetadata(ph) };
            syncSavePhase(updated);
            return updated;
          }
          return ph;
        });
        return { phases: updatedPhases };
      }),`
);

code = code.replace(
  /deletePhase: \(id\) => set\(\(state\) => \(\{\s*phases: state\.phases\.filter\(ph => ph\.id !== id\),\s*competencies: state\.competencies\.filter\(c => c\.phaseId !== id\)\s*\}\)\),/,
  `deletePhase: (id) => {
        set((state) => ({
          phases: state.phases.filter(ph => ph.id !== id),
          competencies: state.competencies.filter(c => c.phaseId !== id)
        }));
        syncDeletePhase(id);
      },`
);

code = code.replace(
  /addCompetency: \(comp\) => set\(\(state\) => \(\{\s*competencies: \[\s*\.\.\.state\.competencies,\s*\{\s*\.\.\.comp,\s*id: crypto\.randomUUID\(\),\s*\.\.\.createSyncMetadata\(\),\s*\}\s*\]\s*\}\)\),/,
  `addCompetency: (comp) => {
        const newComp = {
            ...comp,
            id: crypto.randomUUID(),
            ...createSyncMetadata(),
        };
        set((state) => ({
          competencies: [...state.competencies, newComp]
        }));
        syncSaveCompetency(newComp);
      },`
);

code = code.replace(
  /updateCompetency: \(id, updates\) => set\(\(state\) => \(\{\s*competencies: state\.competencies\.map\(c => c\.id === id \? \{ \.\.\.c, \.\.\.updates, \.\.\.updateSyncMetadata\(c\) \} : c\)\s*\}\)\),/,
  `updateCompetency: (id, updates) => set((state) => {
        const updatedComps = state.competencies.map(c => {
          if (c.id === id) {
            const updated = { ...c, ...updates, ...updateSyncMetadata(c) };
            syncSaveCompetency(updated);
            return updated;
          }
          return c;
        });
        return { competencies: updatedComps };
      }),`
);

code = code.replace(
  /deleteCompetency: \(id\) => set\(\(state\) => \(\{\s*competencies: state\.competencies\.filter\(c => c\.id !== id\)\s*\}\)\),/,
  `deleteCompetency: (id) => {
        set((state) => ({
          competencies: state.competencies.filter(c => c.id !== id)
        }));
        syncDeleteCompetency(id);
      },`
);

fs.writeFileSync('src/store/curriculumStore.ts', code);
