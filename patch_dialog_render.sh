sed -i '355i\
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>\
        <DialogHeader>\
          <DialogTitle className="flex items-center gap-2 text-red-600">\
            <AlertTriangle className="w-5 h-5" /> Hapus Semua Data\
          </DialogTitle>\
        </DialogHeader>\
        <DialogContent>\
          <p className="text-gray-600">\
            Apakah Anda yakin ingin menghapus <strong>SEMUA</strong> data (Catatan, Pustaka, Proyek, dll)? Tindakan ini <strong>tidak dapat dibatalkan</strong>.\
          </p>\
          <p className="text-gray-600 mt-2">\
            Pastikan Anda telah melakukan ekspor data (Backup) terlebih dahulu sebelum melanjutkan.\
          </p>\
        </DialogContent>\
        <DialogFooter>\
          <Button type="button" variant="ghost" onClick={() => setIsClearDialogOpen(false)}>Batal</Button>\
          <Button type="button" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmClearData}>Ya, Hapus Permanen</Button>\
        </DialogFooter>\
      </Dialog>\
' src/modules/settings/SettingsPage.tsx
