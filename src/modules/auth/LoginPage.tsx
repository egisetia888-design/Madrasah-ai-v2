import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, HardDrive, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { useAuthStore } from "../../store/authStore";
import { importUnifiedBackup } from "../../store/indexedDbStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const storedWorkspaceName = useAuthStore((state) => state.workspaceName);
  const enterWorkspace = useAuthStore((state) => state.enterWorkspace);

  const [workspaceInput, setWorkspaceInput] = useState(storedWorkspaceName);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleEnterWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    enterWorkspace(workspaceInput);
    navigate("/");
  };

  const handleQuickRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsRestoring(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = String(event.target?.result || "");
        const summary = await importUnifiedBackup(rawJson);
        setStatusMessage(
          `Berhasil memulihkan ${summary.totalEntities} entitas dari ${summary.storeCount} penyimpanan.`
        );
        enterWorkspace(workspaceInput);
        setTimeout(() => {
          window.location.href = "/";
        }, 700);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Format berkas cadangan JSON tidak valid.";
        setErrorMessage(msg);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4 py-8 font-sans">
      <Card className="w-full max-w-md border-gray-200 shadow-sm rounded-2xl bg-white">
        <CardHeader className="text-center pb-4 pt-8 px-6">
          <div className="w-12 h-12 bg-gray-900 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold font-display text-xl">M</span>
          </div>
          <CardTitle className="text-xl font-display text-gray-900 tracking-tight">
            Selamat Datang di Madrasah
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Sistem Operasi Pengetahuan Pribadi yang langsung siap digunakan secara luring di perangkat Anda.
          </p>
        </CardHeader>

        <CardContent className="pb-8 px-6 space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2 text-xs text-gray-900 bg-gray-100 p-3 rounded-xl border border-gray-200">
              <AlertCircle className="w-4 h-4 text-gray-700 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="flex items-start gap-2 text-xs text-gray-900 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <CheckCircle2 className="w-4 h-4 text-gray-800 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleEnterWorkspace} className="space-y-4">
            <div>
              <label
                htmlFor="workspace-name"
                className="block text-xs font-medium text-gray-600 mb-1.5"
              >
                Nama Ruang Kerja Lokal
              </label>
              <input
                id="workspace-name"
                type="text"
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
                placeholder="Ruang Belajar Pribadi"
                className="w-full h-11 px-3.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <span>Masuk ke Ruang Kerja</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200" />
            <span className="flex-shrink mx-3 text-xs text-gray-400">atau</span>
            <div className="flex-grow border-t border-gray-200" />
          </div>

          <div className="relative">
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleQuickRestore}
              disabled={isRestoring}
              aria-label="Pulihkan data dari file backup JSON"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isRestoring}
              className="w-full h-11 border-gray-200 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium pointer-events-none"
            >
              <Upload className="w-4 h-4 text-gray-500" />
              <span>{isRestoring ? "Memulihkan Cadangan..." : "Pulihkan dari Backup JSON"}</span>
            </Button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] font-mono text-gray-500">
            <HardDrive className="w-3.5 h-3.5 text-gray-400" />
            <span>IndexedDB Lokal</span>
            <span aria-hidden="true">·</span>
            <span>Tanpa Konfigurasi Cloud</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
