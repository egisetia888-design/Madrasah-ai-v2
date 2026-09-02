import Markdown from "react-markdown"
import { Sparkles, Brain } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/Dialog"

interface AIAssistantDialogProps {
  isAssistantOpen: boolean
  setIsAssistantOpen: (open: boolean) => void
  prompt: string
  setPrompt: (val: string) => void
  aiResponse: string
  isLoading: boolean
  handleAskAssistant: (e: React.FormEvent) => void
}

export function AIAssistantDialog({
  isAssistantOpen,
  setIsAssistantOpen,
  prompt,
  setPrompt,
  aiResponse,
  isLoading,
  handleAskAssistant
}: AIAssistantDialogProps) {
  return (
    <Dialog open={isAssistantOpen} onOpenChange={setIsAssistantOpen} maxWidthClass="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-gray-900 font-display">
          <Sparkles className="w-5 h-5 text-gray-500" /> Asisten Pengetahuan AI
        </DialogTitle>
      </DialogHeader>
      <DialogContent className="flex flex-col gap-6">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-sm text-gray-950 leading-relaxed">
            Tanyakan apapun tentang catatan Anda. Asisten AI ini dapat menghubungkan konsep-konsep yang berbeda, merangkum pengetahuan Anda, atau membantu Anda menemukan ide tulisan baru berdasarkan apa yang sudah Anda pelajari.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] border border-gray-100 rounded-2xl bg-gray-50/50 p-4">
          {aiResponse ? (
            <div className="prose prose-sm md:prose-base prose-gray max-w-none text-gray-700">
              <Markdown>{aiResponse}</Markdown>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-3 py-10">
              <Brain className="w-10 h-10 opacity-20" />
              <p className="text-sm">Ketik pertanyaan Anda di bawah ini...</p>
            </div>
          )}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}
        </div>

        <form onSubmit={handleAskAssistant} className="flex gap-3">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            type="text"
            className="flex-1 h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:border-transparent"
            placeholder="Contoh: Apa hubungan catatan A dan B?"
            required
          />
          <Button type="submit" disabled={isLoading || !prompt.trim()} className="h-11 px-6 bg-gray-900 hover:bg-gray-800 rounded-xl">
            {isLoading ? 'Berpikir...' : 'Tanya AI'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
