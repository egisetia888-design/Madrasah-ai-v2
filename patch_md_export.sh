sed -i '103i\
  const handleExportMarkdown = async () => {\
    try {\
      setMdExportStatus("Menyiapkan ZIP Markdown...");\
      const zip = new JSZip();\
\
      const notesFolder = zip.folder("Catatan");\
      const notes = useNotesStore.getState().notes;\
      const allTags = useNotesStore.getState().tags;\
      const folders = useNotesStore.getState().folders;\
      const books = useLibraryStore.getState().books;\
\
      notes.forEach(note => {\
        const noteFolder = note.folderId ? folders.find(f => f.id === note.folderId)?.name || "Uncategorized" : "Uncategorized";\
        const noteTags = note.tags.map(tid => allTags.find(t => t.id === tid)?.name || tid).join(", ");\
        const sourceBook = note.sourceId ? books.find(b => b.id === note.sourceId)?.title : "None";\
\
        let mdContent = `---\n`;\
        mdContent += `title: ${note.title}\n`;\
        mdContent += `type: ${note.type}\n`;\
        mdContent += `status: ${note.status}\n`;\
        mdContent += `folder: ${noteFolder}\n`;\
        mdContent += `tags: [${noteTags}]\n`;\
        if (note.sourceId) mdContent += `source: ${sourceBook}\n`;\
        mdContent += `date_created: ${new Date(note.createdAt).toISOString()}\n`;\
        mdContent += `date_updated: ${new Date(note.updatedAt).toISOString()}\n`;\
        mdContent += `---\n\n`;\
        mdContent += `# ${note.title}\n\n`;\
\
        if (note.rawQuote) {\
          mdContent += `## Kutipan Mentah\n`;\
          mdContent += `> ${note.rawQuote.split("\\n").join("\\n> ")}\n\n`;\
          if (note.referenceCitation) {\
             mdContent += `**Sumber:** ${note.referenceCitation}\n\n`;\
          }\
        }\
\
        if (note.content) {\
          mdContent += `## Konten\n`;\
          mdContent += `${note.content}\n`;\
        }\
\
        notesFolder?.file(`${noteFolder}/${note.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);\
      });\
\
      const writingFolder = zip.folder("Tulisan");\
      const drafts = useWritingStore.getState().drafts;\
      drafts.forEach(draft => {\
        let mdContent = `---\n`;\
        mdContent += `title: ${draft.title}\n`;\
        mdContent += `status: ${draft.status}\n`;\
        mdContent += `date_created: ${new Date(draft.createdAt).toISOString()}\n`;\
        mdContent += `date_updated: ${new Date(draft.updatedAt).toISOString()}\n`;\
        mdContent += `---\n\n`;\
        mdContent += `# ${draft.title}\n\n`;\
        mdContent += `${draft.content}\n`;\
\
        writingFolder?.file(`${draft.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);\
      });\
\
      const booksFolder = zip.folder("Pustaka");\
      books.forEach(book => {\
        let mdContent = `---\n`;\
        mdContent += `title: ${book.title}\n`;\
        mdContent += `status: ${book.status}\n`;\
        mdContent += `progress: ${book.progress}%\n`;\
        mdContent += `date_created: ${new Date(book.createdAt).toISOString()}\n`;\
        mdContent += `date_updated: ${new Date(book.updatedAt).toISOString()}\n`;\
        mdContent += `---\n\n`;\
        mdContent += `# ${book.title}\n`;\
\
        booksFolder?.file(`${book.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);\
      });\
\
      setMdExportStatus("Mengunduh ZIP...");\
      const content = await zip.generateAsync({ type: "blob" });\
      saveAs(content, `madrasah-markdown-export-${new Date().toISOString().split("T")[0]}.zip`);\
\
      setMdExportStatus("Ekspor Markdown berhasil!");\
      setTimeout(() => setMdExportStatus(null), 3000);\
    } catch (error) {\
      console.error("MD Export failed:", error);\
      setMdExportStatus("Gagal mengekspor Markdown.");\
      setTimeout(() => setMdExportStatus(null), 3000);\
    }\
  };\
' src/modules/settings/SettingsPage.tsx
