export type MainMode = 'idle' | 'think' | 'tool' | 'done' | 'error'

export type MainState = {
  mode: MainMode
  tool: string | null
  detail: string | null
  since: number
  inFlight: number
  turns: number
  tools: number
  agents: number
  // Ana döngünün son isteğindeki bağlam boyutu (token); eski kayıtlarda yok.
  tokens?: number
  // Son sıkıştırma: bir sonraki tur bitene kadar Claude'un satırlarında not olarak kalır.
  compacted?: CompactNote
}

// Sıkıştırmanın önceki ve sonraki boyutu (biliniyorsa); `turn`: o andaki tur sayısı.
export type CompactNote = { before?: number; after?: number; turn: number }

// Panelin büyük maskotunun pozu: yalnız tur başında ve sonunda değişir.
// 'wait': tur bitti ama arka planda alt ajan çalışıyor (o bitince Claude devam eder).
export type MainPose = 'idle' | 'think' | 'done' | 'error' | 'wait'

export type AgentStatus = 'running' | 'done' | 'error' | 'aborted'

export type AgentCard = {
  id: string
  type: string
  description: string
  model: string
  status: AgentStatus
  startedAt: number
  endedAt: number | null
  // Çalışırken `live`'da tutulur; ajan bitince buraya son hâli yazılır.
  tools: number
  lastTool: string | null
  tokens: number | null
  // true: `tokens` bağlam boyutu (v0.4.8+). Eski kartlardaki toplam sayı gösterilmez.
  hasContext?: boolean
  isBackground: boolean
  // Ajanı başlatan Agent araç çağrısı: sohbetteki satır kendi ajanını bununla bulur.
  toolUseId?: string
  // Pano yüklenmeden önce başlamış, sonradan listeden eklenmiş: başlangıç anı bilinmiyor.
  isLate?: boolean
  // Ajan bitince yazılır: son adımları ve teslim ettiği rapor (ilk 20.000 karakter).
  steps?: string[]
  answer?: string
  // Ajana verilen görev metni (ilk 4.000 karakter); açılan kartta "Görev" altında.
  prompt?: string
}

// Alt ajanların çalışırken değişen sayaçları; hiçbir çizim okumaz.
// `tokens`: son model isteğindeki bağlam boyutu.
export type AgentLive = {
  tools: number
  lastTool: string | null
  tokens?: number
  // Son adımlar (en çok 8), açılan kartta gösterilir.
  steps?: string[]
  // Şu anki adım: araç sürüyor ('tool') ya da araç bitti, model düşünüyor ('think').
  // `since` adımın başladığı an; `inFlight` süren araç sayısı (paralel çağrılar).
  phase?: 'tool' | 'think'
  since?: number
  inFlight?: number
}

// Canlı bölgenin (Client) bir satırı; `color` boşsa varsayılan renk.
export type LiveLine = { text: string; color: string; isDim: boolean }

// Açılan kartın sekmesi; panel state'inde açık kartlar için tutulur (kapalı = yok).
export type CardTab = 'task' | 'steps' | 'report'

// Kartın Client bölgelerinin (card.tsx) verisi: 'head' başlık + meta satırları,
// 'body' açılan kartta seçili sekmenin metni. Düğmeler panelin kendisinde (yerel görünüm).
export type CardProps = {
  part: 'head' | 'body'
  tab: CardTab
  id: string
  isRunning: boolean
  label: string
  color: string
  statusText: string
  statusColor: string
  description: string
  meta: LiveLine[]
  steps: LiveLine[]
  // Raporun ilk dolu satırları; boşsa rapor ve düğmeleri çizilmez.
  report: ReportLine[]
  // Görev metninin ilk satırları; bilinmiyorsa (sonradan katılan ajan) boş.
  task: ReportLine[]
}

// Rapor önizlemesinin bir satırı: Markdown işaretleri ayıklanmış, başlıklar kalın.
export type ReportLine = { text: string; isBold: boolean }

// Prompt üstü bant: bu dalgada başlayan ajanlar; hepsi bitince `doneAt` dolar,
// bant bir süre "✓ n ajan bitti" gösterip kaybolur.
export type BandState = { batch: string[]; doneAt: number | null }

// Ana döngünün süren turu: araç sayısı, başlatılan alt ajan, düzenlenen dosyalar.
// Hiçbir çizim okumaz; tur bitince `last`'a özet olarak geçer.
export type TurnProgress = { tools: number; agents: number; files: string[] }

// Biten son turun özeti: panelin Claude bölümünde ve masaüstünde prompt üstü bantta.
export type TurnSummary = {
  reason: 'answer' | 'aborted' | 'refusal' | 'error'
  durationMs: number
  tools: number
  agents: number
  files: string[]
  // Tur sonundaki bağlam boyutu; istek ölçülmediyse null.
  tokens: number | null
  // ✕ ya da yeni tur: bantta gösterilmez, panelde kalır.
  isHidden: boolean
}

// Kullanıcı ayarları (oturumlar arası `$.store`'da 'ayarlar'): ikisi de varsayılan kapalı.
export type Prefs = { sound: boolean; party: boolean }

// Bir sohbetin panosu (`$.store`'da 'panolar', oturum kimliğine göre): uygulama yeniden
// başlayınca kartlar ve son tur bundan geri yüklenir. `savedAt`: son kayıt anı.
export type SavedBoard = { savedAt: number; agents: AgentCard[]; last: TurnSummary | null }

declare module 'claude-code' {
  interface PluginState {
    'ajan-panosu': {
      main: MainState
      agents: AgentCard[]
      live: Record<string, AgentLive>
      pose: MainPose
      kind: string
      band: BandState
      turn: TurnProgress
      last: TurnSummary | null
      prefs: Prefs
      // Açık kartların görünen sekmesi; 'none': kart açık, sekme metni kapalı.
      views: Record<string, CardTab | 'none'>
    }
  }
}
