const fs = require('fs');
let code = fs.readFileSync('src/store/reviewStore.ts', 'utf8');

code = code.replace(
  /reviewFlashcard: \(id, quality\) => set\(\(state\) => \(\{\s*flashcards: state\.flashcards\.map\(f => \{/g,
  `reviewFlashcard: (id, quality) => set((state) => {
        const updatedFlashcards = state.flashcards.map(f => {`
);

code = code.replace(
  /\.\.\.updateSyncMetadata\(f\),\s*\};\s*\}\)\s*\}\)\),/g,
  `...updateSyncMetadata(f),
          };
          syncSaveFlashcard(updatedCard);
          return updatedCard;
        });
        return { flashcards: updatedFlashcards };
      }),`
);

code = code.replace(/return \{\s*\.\.\.f,\s*efactor,\s*repetition,\s*interval,\s*dueDate,\s*\.\.\.updateSyncMetadata\(f\),/g, `const updatedCard = {
            ...f,
            efactor,
            repetition,
            interval,
            dueDate,
            ...updateSyncMetadata(f),`);

fs.writeFileSync('src/store/reviewStore.ts', code);
