import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  RenderSurface,
  ToolCallInput,
  ToolCallResult,
  TurnUsage,
} from 'claude-code'

import type {
  AgentCard,
  AgentLive,
  AgentStatus,
  BandState,
  CardProps,
  CompactNote,
  LiveLine,
  MainPose,
  MainState,
  Prefs,
  ReportLine,
  SavedBoard,
  TurnProgress,
  TurnSummary,
  CardTab,
} from '../types'
import {
  CONFETTI_ASPECT,
  ROW_ASPECT,
  STEP_ASPECT,
  confettiSvg,
  lookFor,
  mascotSvg,
  stepIconSvg,
  inPhase,
} from './mascot'
import type { Pose, StepPhase, ToolKind } from './mascot'

const PANE = 'ajan-panosu'

// Panelin yerel düğmelerinin işleri, çizimde anahtarlarıyla kaydedilir. Panel odakta
// değilken bir düğmeye tıklayınca uygulama önce odağı düğmeye taşıyıp paneli yeniden
// çiziyor ve basma olayı hiç gelmiyor (ölçüldü, v0.9.39: "odak · more-… → çizim · panel
// odağı aldı", basma yok; ikinci tıklamada basma geliyor). Bu yüzden kişinin bir düğmeye
// odak taşıması da basma sayılır; aynı düğmenin kısa süre içindeki ikinci olayı yok
// sayılır. Aynı tıklamanın eşi atlanır, bir kez: basmadan hemen sonra gelen odak (~25 ms,
// panel odaktayken) ve odakla yapılan işten sonra geç gelen basma (ölçüldü v0.9.41,
// ~400 ms). Basmadan sonra gelen basma her zaman yeni tıklamadır: v0.9.42 onu da
// atlıyordu, hızlı tıklamada her ikinci tıklama yutuluyordu (ölçüldü v0.9.43).
// Alt ajanların süren turları (turn.step'ten): ajan kimliği → tur kimliği.
const agentTurns = new Map<string, string>()

// Çalışan alt ajanı durdur: önce uygulamanın TaskStop aracı (arka plan ajanını kimliğiyle
// durdurur), olmazsa ajanın süren turunu iptal. Hangisinin işlediği bildirimde yazar;
// alt ajanda ikisinin de çalıştığı doğrulanmadı (v0.9.47).
async function stopAgent($: EngineInterface, card: AgentCard): Promise<void> {
  const look = lookFor(card.type)

  try {
    const done = (await $.tool.call({ tool: 'TaskStop', task_id: card.id })) as {
      deny?: string
      isError?: boolean
    }

    if (done.deny === undefined && done.isError !== true) {
      $.ui.toast(`${look.label} durduruldu`)
      return
    }
  } catch {
    // TaskStop yoksa ya da reddettiyse tura geç.
  }

  const turnId = agentTurns.get(card.id)

  try {
    if (turnId === undefined) {
      throw new Error('tur bilinmiyor')
    }

    await $.turn.abort({ turnId })
    $.ui.toast(`${look.label} durduruldu`)
  } catch (error) {
    $.ui.toast(`${look.label} durdurulamadı: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const paneActions = new Map<string, () => unknown>()
let lastPaneAct = { element: '', at: 0, by: 'press' as 'press' | 'focus' }

let lastScroll = { at: 0, by: 0 }
const SCROLL_FLIP_MS = 120
const SCROLL_FLIP_ROWS = 3
const ECHO_FOCUS_MS = 300
const ECHO_PRESS_MS = 900
const FOCUS_REDRAW_MS = 400
// `by`: bu olay; eşi olabileceği önceki iş farklı yoldan gelmiş olmalı.
const isEcho = (element: string, t: number, by: 'press' | 'focus') =>
  lastPaneAct.element === element &&
  lastPaneAct.by !== by &&
  t - lastPaneAct.at < (by === 'focus' ? ECHO_FOCUS_MS : ECHO_PRESS_MS)
const TITLE = 'Ajan panosu'
const KEEP = 12
const DONE_LINGER_MS = 8000
const BAND_LINGER_MS = 8000
const BAND_SHOWN = 4
const STEPS_KEEP = 8
// Alt ajanın aynı adımda (araç ya da düşünme) bundan uzun kalması uyarı renginde gösterilir.
const SLOW_STEP_MS = 60_000
const ANSWER_KEEP = 20_000
// Açılan kartın sekmeleri metnin tamamını gösterir (v0.9.32); bu sınır yalnız aşırı
// uzun bir rapora karşı. Görev metni kartta ilk 4.000 karakteriyle saklanır.
const ANSWER_PREVIEW_LINES = 400
const TASK_PREVIEW_LINES = 400
const PROMPT_KEEP_CHARS = 4000
// true: maskotlar sandbox'lı çerçevede çizilir (animasyon kesin oynar, yeniden
// yüklenirken bir an beyaz kare). false: resim olarak çizilir (beyaz kare yok).
const IS_FRAMED = false

const IDLE: MainState = {
  mode: 'idle',
  tool: null,
  detail: null,
  since: 0,
  inFlight: 0,
  turns: 0,
  tools: 0,
  agents: 0,
}

// Çizimlerin okuduğu değerler: yalnız ajan başlarken/biterken ya da tur başında/
// sonunda değişir. Her yazım okuyan çizimi baştan çizer ve maskot resimlerini
// yeniden yükler (animasyon takılır), bu yüzden sık değişen sayaçlar burada değil.
const agents = atom({ plugin: 'ajan-panosu', key: 'agents' } as const, [])
const pose = atom({ plugin: 'ajan-panosu', key: 'pose' } as const, 'idle')
const kind = atom({ plugin: 'ajan-panosu', key: 'kind' } as const, 'other')
const EMPTY_BAND: BandState = { batch: [], doneAt: null }
const band = atom({ plugin: 'ajan-panosu', key: 'band' } as const, EMPTY_BAND)
// Son turun özeti: yalnız tur sonunda ve yeni tur başında (gizlenir) yazılır.
const last = atom({ plugin: 'ajan-panosu', key: 'last' } as const, null)
// Ses ve kutlama ayarı: `/pano ses|kutlama` ile değişir, `$.store`'da kalıcı.
const NO_PREFS: Prefs = { sound: false, party: false }
const prefs = atom({ plugin: 'ajan-panosu', key: 'prefs' } as const, NO_PREFS)
const PREFS_KEY = 'ayarlar'
// Sohbetlerin panoları: `{ [oturum kimliği]: SavedBoard }`; en son kaydedilen 10
// oturum tutulur (rapor başına 20.000 karakterle depo 4 MiB'ın altında kalsın).
const BOARDS_KEY = 'panolar'
const BOARDS_KEEP = 10
// Konfeti yalnız dalga bittikten sonraki bu süre içinde çizilir (bant yeniden
// çizilince baştan oynamasın).
const CONFETTI_MS = 3000

// Hiçbir çizimin okumadığı canlı değerler: kartların Client bölgesi saniyede bir
// `ui.message` ile sorar, cevap yalnız o bölgeyi yeniler.
const main = atom({ plugin: 'ajan-panosu', key: 'main' } as const, IDLE)
const live = atom({ plugin: 'ajan-panosu', key: 'live' } as const, {})
// Açık kartlar ve seçili sekmeleri: düğmeler panelde olduğu için yazımı paneli yeniden
// çizer (maskot animasyonu saate bağlı sürer, v0.9.22).
const views = atom({ plugin: 'ajan-panosu', key: 'views' } as const, {})
const EMPTY_TURN: TurnProgress = { tools: 0, agents: 0, files: [] }
const turn = atom({ plugin: 'ajan-panosu', key: 'turn' } as const, EMPTY_TURN)

// Client'ın son satırları: panel yeniden çizilince bölgeye eski değil son
// bilinen satırlar verilsin diye (modül değişkeni, okumak abonelik yaratmaz).
const lastLines = new Map<string, LiveLine[]>()
const lastCards = new Map<string, CardProps>()

const KINDS: Record<string, ToolKind> = {
  Bash: 'shell',
  Monitor: 'shell',
  Edit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Read: 'read',
  Grep: 'read',
  Glob: 'read',
  LSP: 'read',
  WebSearch: 'web',
  WebFetch: 'web',
  Agent: 'agent',
  Workflow: 'agent',
  SendMessage: 'agent',
}

const kindOf = (tool: string | null): ToolKind =>
  (tool !== null && KINDS[tool]) || (tool?.startsWith('mcp__') ? 'web' : 'other')

const shortTool = (tool: string) =>
  tool.startsWith('mcp__') ? tool.slice(tool.lastIndexOf('__') + 2) : tool

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

const clip = (text: string, size: number) =>
  text.length > size ? `${text.slice(0, size - 1)}…` : text

function toolDetail(e: ToolCallInput): string {
  const args = e as unknown as Record<string, unknown>
  const text = (key: string) => (typeof args[key] === 'string' ? (args[key] as string) : '')

  switch (String(e.tool)) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return baseName(text('file_path') || text('notebook_path'))
    case 'Bash':
      return text('description') || text('command').split('\n')[0] || ''
    case 'Grep':
    case 'Glob':
      return text('pattern')
    case 'WebSearch':
      return text('query')
    case 'WebFetch':
      return text('url').replace(/^https?:\/\//, '').split('/')[0] ?? ''
    case 'Agent':
      return text('description')
    case 'Skill':
      return text('skill')
    default:
      return ''
  }
}

function toolLabel(e: ToolCallInput): string {
  const detail = toolDetail(e)
  const name = shortTool(String(e.tool))

  return detail === '' ? name : `${name} · ${clip(detail, 48)}`
}

function prettyModel(model: string): string {
  const id = /claude-([a-z]+)-(\d+)-(\d+)/.exec(model)

  if (id?.[1] && id[2] && id[3]) {
    return `${id[1][0]?.toUpperCase()}${id[1].slice(1)} ${id[2]}.${id[3]}`
  }

  if (/^(opus|sonnet|haiku|fable)$/.test(model)) {
    return model[0]?.toUpperCase() + model.slice(1)
  }

  return model === '' ? '—' : model
}

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))

  return s < 60 ? `${s}sn` : `${Math.floor(s / 60)}dk ${s % 60}sn`
}

// Bir isteğin bağlam boyutu: modelin o istekte okuduğu her şey (önbellekten
// gelen dahil) ve ürettiği. Ajanın "ne kadar dolu" olduğunu söyler.
function contextOf(usage: TurnUsage): number {
  return (
    usage.input_tokens +
    usage.cache_read_input_tokens +
    usage.cache_creation_input_tokens +
    usage.output_tokens
  )
}

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : String(n)

// Bağlam halkasının yazımı: "415k", "1M", "1.5M" (ondalık yalnız gerekiyorsa).
const roundK = (n: number) =>
  n >= 999_500
    ? `${Number((n / 1_000_000).toFixed(1))}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(n)

function trim(list: AgentCard[]): AgentCard[] {
  const extra = list.length - KEEP

  if (extra <= 0) {
    return list
  }

  let dropped = 0

  return list.filter(card => {
    if (dropped < extra && card.status !== 'running') {
      dropped += 1
      return false
    }

    return true
  })
}

const POSE: Record<AgentStatus, Pose> = {
  running: 'run',
  done: 'done',
  error: 'error',
  aborted: 'aborted',
}

const STATUS_TEXT: Record<AgentStatus, string> = {
  running: 'çalışıyor',
  done: '✓ bitti',
  error: '✕ hata',
  aborted: '■ durduruldu',
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'claude',
  done: 'success',
  error: 'error',
  aborted: 'inactive',
}

const LIVE_MAIN = 'main'
const BAND_PREFIX = 'band:'
// Bantta paneli açan simge düğme.
const PANE_ICON = '☰'

// Dosya düzenleyen araçlar: tur özetinde "n dosya" olarak sayılır.
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit'])
const TURN_FILES_SHOWN = 3

const TURN_HEAD: Record<TurnSummary['reason'], string> = {
  answer: '✓ Tur bitti',
  aborted: '■ Tur durduruldu',
  refusal: '✕ Model reddetti',
  error: '✕ Tur hatayla bitti',
}

const TURN_COLOR: Record<TurnSummary['reason'], string> = {
  answer: 'success',
  aborted: 'inactive',
  refusal: 'error',
  error: 'error',
}

// Tur özetinin gövdesi: "42sn · 7 araç · 2 dosya: a.ts, b.ts · bağlam 120k".
function turnText(t: TurnSummary): string {
  const shown = t.files.slice(0, TURN_FILES_SHOWN).join(', ')
  const more = t.files.length > TURN_FILES_SHOWN ? ` +${t.files.length - TURN_FILES_SHOWN}` : ''
  const parts = [
    duration(t.durationMs),
    `${t.tools} araç`,
    t.agents > 0 ? `${t.agents} alt ajan` : '',
    t.files.length > 0 ? `${t.files.length} dosya: ${shown}${more}` : '',
    t.tokens !== null ? `bağlam ${compact(t.tokens)}` : '',
  ]

  return parts.filter(part => part !== '').join(' · ')
}

// Masaüstünde adım simgesinin kutusu (px). Tek başına duran satırın başlığı ~28 px
// (noktaların ortası üstten ~14 px), gruptaki satırlar daha kısa ve noktasız;
// satır türü props'ta yok, 24 ikisine de yakın düşer (ekran görüntülerinden).
const STEP_ROW_HEIGHT = 24
// Simgenin sağındaki boşluk (px): gruptaki satırda yazı simgeye yapışmasın.
const STEP_ICON_GAP = 4
// Sohbetteki maskot satırlarının boyu (px): Ajan satırı ve çalışma satırı aynı.
const AGENT_ROW_HEIGHT = 22
// Çalışma satırının sola çekildiği hücre sayısı (uygulamanın girintisini dengeler).
const SPINNER_PULL = 1
// Uygulama çalışma satırındaki resmi ~21 px'e sınırlıyor (ekran görüntüsünden ölçüldü,
// 2026-10-10): kutu ona sığar, maskot yine 22 px ölçekte çizilir. Bir hücrelik çekme
// fazla geldiği için maskot kutunun içinde birkaç px sağa alınır; yazı da ajan satırıyla hizalanır.
// v0.9.26: ikinci ölçümde sınır 20 px çıktı; yazı ajan satırındakinden ~3 px solda kalıyordu.
// Uygulama satırın sol kenarının dışını kırpar: maskot kutuda 5 px sağda durur, yoksa sol
// kolu kesilir (v0.9.29); yazı ajan satırıyla hizalı kalsın diye sağda 3 px (v0.9.30, ölçüldü).
const SPINNER_BOX_HEIGHT = 20
const SPINNER_LEFT_PAD = 5
const SPINNER_RIGHT_PAD = 3

// SVG'nin viewBox'ını genişletir: `w`×`h` px'lik simge, `boxW`×`boxH` px'lik
// kutunun dikey ortasında ve solunda çizilir (fazlası sağda boşluk olur).
function padIcon(svg: string, w: number, h: number, boxW: number, boxH: number, left = 0): string {
  return svg.replace(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/, (_, x, y, _vw, vh) => {
    const perPx = Number(vh) / h
    const top = Number(y) - ((boxH - h) * perPx) / 2

    return `viewBox="${Number(x) - left * perPx} ${top} ${boxW * perPx} ${boxH * perPx}"`
  })
}

// Kendi diyaloğu olan araçlar: satırlarına simge eklenmez.
const SILENT_TOOLS = new Set(['AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode'])

const AGENT_POSE: Record<StepPhase, Pose> = {
  run: 'run',
  done: 'done',
  error: 'error',
  stopped: 'aborted',
}

// `background`: çalışan alt ajan sayısı. Claude'un turu bitmişken onlar sürüyorsa
// "boşta" yazısı bir şey olmuyormuş gibi okunmasın.
function mainText(m: MainState, background = 0): string {
  // Arka plan ajanı bitince Claude ondan haber alıp kendiliğinden devam eder:
  // turu bitmiş Claude aslında onu bekliyor; bu arada mesaj da alabilir. Kaç
  // ajan çalıştığı "Alt ajanlar · n çalışıyor" başlığında yazar.
  const waiting = `${background > 1 ? 'Alt ajanları' : 'Alt ajanı'} bekliyor · seni de dinliyor`

  switch (m.mode) {
    case 'idle':
      return background > 0 ? waiting : 'Boşta, seni bekliyor'
    case 'think':
      return 'Düşünüyor…'
    case 'tool':
      return m.detail ?? m.tool ?? 'Araç kullanıyor'
    case 'done':
      return background > 0 ? waiting : 'Bitti'
    case 'error':
      return background > 0 ? `Bir sorun çıktı · ${background} ajan çalışıyor` : 'Bir sorun çıktı'
  }
}

const runningCount = (list: readonly AgentCard[]) =>
  list.filter(card => card.status === 'running').length

function cardMeta(card: AgentCard, tools: number, t: number, liveTokens = 0): string {
  const span = duration((card.endedAt ?? Math.max(t, card.startedAt)) - card.startedAt)
  const took = card.isLate === true ? `≥${span}` : span
  const used =
    card.hasContext === true ? card.tokens : liveTokens > 0 && card.endedAt === null ? liveTokens : null
  const tokens = used === null ? '' : ` · bağlam ${compact(used)}`
  const bg = card.isBackground ? ' · arka plan' : ''

  return `${prettyModel(card.model)} · ${took} · ${tools} araç${tokens}${bg}`
}

const line = (text: string, isDim = true, color = ''): LiveLine => ({ text, color, isDim })

function compactLine(n: CompactNote): LiveLine {
  return line(
    n.before !== undefined && n.after !== undefined
      ? `sıkıştırıldı ${roundK(n.before)} → ${roundK(n.after)}`
      : 'bağlam sıkıştırıldı',
  )
}

function mainLines(m: MainState, background = 0): LiveLine[] {
  return [
    line(mainText(m, background), false),
    ...(m.compacted === undefined ? [] : [compactLine(m.compacted)]),
  ]
}

// Çalışan alt ajanın şu anki adımı: araç sürüyorsa etiketi ve o adımın süresi,
// araç bittiyse "düşünüyor" ve son araçtan beri geçen süre. Süre sorunun anındaki
// saatle hesaplanır; adım bilinmiyorsa (ilk araçtan önce) null.
function stepNow(one: AgentLive | undefined, t: number, size: number): { text: string; isSlow: boolean } | null {
  if (one?.phase === undefined || one.since === undefined) {
    return null
  }

  const took = duration(t - one.since)
  const text = one.phase === 'tool' ? `${clip(one.lastTool ?? '', size)} · ${took}` : `düşünüyor · ${took}`

  return { text, isSlow: t - one.since > SLOW_STEP_MS }
}

function agentLines(card: AgentCard, one: AgentLive | undefined, t: number): LiveLine[] {
  const lines = [line(cardMeta(card, one?.tools ?? card.tools, t, one?.tokens ?? 0))]
  const now = stepNow(one, t, 80)

  if (now !== null) {
    return [...lines, line(`↳ ${now.text}`, !now.isSlow, now.isSlow ? 'warning' : '')]
  }

  const last = one?.lastTool ?? card.lastTool

  return last === null ? lines : [...lines, line(`↳ ${last}`)]
}

function stepLines(steps: readonly string[]): LiveLine[] {
  return steps.length === 0 ? [line('Henüz adım yok')] : steps.map(step => line(`· ${step}`))
}

// Raporun ilk dolu satırları, açılan kartta önizleme: başlık ya da baştan sona
// kalın satır kalın çizilir, madde işareti "•" olur, diğer Markdown işaretleri düşer.
function answerPreview(answer: string): ReportLine[] {
  return textPreview(answer, ANSWER_PREVIEW_LINES)
}

// Metnin ilk dolu satırları, Markdown işaretleri ayıklanmış; fazlası "…" satırıyla belirtilir.
function textPreview(source: string, limit: number): ReportLine[] {
  const rows = source
    .split('\n')
    .map(row => row.trim())
    .filter(row => row !== '')
  const shown = rows.slice(0, limit).map(row => {
    const isBold = /^#+\s/.test(row) || /^\*\*[^*]+\*\*:?$/.test(row)
    const text = row
      .replace(/^#+\s*/, '')
      .replace(/^[-*]\s+/, '• ')
      .replace(/\*\*|`/g, '')

    return { text, isBold }
  })

  return rows.length > limit ? [...shown, { text: '…', isBold: false }] : shown
}

// Kartın Client bölgesine giden veri: çalışırken canlı sayaçlardan, bitince kartın son hâlinden.
function cardProps(
  card: AgentCard,
  one: AgentLive | undefined,
  t: number,
  part: CardProps['part'] = 'head',
  tab: CardTab = 'steps',
): CardProps {
  const isRunning = card.status === 'running'
  const look = lookFor(card.type)

  return {
    part,
    tab,
    id: card.id,
    isRunning,
    label: look.label,
    color: look.color,
    statusText: STATUS_TEXT[card.status],
    statusColor: STATUS_COLOR[card.status],
    description: card.description,
    meta: isRunning
      ? agentLines(card, one, t)
      : [line(cardMeta(card, card.tools, card.endedAt ?? card.startedAt))],
    steps: stepLines(isRunning ? (one?.steps ?? []) : (card.steps ?? [])),
    report: answerPreview(card.answer ?? ''),
    task: textPreview(card.prompt ?? '', TASK_PREVIEW_LINES),
  }
}

// Rapor prompt kutusuna taslak olarak eklenir; gönderen yine sensin.
async function fillPrompt($: EngineInterface, card: AgentCard): Promise<void> {
  const look = lookFor(card.type)
  await $.prompt.fill({
    text: `${look.label} sonucu (${card.description}):\n${card.answer ?? ''}\n\n`,
    mode: 'insert',
  })
  $.ui.toast(`${look.label} sonucu prompt'a eklendi`)
}

async function copyAnswer($: EngineInterface, card: AgentCard, surface: RenderSurface) {
  const copied = await $.ui.copy({ text: card.answer ?? '', surface })
  $.ui.toast(copied.isCopied ? 'Rapor kopyalandı' : 'Rapor kopyalanamadı')
}

function bandLine(card: AgentCard, one: AgentLive | undefined, t: number): LiveLine {
  const look = lookFor(card.type)
  const now = stepNow(one, t, 34)

  if (now !== null) {
    return line(`${look.label} · ${now.text}`, false, now.isSlow ? 'warning' : look.color)
  }

  const doing = one?.lastTool ?? card.lastTool ?? 'başlıyor…'

  return line(`${look.label} · ${clip(doing, 34)}`, false, look.color)
}

// Alt ajanın aracı bitti: süren başka araç yoksa adım "düşünüyor" olur ve süresi
// baştan sayılır. Hata yutulur: tool.call'ın .catch'i next'i yeniden çağırır.
async function noteStepDone($: EngineInterface, agentId: string): Promise<void> {
  try {
    const t = await $.clock.now()
    await update($, live, (all): Record<string, AgentLive> => {
      const one = all[agentId]

      if (one === undefined) {
        return all
      }

      const inFlight = Math.max(0, (one.inFlight ?? 1) - 1)

      return {
        ...all,
        [agentId]: inFlight === 0 ? { ...one, inFlight, phase: 'think', since: t } : { ...one, inFlight },
      }
    })
  } catch {
    // Satır bir sonraki araca kadar eski adımı gösterir; araç sonucu etkilenmez.
  }
}

// Arka planda iş bırakıp turunu bitiren ajan sonra kendiliğinden devam edebilir:
// biten kartına araç gelirse kart yeniden "çalışıyor" olur, bandı da öyle. Yalnız
// durum değişince yazılır (kart ve bant bir kez yeniden çizilir). Hata yutulur.
async function reviveCard($: EngineInterface, agentId: string): Promise<void> {
  try {
    const card = (await read($, agents)).find(one => one.id === agentId)

    if (card === undefined || card.status === 'running') {
      return
    }

    await update($, agents, list =>
      list.map((one): AgentCard => (one.id === agentId ? { ...one, status: 'running', endedAt: null } : one)),
    )
    await update($, band, (b): BandState =>
      b.batch.includes(agentId) && b.doneAt !== null ? { ...b, doneAt: null } : b,
    )
    saveSoon($)
    await syncRestPose($)
  } catch {
    // Kart "bitti" görünmeye devam eder; araç sonucu etkilenmez.
  }
}

// Başarılı bir düzenleme turun dosya listesine eklenir (aynı dosya bir kez). Hata
// yutulur: tool.call'ın .catch'i next'i yeniden çağırır, araç iki kez çalışmasın.
async function noteEdit($: EngineInterface, e: ToolCallInput, result: ToolCallResult) {
  try {
    const file = toolDetail(e)

    if (!EDIT_TOOLS.has(String(e.tool)) || file === '' || result.deny !== undefined || result.isError) {
      return
    }

    await update($, turn, (t): TurnProgress =>
      t.files.includes(file) ? t : { ...t, files: [...t.files, file] },
    )
  } catch {
    // Özet bir dosya eksik gösterir; araç sonucu etkilenmez.
  }
}

// Kalıcı ayarı oturumun state'ine taşır; bozuk ya da eksik kayıt varsayılana düşer.
async function loadPrefs($: EngineInterface): Promise<void> {
  const saved = (await $.store.get(PREFS_KEY)) as Partial<Prefs> | undefined
  const next: Prefs = { sound: saved?.sound === true, party: saved?.party === true }
  const now = await read($, prefs)

  if (now.sound !== next.sound || now.party !== next.party) {
    await update($, prefs, () => next)
  }
}

async function togglePref($: EngineInterface, key: keyof Prefs): Promise<boolean> {
  const next = { ...(await read($, prefs)), [key]: !(await read($, prefs))[key] }
  await update($, prefs, () => next)
  await $.store.set(PREFS_KEY, next)

  return next[key]
}

// Bu sohbetin kimliği; okunamazsa ya da boşsa null (kayıt ve geri yükleme yapılmaz).
async function boardId($: EngineInterface): Promise<string | null> {
  try {
    const id = await $.session.id()

    return typeof id === 'string' && id !== '' ? id : null
  } catch {
    return null
  }
}

// Depodaki panolar; bozuk kayıtlar atlanır.
async function savedBoards($: EngineInterface): Promise<Record<string, SavedBoard>> {
  const raw = await $.store.get(BOARDS_KEY)

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, Partial<SavedBoard>>).filter(
      (pair): pair is [string, SavedBoard] => typeof pair[1]?.savedAt === 'number' && Array.isArray(pair[1].agents),
    ),
  )
}

// Kartları ve son turu bu sohbetin kimliğiyle depoya yazar; en son kaydedilen
// BOARDS_KEEP oturum kalır. Boş pano kaydı siler (başka sohbetin kaydını itmesin).
// Çalışan kartlara o anki canlı sayaçlar katılır: geri yüklenince "0 araç" demesin.
async function saveBoard($: EngineInterface): Promise<void> {
  const id = await boardId($)

  if (id === null) {
    return
  }

  const counts = await read($, live)
  const cards = (await read($, agents)).map((card): AgentCard => {
    const one = counts[card.id]

    return card.status === 'running' && one !== undefined
      ? { ...card, tools: one.tools, lastTool: one.lastTool, steps: one.steps ?? card.steps }
      : card
  })
  const lastTurn = await read($, last)
  const others = Object.entries(await savedBoards($)).filter(([key]) => key !== id)
  const mine: Record<string, SavedBoard> =
    cards.length === 0 && lastTurn === null
      ? {}
      : { [id]: { savedAt: await $.clock.now(), agents: cards, last: lastTurn } }
  const kept = [...others, ...Object.entries(mine)]
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .slice(0, BOARDS_KEEP)

  try {
    await $.store.set(BOARDS_KEY, Object.fromEntries(kept))
  } catch {
    // Depo sınırı aşıldıysa yalnız bu sohbetin kaydı kalsın.
    await $.store.set(BOARDS_KEY, mine)
  }
}

// Kayıtlar sırayla yazılır (eski bir anlık görüntü yenisinin üstüne yazılmasın);
// çağıran beklemez, hata yutulur: araç çağrısı ya da tur kayıt yüzünden beklemez.
let saving: Promise<void> = Promise.resolve()

function saveSoon($: EngineInterface): void {
  saving = saving.then(() => saveBoard($)).catch(() => undefined)
}

// Uygulama yeniden açılınca bu sohbetin kayıtlı kartları ve son turu geri gelir.
// Kayıtta çalışan görünen ajan uygulamayla birlikte büyük ihtimalle öldü:
// "durduruldu" yüklenir (hâlâ çalışıyorsa adoptRunning yeniden "çalışıyor" yapar).
// Son tur gizli gelir: bant özet göstermez, panelde "Son tur" kalır.
async function restoreBoard($: EngineInterface): Promise<void> {
  const id = await boardId($)

  if (id === null) {
    return
  }

  const saved = (await savedBoards($))[id]

  if (saved === undefined) {
    return
  }

  if (saved.agents.length > 0 && (await read($, agents)).length === 0) {
    await update($, agents, () =>
      saved.agents.map((card): AgentCard =>
        card.status === 'running' ? { ...card, status: 'aborted', endedAt: saved.savedAt } : card,
      ),
    )
  }

  const lastTurn = saved.last

  if (lastTurn !== null && (await read($, last)) === null) {
    await update($, last, (): TurnSummary => ({ ...lastTurn, isHidden: true }))
  }
}

// Dalganın bitiş sesi; çalamazsa (terminalde oynatıcı yok vb.) sessiz kalır.
function chime($: EngineInterface, isFailed: boolean): void {
  void $.audio.play({ asset: isFailed ? 'sounds/hata.wav' : 'sounds/bitti.wav' }).catch(() => undefined)
}

// Yalnız değer değişince yaz: aynı değeri yazmak da okuyan çizimi yeniden çizer.
async function setPose($: EngineInterface, next: MainPose): Promise<void> {
  if ((await read($, pose)) !== next) {
    // Bu yazım paneli yeniden çizer: canlı bölgeye eski değil güncel satırlar
    // gitsin. Masaüstü boştayken bölgenin saniyelik sorusu gelmeyebiliyor (tur
    // bitince "Düşünüyor…" takılı kaldı, 2026-10-10; sebep doğrulanmadı).
    lastLines.set(LIVE_MAIN, mainLines(await read($, main), runningCount(await read($, agents))))
    await update($, pose, () => next)
  }
}

async function setKind($: EngineInterface, next: ToolKind): Promise<void> {
  if ((await read($, kind)) !== next) {
    await update($, kind, () => next)
  }
}

// "Bitti" pozundan bir süre sonra uykuya geç; arada yeni tur başladıysa dokunma.
// Turu bitmiş Claude'un pozu: arka planda alt ajan çalışıyorsa kum saatli
// bekleyiş, yoksa verilen poz (bitti ya da boşta).
async function restPose($: EngineInterface, rest: 'idle' | 'done'): Promise<MainPose> {
  return runningCount(await read($, agents)) > 0 ? 'wait' : rest
}

// Alt ajan başladı/bitti/canlandı: Claude turunu bitirmişse pozunu ona göre düzelt.
async function syncRestPose($: EngineInterface): Promise<void> {
  const m = await read($, main)

  if (m.mode === 'idle' || m.mode === 'done') {
    await setPose($, await restPose($, m.mode))
  }
}

function settleLater($: EngineInterface, doneAt: number): void {
  $.clock.after(DONE_LINGER_MS, () => {
    void (async () => {
      const m = await read($, main)

      if (m.mode === 'done' && m.since === doneAt) {
        await update($, main, (s): MainState => ({ ...s, mode: 'idle' }))
        await setPose($, await restPose($, 'idle'))
      }
    })()
  })
}

// Pano yüklenmeden önce başlamış, hâlâ çalışan ajanları karta çevirir. Liste
// model, token ve başlangıç anı vermez; bunlar ajan bitince ya da hiç gelmez.
// Kartı olan ama "çalışıyor" görünmeyen ajan (geri yüklenen "durduruldu" kart)
// listede çalışıyorsa kartı yeniden "çalışıyor" olur.
async function adoptRunning($: EngineInterface): Promise<void> {
  const listed = (await $.agent.list()).filter(one => one.status === 'running' || one.status === 'pending')
  const known = await read($, agents)
  const fresh = listed.filter(one => !known.some(card => card.id === one.id))
  const stale = listed.filter(one => known.some(card => card.id === one.id && card.status !== 'running'))

  if (fresh.length === 0 && stale.length === 0) {
    return
  }

  const t = await $.clock.now()
  await update($, agents, list =>
    trim([
      ...list.map((card): AgentCard =>
        stale.some(one => one.id === card.id) ? { ...card, status: 'running', endedAt: null } : card,
      ),
      ...fresh
        .filter(one => !list.some(card => card.id === one.id))
        .map(
          (one): AgentCard => ({
            id: one.id,
            type: one.type,
            description: one.description,
            model: '',
            status: 'running',
            startedAt: t,
            endedAt: null,
            tools: 0,
            lastTool: null,
            tokens: null,
            // Liste ön/arka plan bilgisini vermez; bilinmeyeni "arka plan" diye etiketleme.
            isBackground: false,
            isLate: true,
          }),
        ),
    ]),
  )
  saveSoon($)
  await syncRestPose($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pano',
      description: 'Ajan panosunu açar; "ses" ya da "kutlama" ile o ayarı açıp kapatır',
      argumentHint: '[ses|kutlama]',
    })
    await loadPrefs($).catch(() => undefined)
    // Önce bu sohbetin kayıtlı panosu, sonra hâlâ çalışan ajanların devralınması.
    await restoreBoard($).catch(() => undefined)
    void $.ui.open({ id: PANE, title: TITLE })
    await adoptRunning($).catch(() => undefined)

    return next(e)
  })

  // /clear yeni bir oturum açar (session.start gelmez): pano boş başlar, eski
  // sohbetin kaydı depoda kalır. Sıradaki kayıtlar önce biter, boş pano eskinin
  // kaydını silmesin.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      try {
        await saving
        await update($, agents, (): AgentCard[] => [])
        await update($, last, () => null)
        await update($, band, (): BandState => EMPTY_BAND)
      } catch {
        // Pano eski kartlarla kalır; oturumun kapanışı etkilenmez.
      }
    }

    return next(e)
  })

  on('command.run', { command: 'pano' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()

    if (arg === 'ses') {
      const isOn = await togglePref($, 'sound')

      if (isOn) {
        chime($, false)
      }

      return { text: isOn ? 'Ses açık: ajanlar bitince çan çalar.' : 'Ses kapalı.' }
    }

    if (arg === 'kutlama') {
      const isOn = await togglePref($, 'party')

      return {
        text: isOn ? 'Kutlama açık: ajanlar sorunsuz bitince bantta konfeti.' : 'Kutlama kapalı.',
      }
    }

    if (arg !== '') {
      return { text: 'Kullanım: /pano · /pano ses · /pano kutlama' }
    }

    await adoptRunning($).catch(() => undefined)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Ajan panosu açıldı.' }
  })

  on('turn.start', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, main, (m): MainState => ({
      ...m,
      mode: 'think',
      tool: null,
      detail: null,
      since: t,
      inFlight: 0,
      turns: m.turns + 1,
    }))
    await setPose($, 'think')
    await update($, turn, (): TurnProgress => EMPTY_TURN)

    if ((await read($, last))?.isHidden === false) {
      await update($, last, s => (s === null ? s : { ...s, isHidden: true }))
      saveSoon($)
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const label = toolLabel(e)
    const agentId = e.agentId

    if (agentId !== undefined) {
      // Kart henüz yoksa da (spawn'ın next'i dönmeden) sayaç burada birikir.
      // Adım 'tool' olur, süresi aracın başladığı andan sayılır.
      const startedAt = await $.clock.now()
      await update($, live, (all): Record<string, AgentLive> => {
        const one = all[agentId] ?? { tools: 0, lastTool: null }

        const steps = [...(one.steps ?? []), label].slice(-STEPS_KEEP)

        return {
          ...all,
          [agentId]: {
            ...one,
            tools: one.tools + 1,
            lastTool: label,
            steps,
            phase: 'tool',
            since: startedAt,
            inFlight: (one.inFlight ?? 0) + 1,
          },
        }
      })
      await reviveCard($, agentId)

      try {
        const result = await next(e)
        await noteEdit($, e, result)

        return result
      } finally {
        await noteStepDone($, agentId)
      }
    }

    const tool = shortTool(String(e.tool))
    await update($, main, (m): MainState => ({
      ...m,
      mode: 'tool',
      tool,
      detail: label,
      tools: m.tools + 1,
      inFlight: m.inFlight + 1,
    }))
    await setKind($, kindOf(tool))
    await update($, turn, (t): TurnProgress => ({ ...t, tools: t.tools + 1 }))

    try {
      const result = await next(e)
      await noteEdit($, e, result)

      return result
    } finally {
      await update($, main, (m): MainState => {
        const inFlight = Math.max(0, m.inFlight - 1)

        return m.mode === 'tool' && inFlight === 0
          ? { ...m, inFlight, mode: 'think' }
          : { ...m, inFlight }
      })
    }
  }).catch(($, e, next) => next(e))

  // Her model isteği bitince bağlam boyutu yazılır (ana Claude `main`'e, alt ajan
  // `live`'a); ikisini de hiçbir çizim okumaz, panel yeniden çizilmez.
  on('turn.step', async function* ($, e, next) {
    // Alt ajanın süren turu: "Durdur" düğmesinin ikinci yolu ($.turn.abort) bunu kullanır.
    if (e.agentId !== undefined) {
      agentTurns.set(e.agentId, e.turnId)
    }

    const result = yield* next(e)
    const agentId = e.agentId

    if (agentId === undefined && result.usage !== null) {
      const size = contextOf(result.usage)

      try {
        await update($, main, (m): MainState => ({ ...m, tokens: size }))
      } catch {
        // Bir istek kaçarsa bir sonraki istek bağlamı yine yazar.
      }
    }

    if (agentId !== undefined && result.usage !== null) {
      const size = contextOf(result.usage)

      try {
        await update($, live, all => {
          const one = all[agentId] ?? { tools: 0, lastTool: null }

          return { ...all, [agentId]: { ...one, tokens: size } }
        })
      } catch {
        // Bir istek kaçarsa bir sonraki istek bağlamı yine yazar.
      }
    }

    return result
  })

  // Ana sohbet sıkıştırılınca not düşülür; eski bağlam sayısı silinir (yeni
  // pencerenin ilk yanıtına kadar bilinmiyor). Alt ajanınki ve `precompute`
  // (yalnız hazırlık, sohbet değişmez) sayılmaz.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined && e.trigger !== 'precompute' && result.skip === undefined) {
      try {
        await update($, main, (m): MainState => ({
          ...m,
          tokens: undefined,
          compacted: { before: result.tokensBefore, after: result.tokensAfter, turn: m.turns },
        }))
      } catch {
        // Not çıkmaz; sıkıştırma etkilenmez.
      }
    }

    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const startedAt = await $.clock.now()
    const ran = await next(e)
    const agentId = ran.agentId

    if (agentId === undefined) {
      return ran
    }

    const card: AgentCard = {
      id: agentId,
      type: e.fork ? 'fork' : e.subagentType,
      description: e.description,
      model: ran.model,
      status: 'running',
      startedAt,
      endedAt: null,
      tools: 0,
      lastTool: null,
      tokens: null,
      isBackground: e.background,
      toolUseId: e.tool_use_id,
      prompt: e.prompt.slice(0, PROMPT_KEEP_CHARS),
    }
    const wasIdle = !(await read($, agents)).some(one => one.status === 'running')
    await update($, agents, list => trim([...list.filter(one => one.id !== agentId), card]))
    await update($, main, (m): MainState => ({ ...m, agents: m.agents + 1 }))
    await update($, turn, (t): TurnProgress => ({ ...t, agents: t.agents + 1 }))
    // Çalışan ajan yokken başlayan ajan yeni bir dalga açar; bant ona göre çizilir.
    await update($, band, (b): BandState =>
      wasIdle || b.doneAt !== null
        ? { batch: [agentId], doneAt: null }
        : { ...b, batch: [...b.batch, agentId] },
    )
    saveSoon($)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const t = await $.clock.now()
    const agentId = e.agentId

    if (agentId !== undefined) {
      const known = await read($, agents)

      if (known.some(card => card.id === agentId)) {
        const one = (await read($, live))[agentId]
        const status: AgentStatus =
          e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'aborted' : 'error'
        await update($, agents, list =>
          list.map(card =>
            card.id === agentId
              ? {
                  ...card,
                  status,
                  endedAt: t,
                  tools: one?.tools ?? card.tools,
                  lastTool: one?.lastTool ?? card.lastTool,
                  tokens: one?.tokens ?? null,
                  hasContext: one?.tokens !== undefined,
                  steps: one?.steps ?? card.steps,
                  answer: e.answer.slice(0, ANSWER_KEEP),
                  model: e.usage?.model ?? card.model,
                }
              : card,
          ),
        )
        saveSoon($)
        await syncRestPose($)

        const after = await read($, agents)

        if (!after.some(card => card.status === 'running')) {
          const batch = (await read($, band)).batch
          const isFailed = after.some(card => batch.includes(card.id) && card.status !== 'done')

          if ((await read($, prefs)).sound) {
            chime($, isFailed)
          }

          await update($, band, (b): BandState => ({ ...b, doneAt: t }))
          $.clock.after(BAND_LINGER_MS, () => {
            void update($, band, (b): BandState => (b.doneAt === t ? EMPTY_BAND : b))
          })
        }
      }
    } else {
      const mode = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
      await update($, main, (m): MainState => ({
        ...m,
        mode,
        tool: null,
        detail: null,
        since: t,
        inFlight: 0,
        // Sıkıştırmadan sonra başlayan tur bitti: not kaybolur.
        compacted: m.compacted !== undefined && m.turns > m.compacted.turn ? undefined : m.compacted,
      }))
      await setPose($, mode === 'error' ? mode : await restPose($, mode))
      const progress = await read($, turn)
      const tokens = (await read($, main)).tokens
      await update($, last, (): TurnSummary => ({
        reason: e.reason,
        durationMs: e.durationMs,
        tools: progress.tools,
        agents: progress.agents,
        files: progress.files,
        tokens: tokens ?? null,
        isHidden: false,
      }))
      saveSoon($)

      if (e.reason === 'answer') {
        settleLater($, t)
      }
    }

    return next(e)
  })

  // Client bölgelerinin saniyelik sorusu ve kart düğmeleri: son satırları
  // döndürür ya da düğmenin işini yapar; hiçbiri state yazmaz, çizim tetiklemez.
  on('ui.message', async ($, e, next) => {
    const asked = e.data as
      | { id?: unknown; card?: unknown; action?: unknown; part?: unknown; tab?: unknown }
      | null

    if (typeof asked?.card === 'string') {
      const card = (await read($, agents)).find(one => one.id === asked.card)

      if (card === undefined) {
        return next(e)
      }

      if (asked.action === 'prompt') {
        await fillPrompt($, card)
        return {}
      }

      if (asked.action === 'copy') {
        await copyAnswer($, card, e.surface)
        return {}
      }

      const part = asked.part === 'body' ? 'body' : 'head'
      const tab = asked.tab === 'task' || asked.tab === 'report' ? asked.tab : 'steps'
      const props = cardProps(card, (await read($, live))[card.id], await $.clock.now(), part, tab)
      lastCards.set(`${card.id}:${part}`, props)

      return { props }
    }

    if (typeof asked?.id !== 'string') {
      return next(e)
    }

    const id = asked.id
    let lines: LiveLine[]

    if (id === LIVE_MAIN) {
      lines = mainLines(await read($, main), runningCount(await read($, agents)))
    } else if (id.startsWith(BAND_PREFIX)) {
      const agentId = id.slice(BAND_PREFIX.length)
      const card = (await read($, agents)).find(one => one.id === agentId)

      if (card === undefined) {
        return next(e)
      }

      lines = [bandLine(card, (await read($, live))[agentId], await $.clock.now())]
    } else {
      return next(e)
    }

    lastLines.set(id, lines)

    return { props: { id, lines } }
  })

  // Bir Client bölgesi çizilemezse sebebi bildirimle gösterilir (bölge yeniden
  // yüklenene kadar boş kalır); sebep ölçüm içindir, içeriği yorumlanmaz.
  on('ui.fault', async ($, e, next) => {
    if (e.module.endsWith('card.tsx') || e.module.endsWith('live.tsx')) {
      $.ui.toast(`Ajan panosu: ${e.module.slice(e.module.lastIndexOf('/') + 1)} çizilemedi (${e.phase}): ${e.reason}`)
    }

    return next(e)
  })

  // Masaüstünde turun çalışma satırı: önüne Claude'un mini maskotu; satırın
  // kendisi (süre, ok) engine'in çizimi olarak kalır.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const own = await next(e)

    if (e.surface !== 'desktop') {
      return own
    }

    const { Box, Svg } = $.ui.resolve(e)
    const toolKind = (await read($, kind)) as ToolKind
    const { mode, word, message } = e.props
    const rowPose: Pose = mode === 'thinking' ? 'think' : mode === 'tool-use' ? 'tool' : 'run'

    // Ajan satırındaki maskotla aynı boy ve kutu; uygulama bu satırı biraz içeriden
    // başlattığı için satır SPINNER_PULL hücre sola çekilir, iki maskot aynı sütuna gelir
    // (Burak, 2026-10-10: "biri içerde biri dışarda"). Ölçülmedi, gerçek uygulamada ayarlanır.
    const width = Math.round(AGENT_ROW_HEIGHT * ROW_ASPECT)

    return (
      <Box flexDirection="row" alignItems="center" marginLeft={-SPINNER_PULL}>
        <Svg
          source={padIcon(
            inPhase(mascotSvg('main', rowPose, toolKind, 'row'), await $.clock.now()),
            width,
            AGENT_ROW_HEIGHT,
            width + STEP_ICON_GAP + SPINNER_LEFT_PAD + SPINNER_RIGHT_PAD,
            SPINNER_BOX_HEIGHT,
            SPINNER_LEFT_PAD,
          )}
          alt={`Claude: ${message ?? word}`}
          width={width + STEP_ICON_GAP + SPINNER_LEFT_PAD + SPINNER_RIGHT_PAD}
          height={SPINNER_BOX_HEIGHT}
          isInteractive={IS_FRAMED}
        />
        {own}
      </Box>
    )
  })

  // Sohbetteki araç adımı: önüne türünün simgesi, satırın kendisi engine'in.
  // Yalnız props okunur; state okunmadığı için başka yazımlar bu satırı çizmez.
  // Alt ajanın kendi adımları sohbette çizilmez (ölçüldü); onun yerine "Ajan"
  // satırı alt ajanın mini maskotunu alır. Katlanmış gruplara (ToolGroup) dokunulmaz:
  // masaüstü grubun başlığını kendisi çiziyor, eklenen simge başlığın altına düşüyordu.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const own = await next(e)

    if (e.surface !== 'desktop' || SILENT_TOOLS.has(e.props.tool)) {
      return own
    }

    const { Box, Svg } = $.ui.resolve(e)
    const { tool, isRunning, isErrored, isInterrupted } = e.props
    const phase: StepPhase = isInterrupted
      ? 'stopped'
      : isErrored
        ? 'error'
        : isRunning
          ? 'run'
          : 'done'
    const input = (e.props.input ?? {}) as { subagent_type?: unknown }
    // Arka plan ajanında araç çağrısı ajanı başlatıp hemen biter; satır tiki ajan
    // bitmeden almasın diye pozu ajanın kendi kartından al. Okuma yalnız Agent
    // satırlarında: bu satırlar ajan başlarken/biterken yeniden çizilir.
    const ownCard =
      tool === 'Agent'
        ? (await read($, agents)).find(card => card.toolUseId === e.props.tool_use_id)
        : undefined
    const agentPose: Pose = ownCard === undefined ? AGENT_POSE[phase] : POSE[ownCard.status]
    const icon =
      tool === 'Agent'
        ? inPhase(
            mascotSvg(
              typeof input.subagent_type === 'string' ? input.subagent_type : 'general-purpose',
              agentPose,
              'other',
              'row',
            ),
            await $.clock.now(),
          )
        : stepIconSvg(kindOf(tool), phase)
    const height = tool === 'Agent' ? AGENT_ROW_HEIGHT : 16
    const aspect = tool === 'Agent' ? ROW_ASPECT : STEP_ASPECT
    const width = Math.round(height * aspect)

    return (
      // Üste hizalı: satır açılınca (girdi/çıktı) simge başlıkta kalır, ortaya kaymaz.
      // Kutu başlık satırı kadar uzun, simge onun ortasında: noktalarla aynı hizada.
      <Box flexDirection="row" alignItems="flex-start">
        <Svg
          source={padIcon(icon, width, height, width + STEP_ICON_GAP, STEP_ROW_HEIGHT)}
          alt={shortTool(tool)}
          width={width + STEP_ICON_GAP}
          height={STEP_ROW_HEIGHT}
          isInteractive={IS_FRAMED}
        />
        {own}
      </Box>
    )
  })

  // Prompt üstü bant: bu dalgadaki ajanların mini maskotları yan yana; her
  // birinin "ne yapıyor" yazısı canlı bölgede akar, bant yalnız ajan başlarken/
  // biterken yeniden çizilir. Hepsi bitince kısa bir özet gösterip kaybolur.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const b = await read($, band)
    const inBatch = (await read($, agents)).filter(card => b.batch.includes(card.id))
    // Tur özeti yalnız masaüstünde: terminal tur süresini kendi satırında yazar.
    const lastTurn = e.surface === 'desktop' ? await read($, last) : null
    const showTurn = lastTurn !== null && !lastTurn.isHidden

    if (inBatch.length === 0 && !showTurn) {
      return next(e)
    }

    // Bant bütün modların ortak alanı: sonrakilerin çizimi bizimkinin altında kalsın.
    const others = await next(e)
    const { Box: TurnBox, Text: TurnText, Button: TurnButton } = $.ui.resolve(e)
    const hideTurn = async () => {
      await update($, last, s => (s === null ? s : { ...s, isHidden: true }))
      saveSoon($)
    }
    const turnLine =
      showTurn && lastTurn !== null ? (
        <TurnText key="turn-line" wrap="truncate-end">
          <TurnText color={TURN_COLOR[lastTurn.reason]}>{TURN_HEAD[lastTurn.reason]}</TurnText>
          <TurnText dimColor> · {turnText(lastTurn)}</TurnText>
        </TurnText>
      ) : null
    const turnRow =
      turnLine === null ? null : (
        <TurnBox key="turn" flexDirection="row" alignItems="center" gap={2}>
          <TurnBox flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            {turnLine}
          </TurnBox>
          <TurnButton key="turn-dismiss" label="✕" plain dimColor role="dismiss" onPress={hideTurn} />
        </TurnBox>
      )

    if (inBatch.length === 0) {
      return (
        <TurnBox flexDirection="column">
          {turnRow}
          {others}
        </TurnBox>
      )
    }

    const running = inBatch.filter(card => card.status === 'running')
    const isDone = running.length === 0
    const shown = (isDone ? inBatch : running).slice(0, BAND_SHOWN)
    const hidden = (isDone ? inBatch : running).length - shown.length
    const openPane = async () => {
      await $.ui.open({ id: PANE, title: TITLE })
    }
    const dismiss = async () => {
      if (inBatch.every(card => card.status !== 'running')) {
        await update($, band, (): BandState => EMPTY_BAND)
      }

      if (showTurn) {
        await hideTurn()
      }
    }
    const failed = inBatch.filter(card => card.status !== 'done').length
    const isParty =
      isDone &&
      failed === 0 &&
      b.doneAt !== null &&
      (await read($, prefs)).party &&
      (await $.clock.now()) - b.doneAt < CONFETTI_MS
    const summary = isDone
      ? `✓ ${inBatch.length} ajan bitti${failed > 0 ? ` · ${failed} sorunlu` : ''}`
      : `${running.length} ajan çalışıyor`

    if (e.surface !== 'desktop') {
      const { Box, Text, Button } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="row" gap={2} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Text color={isDone ? 'success' : 'claude'}>{summary}</Text>
            {!isDone &&
              shown.map(card => (
                <Text color={lookFor(card.type).color}>(•ᴗ•) {lookFor(card.type).label}</Text>
              ))}
            {hidden > 0 && <Text dimColor>+{hidden}</Text>}
          </Box>
          <Button key="pane" label={PANE_ICON} plain dimColor onPress={openPane} />
          {isDone && <Button key="dismiss" label="✕" plain dimColor role="dismiss" onPress={dismiss} />}
        </Box>
        {others}
        </Box>
      )
    }

    const { Box, Text, Button, Svg, Client } = $.ui.resolve(e)
    const now = await $.clock.now()
    const mascot = (card: AgentCard) => (
      <Svg
        key={`band-svg-${card.id}`}
        source={inPhase(mascotSvg(card.type, POSE[card.status], 'other', 'row'), now)}
        alt={lookFor(card.type).label}
        width={Math.round(22 * ROW_ASPECT)}
        height={22}
        isInteractive={IS_FRAMED}
      />
    )

    // Sabit düzen: solda satırlar (çalışırken her ajan kendi satırında; bitince tek
    // özet satırı; en altta tur özeti), sağ üstte düğmeler. Satırlar kaydırılmaz,
    // düğmeler yazı uzayıp kısalınca ya da satır eklenince yer değiştirmez.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="flex-start" gap={2}>
          <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            {isDone ? (
              <Box key="band-done" flexDirection="row" alignItems="center" gap={1}>
                {shown.map(mascot)}
                {hidden > 0 && <Text dimColor>+{hidden}</Text>}
                <Text color={failed > 0 ? 'warning' : 'success'}>{summary}</Text>
                {isParty && (
                  <Svg
                    source={confettiSvg()}
                    alt="Kutlama"
                    width={Math.round(22 * CONFETTI_ASPECT)}
                    height={22}
                    isInteractive={IS_FRAMED}
                  />
                )}
              </Box>
            ) : (
              shown.map(card => (
                <Box key={`band-${card.id}`} flexDirection="row" alignItems="center" gap={1}>
                  {mascot(card)}
                  <Client
                    key={`live-band-${card.id}`}
                    module="./live.tsx"
                    props={{
                      id: `${BAND_PREFIX}${card.id}`,
                      lines: lastLines.get(`${BAND_PREFIX}${card.id}`) ?? [bandLine(card, undefined, card.startedAt)],
                    }}
                  />
                </Box>
              ))
            )}
            {!isDone && hidden > 0 && <Text dimColor>+{hidden} ajan daha · ☰ panelde</Text>}
          </Box>
          {/* Ajan bandı varken tur özeti gösterilmez (panelde "Son tur"); bant her an
              tek konu taşır. ✕ biten ajan özetini kapatır, tur özetini de gizler. */}
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Button key="pane" label={PANE_ICON} plain dimColor onPress={openPane} />
            {isDone && <Button key="dismiss" label="✕" plain dimColor role="dismiss" onPress={dismiss} />}
          </Box>
        </Box>
        {others}
      </Box>
    )
  })

  // Panelin boş bir yerine (ya da Client yazısına) tıklamak odağı taşır ve paneli
  // yeniden çizer; bu, Client içindeki düğmelerde ilk tıklamayı yutuyordu (v0.9.34).
  // Böyle bir tıklama tutulur. Odak panelin kendi düğmelerinden birine gidiyorsa geçer:
  // v0.9.37'de düğmeler panele taşınınca tümden tutmak bu kez onların tıklamasını
  // aksatıyordu (Burak). Bedeli: Tab gezinmesi yalnız düğmeler arasında.
  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.origin.kind !== 'person') {
      return next(e)
    }

    if (e.element === undefined) {
      return {}
    }

    const act = paneActions.get(e.element)
    const t = await $.clock.now()

    if (isEcho(e.element, t, 'focus') || act === undefined) {
      lastPaneAct = { element: '', at: 0, by: 'press' }

      return next(e)
    }

    // Panel odak alınca uygulama kendiliğinden yeniden çizer (isFocused) ve o çizim işten
    // önceki state'i okur; işin yazımı ve hemen invalidate o çizimle birleşip kaybolur
    // (state açık, ekran kapalı; Burak: "tıklama efekti bile görünmedi", kod ajanı v0.9.46
    // incelemesi). Yeniden çizim, odak çiziminden (~0,5 sn) sonraya, gecikmeli istenir.
    lastPaneAct = { element: e.element, at: t, by: 'focus' }
    const landed = await next(e)
    await act()
    $.clock.after(FOCUS_REDRAW_MS, () => $.ui.invalidate('ui.render'))

    return landed
  })

  on('ui.press', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const t = await $.clock.now()

    if (isEcho(e.element, t, 'press')) {
      lastPaneAct = { element: '', at: 0, by: 'press' }
      return { element: e.element }
    }

    lastPaneAct = { element: e.element, at: t, by: 'press' }
    return next(e)
  })

  // Kaydırma sıçraması (ölçüm, 2026-10-10): uzun panelde `ui.scroll` olayları 10-20 ms
  // arayla ±1/±2 satır, ters işaretle gelip kendini besliyor (196 olayın 170'i), içerik boyu
  // sabit. Çizim her olaydan sonra aynı satırı okuyor: bozan çizimin boyu değil, motorla
  // ekran arasındaki salınım. Kısa sürede ters yönde gelen küçük hareket yutulur (yerinde
  // kalır); kişinin yavaş geri kaydırması etkilenmez. Düzeltme sonrası izde 204 olayın
  // 1'i yutuldu, ters işaretli hızlı çift kalmadı (Burak: çözüldü).
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    const t = await $.clock.now()
    const isFlip =
      lastScroll.by * e.by < 0 && t - lastScroll.at < SCROLL_FLIP_MS && Math.abs(e.by) <= SCROLL_FLIP_ROWS
    lastScroll = { at: t, by: e.by }

    return next(isFlip ? { ...e, offset: e.offset - e.by } : e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, agents)
    const mainPose = (await read($, pose)) as Pose
    const now = await $.clock.now()
    const running = list.filter(card => card.status === 'running').length
    const hasFinished = list.length > running
    const clear = async () => {
      await update($, agents, all => all.filter(card => card.status === 'running'))
      saveSoon($)
    }
    const newestFirst = [...list].reverse()
    const openViews = await read($, views)
    // Yerel düğme: işi anahtarıyla kaydedilir, odak taşınınca da çalışsın (paneActions).
    paneActions.clear()

    const paneButton = (key: string, label: string, onPress: () => unknown) => {
      paneActions.set(key, onPress)

      return <Button key={key} label={label} variant="secondary" onPress={onPress} />
    }

    const lastTurn = await read($, last)
    const lastLine = lastTurn === null ? null : `Son tur · ${turnText(lastTurn)}`

    if (e.surface === 'terminal') {
      // Terminalde resim yok, yeniden çizim ucuz: canlı değerler doğrudan okunur.
      const { Box, Text, Button } = $.ui.resolve(e)
      const m = await read($, main)
      const counts = await read($, live)
      const t = await $.clock.now()
      const face: Record<Pose, string> = {
        run: '(•ᴗ•)',
        think: '(•ᴗ•)✻',
        tool: '(•ᴗ•)⚙',
        done: '(^ᴗ^)✓',
        error: '(×_×)!',
        aborted: '(-_-)■',
        wait: '(•_•)⧗',
        idle: '(-.-) z',
      }

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Text bold color="claude">
              {face[mainPose]} Claude
            </Text>
            {mainLines(m, running).map(one => (
              <Text color={one.color === '' ? undefined : one.color} dimColor={one.isDim} wrap="truncate-end">
                {one.text}
              </Text>
            ))}
            {lastLine !== null && (
              <Text dimColor wrap="truncate-end">
                {lastLine}
              </Text>
            )}
          </Box>
          {newestFirst.length === 0 && <Text dimColor>Henüz alt ajan yok.</Text>}
          {newestFirst.map(card => (
            <Box key={card.id} flexDirection="column">
              <Text color={lookFor(card.type).color} bold>
                {face[POSE[card.status]]} {lookFor(card.type).label}{' '}
                <Text color={STATUS_COLOR[card.status]}>{STATUS_TEXT[card.status]}</Text>
              </Text>
              <Text wrap="truncate-end">{card.description}</Text>
              <Text dimColor wrap="truncate-end">
                {cardMeta(card, counts[card.id]?.tools ?? card.tools, t, counts[card.id]?.tokens ?? 0)}
              </Text>
            </Box>
          ))}
          {hasFinished && <Button key="clear" label="Bitenleri temizle" onPress={clear} />}
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const isDesktop = e.surface === 'desktop'
    // Canlı bölge yalnız masaüstünde (Client); başka yüzeyde son bilinen satırlar düz yazı.
    const plainLines = (lines: LiveLine[]) => (
      <Box flexDirection="column">
        {lines.map(one => (
          <Text color={one.color === '' ? undefined : one.color} dimColor={one.isDim} wrap="truncate-end">
            {one.text}
          </Text>
        ))}
      </Box>
    )
    const mainBlock = () => {
      const lines = lastLines.get(LIVE_MAIN) ?? [line('…')]

      if (isDesktop) {
        const { Client } = $.ui.resolve(e)

        return <Client key={`live-${LIVE_MAIN}`} module="./live.tsx" props={{ id: LIVE_MAIN, lines }} />
      }

      return plainLines(lines)
    }
    // Kartın yazı sütunu. Masaüstünde yazı Client bölgelerinde (başlık + canlı satırlar,
    // açılınca seçili sekmenin metni), düğmeler panelin kendisinde: Client içindeki düğme
    // yerel çizilmiyordu (Burak: "ucuz", v0.9.37). Başka yüzeyde başlık, meta satırları
    // ve rapor varsa doğrudan çalışan simge düğmeler.
    const cardBlock = (card: AgentCard) => {
      const fresh = cardProps(card, undefined, card.startedAt)
      const props =
        card.status === 'running' ? (lastCards.get(`${card.id}:head`) ?? fresh) : fresh

      if (isDesktop) {
        const { Client } = $.ui.resolve(e)
        const hasReport = props.report.length > 0
        const hasTask = props.task.length > 0
        const view = openViews[card.id]
        const isOpen = view !== undefined
        // 'none': açık sekmeye yeniden basıldı, metin kapalı (sekmeler görünür kalır).
        const isShut = view === 'none'
        const chosen = view === 'none' ? undefined : view
        const tab: CardTab =
          chosen === undefined ||
          (chosen === 'report' && !hasReport) ||
          (chosen === 'task' && !hasTask)
            ? hasReport && chosen === undefined
              ? 'report'
              : 'steps'
            : chosen
        // Düğmeler o anki state'ten karar verir, çizimdeki hâlden değil: ekran yeniden
        // çizilmeden gelen ikinci tıklama eski hâlle aynı işi tekrarlıyordu (kart yine
        // "açıl"; tıklama işlenip ekran değişmiyordu, ölçüldü v0.9.44).
        const toggleOpen = () =>
          update($, views, all => {
            const rest = { ...all }
            delete rest[card.id]

            return card.id in all ? rest : { ...rest, [card.id]: tab }
          })
        const toggleTab = (id: CardTab) => () =>
          update($, views, all => ({ ...all, [card.id]: all[card.id] === id ? 'none' : id }))
        const freshBody = cardProps(card, undefined, card.startedAt, 'body', tab)
        const body =
          card.status === 'running'
            ? { ...(lastCards.get(`${card.id}:body`) ?? freshBody), tab }
            : freshBody
        // Seçili sekme işaretlenmez: altındaki metin değişince hangisi olduğu belli (Burak).
        const tabButton = (id: CardTab, label: string) =>
          paneButton(`tab-${id}-${card.id}`, label, toggleTab(id))

        return (
          <Box flexDirection="column" minWidth={0}>
            <Box flexDirection="row" alignItems="flex-start" gap={1}>
              <Box flexGrow={1} flexShrink={1} minWidth={0}>
                <Client key={`card-${card.id}`} module="./card.tsx" props={props} />
              </Box>
              {card.status === 'running' &&
                paneButton(`stop-${card.id}`, 'Durdur ■', () => stopAgent($, card))}
              {paneButton(`more-${card.id}`, isOpen ? 'Detay ▲' : 'Detay ▼', toggleOpen)}
            </Box>
            {isOpen && (
              <Box flexDirection="column" marginTop={1} gap={1} minWidth={0}>
                <Box flexDirection="row" gap={1} flexWrap="wrap">
                  {hasTask && tabButton('task', 'Prompt')}
                  {tabButton('steps', `Adımlar (${body.steps.length})`)}
                  {hasReport && tabButton('report', 'Rapor')}
                </Box>
                {!isShut && (
                  <Client
                    key={`cardbody-${card.id}-${tab}`}
                    module="./card.tsx"
                    props={body}
                  />
                )}
                {!isShut && tab === 'report' && hasReport && (
                  <Box flexDirection="row" gap={1}>
                    {paneButton(`prompt-${card.id}`, "Prompt'a al", () => fillPrompt($, card))}
                    {paneButton(`copy-${card.id}`, 'Kopyala', () => copyAnswer($, card, e.surface))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )
      }

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Box flexGrow={1} flexShrink={1}>
              <Text wrap="truncate-end">
                <Text bold color={props.color}>
                  {props.label}
                </Text>
                {'  '}
                <Text color={props.statusColor}>{props.statusText}</Text>
              </Text>
            </Box>
            {props.report.length > 0 && (
              <Button key={`prompt-${card.id}`} label="↵" plain dimColor onPress={() => fillPrompt($, card)} />
            )}
            {props.report.length > 0 && (
              <Button
                key={`copy-${card.id}`}
                label="⧉"
                plain
                dimColor
                onPress={() => copyAnswer($, card, e.surface)}
              />
            )}
          </Box>
          <Text wrap="truncate-end">{props.description}</Text>
          {plainLines(props.meta)}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box key="main" flexDirection="row" gap={2} alignItems="center">
          <Svg
            source={inPhase(mascotSvg('main', mainPose), now)}
            alt="Claude"
            width={96}
            height={96}
            isInteractive={IS_FRAMED}
          />
          <Box flexDirection="column" flexShrink={1}>
            <Text bold color="claude">
              Claude
            </Text>
            {mainBlock()}
            {lastLine !== null && (
              <Text dimColor wrap="truncate-end">
                {lastLine}
              </Text>
            )}
          </Box>
        </Box>

        <Text bold>
          Alt ajanlar{running > 0 ? ` · ${running} çalışıyor` : ''}
        </Text>

        {newestFirst.length === 0 && (
          <Text dimColor>Henüz alt ajan yok. Biri çalışınca burada belirecek.</Text>
        )}

        {newestFirst.map(card => {
          const look = lookFor(card.type)

          return (
            <Box
              key={card.id}
              flexDirection="row"
              gap={1}
              alignItems="flex-start"
              borderStyle="round"
              borderColor={STATUS_COLOR[card.status]}
              paddingX={1}
            >
              <Svg
                source={inPhase(mascotSvg(card.type, POSE[card.status]), now)}
                alt={`${look.label}: ${STATUS_TEXT[card.status]}`}
                width={60}
                height={60}
                isInteractive={IS_FRAMED}
              />
              {/* minWidth 0: yoksa uzun satır sütunu daraltmaz, "…" çerçevenin dışına taşar. */}
              <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                {cardBlock(card)}
              </Box>
            </Box>
          )
        })}

        {hasFinished && (
          paneButton('clear', 'Bitenleri temizle', clear)
        )}
      </Box>
    )
  })
}
