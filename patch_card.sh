sed -i 's/<div className="grid grid-cols-1 md:grid-cols-2 gap-4">/<div className="grid grid-cols-1 md:grid-cols-3 gap-4">/g' src/modules/settings/SettingsPage.tsx
sed -i '291i\
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">\
                <h3 className="font-medium text-gray-900 mb-1">Evakuasi Markdown</h3>\
                <p className="text-xs text-gray-500 mb-4 h-8">\
                  Ekspor catatan ke dalam format ZIP berisi file Markdown.\
                </p>\
                <Button onClick={handleExportMarkdown} className="w-full gap-2 bg-gray-900 hover:bg-gray-800 text-white">\
                  <FileText className="w-4 h-4" />\
                  Ekspor Markdown\
                </Button>\
                {mdExportStatus && (\
                  <p className="text-xs mt-2 text-gray-900 flex items-center gap-1">\
                    <CheckCircle2 className="w-3 h-3" /> {mdExportStatus}\
                  </p>\
                )}\
              </div>\
' src/modules/settings/SettingsPage.tsx
