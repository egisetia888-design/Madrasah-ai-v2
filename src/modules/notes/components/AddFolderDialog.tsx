import { Button } from "../../../components/ui/Button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/Dialog"

interface AddFolderDialogProps {
  isAddFolderOpen: boolean
  setIsAddFolderOpen: (open: boolean) => void
  newFolderName: string
  setNewFolderName: (val: string) => void
  handleAddFolder: (e: React.FormEvent) => void
}

export function AddFolderDialog({
  isAddFolderOpen,
  setIsAddFolderOpen,
  newFolderName,
  setNewFolderName,
  handleAddFolder
}: AddFolderDialogProps) {
  return (
    <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
      <DialogHeader>
        <DialogTitle className="font-display text-gray-900">Folder Baru</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleAddFolder} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <DialogContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nama Folder</label>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              placeholder="Contoh: Filosofi, Keuangan..."
              required
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setIsAddFolderOpen(false)}>Batal</Button>
          <Button type="submit" disabled={!newFolderName.trim()}>Buat Folder</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
