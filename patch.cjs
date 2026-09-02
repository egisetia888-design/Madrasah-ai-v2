const fs = require('fs');
let code = fs.readFileSync('src/modules/dashboard/DashboardPage.tsx', 'utf8');
code = code.replace(
  /            <\/div>\n          <\/section>\n        <\/div>\n      <\/div>\n    <\/div>\n  \)\n}/,
  `            </div>
          </section>
        </div>
      </div>
      
      {/* Mobile Toggle Button */}
      <div className="md:hidden pt-4 pb-8 flex justify-center">
        <button
          onClick={() => setShowAllActivities(!showAllActivities)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-colors"
        >
          {showAllActivities ? (
            <>
              Sembunyikan Aktivitas Sekunder
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Tampilkan Semua Aktivitas
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}`
);
fs.writeFileSync('src/modules/dashboard/DashboardPage.tsx', code);
