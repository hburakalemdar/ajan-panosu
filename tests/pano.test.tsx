import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'ajan-panosu',
  props: { title: 'Ajan panosu', isFocused: false, bodyColumns: 60, placement: 'dock' },
} as const

const USAGE = {
  model: 'claude-sonnet-5-5',
  input_tokens: 1200,
  output_tokens: 800,
  cache_read_input_tokens: 10000,
  cache_creation_input_tokens: 0,
}

test('alt ajan kartı açılır, araç sayar ve biter', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-1' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.agent.spawn({
    prompt: 'Yenilikleri bul',
    description: 'Claude Code yeniliklerini bul',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface, ...PANE })
    // Masaüstünde kartın yazı sütunu Client bölgesinde.
    const scope = surface === 'desktop' ? { in: 'card-ajan-1' } : {}
    expect(await ui.find({ text: /Okuyucu/, ...scope })).toBeDefined()
    expect(await ui.find({ text: /Claude Code yeniliklerini bul/, ...scope })).toBeDefined()
    expect(await ui.find({ text: /çalışıyor/ })).toBeDefined()
    await ui.unmount()
  }

  await $.turn.complete({
    agentId: 'ajan-1',
    answer: 'tamam',
    durationMs: 4000,
    isAborted: false,
    turnId: 't-1',
    reason: 'answer',
    usage: USAGE,
  })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface, ...PANE })
    const scope = surface === 'desktop' ? { in: 'card-ajan-1' } : {}
    expect(await ui.find({ text: /bitti/, ...scope })).toBeDefined()
    expect(await ui.find({ text: /Sonnet 5\.5/, ...scope })).toBeDefined()
    await ui.press({ key: 'clear' })
    expect(await ui.find({ text: /Henüz alt ajan yok/ })).toBeDefined()
    await ui.unmount()

    if (surface === 'desktop') {
      break
    }
  }
})

test('masaüstünde maskotlar SVG olarak çizilir', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBeGreaterThan(0)
  expect(String(svgs[0]?.props.source)).toContain('<svg')
  const region = await ui.find({ type: 'Client' })
  expect(String(region?.props.module)).toContain('live.tsx')
  await ui.unmount()
})

test('pano açılmadan başlamış ajanı karta ekler', async ($, on) => {
  mock.clock(on, { now: 2_000_000 })
  on('agent.list', () => ({
    value: [
      { id: 'eski-1', type: 'denetleyici', description: 'Bölüm 2 denetimi', status: 'running' },
      { id: 'bitmis', type: 'okuyucu', description: 'Eski iş', status: 'completed' },
    ],
  }))
  on('ui.open', () => ({ value: {} }))
  on('command.run', () => ({ text: '' }))

  await $.command.run({ command: 'pano' })

  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await ui.find({ text: /Bölüm 2 denetimi/, in: 'card-eski-1' })).toBeDefined()
  expect(await ui.find({ text: /Denetleyici/, in: 'card-eski-1' })).toBeDefined()
  expect(await ui.findAll({ type: 'Client' })).toHaveLength(2)
  await ui.unmount()
})

test('masaüstünde çalışma satırı maskotla çizilir', async ($, on) => {
  mock.clock(on, { now: 3_000_000 })
  on('ui.render', { component: 'Spinner' }, () => ({ type: 'engine', ref: 0 }))
  const ui = await $.ui.mount({
    plugin: 'ajan-panosu',
    surface: 'desktop',
    component: 'Spinner',
    props: { word: 'Creating notes.md', message: null, suffix: '…', mode: 'tool-use' },
  })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.source)).toContain('<svg')
  expect(await ui.find({ type: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('canlı bölge saniyelik sorusunda son satırları alır', async ($, on) => {
  mock.clock(on, { now: 3_000_000 })
  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  await ui.post({ id: 'main' }, { in: 'live-main' })
  const drawn = JSON.stringify(await ui.drawn({ in: 'live-main' }))
  expect(drawn).toContain('Boşta, seni bekliyor')
  // Uygulama açılınca sıfırlanan oturum sayaçları (tur/araç) gösterilmez.
  expect(drawn).not.toContain('0 tur')
  await ui.unmount()
})

test('çalışan alt ajanın bağlamı canlı görünür', async ($, on) => {
  mock.clock(on, { now: 4_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-2' }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'tool_use',
      usage: USAGE,
    }
  })

  await $.agent.spawn({
    prompt: 'x',
    description: 'Uzun araştırma',
    subagentType: 'web-researcher',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

  for (const index of [0, 1]) {
    for await (const _ of $.turn.step({
      turnId: 't-2',
      index,
      model: 'claude-sonnet-5-5',
      messageCount: 3,
      agentId: 'ajan-2',
    })) {
      // akışı tüket
    }
  }

  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  await ui.post({ card: 'ajan-2' }, { in: 'card-ajan-2' })
  expect(JSON.stringify(await ui.drawn({ in: 'card-ajan-2' }))).toContain('bağlam 12.0k')
  await ui.unmount()
})

const step = (tool: string, extra: Record<string, unknown> = {}) => ({
  component: 'ToolUse' as const,
  requestId: 'toolu_1',
  props: {
    tool_use_id: 'toolu_1',
    tool,
    input: {},
    isRunning: true,
    isErrored: false,
    isInterrupted: false,
    ...extra,
  },
})

test('adım satırı: çalışırken hareketli simge, bitince durur, terminalde yok', async ($, on) => {
  on('ui.render', { component: 'ToolUse' }, () => ({ type: 'engine', ref: 0 }))

  const running = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...step('Bash') })
  const icon = String((await running.find({ type: 'Svg' }))?.props.source)
  expect(icon).toContain('#7EE787')
  expect(icon).toContain('<animate')
  expect(await running.find({ type: 'engine' })).toBeDefined()
  await running.unmount()

  const done = await $.ui.mount({
    plugin: 'ajan-panosu',
    surface: 'desktop',
    ...step('Bash', { isRunning: false }),
  })
  expect(String((await done.find({ type: 'Svg' }))?.props.source)).not.toContain('<animate')
  await done.unmount()

  const failed = await $.ui.mount({
    plugin: 'ajan-panosu',
    surface: 'desktop',
    ...step('Read', { isRunning: false, isErrored: true }),
  })
  expect(String((await failed.find({ type: 'Svg' }))?.props.source)).toContain('#F85149')
  await failed.unmount()

  const terminal = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'terminal', ...step('Bash') })
  expect(await terminal.findAll({ type: 'Svg' })).toHaveLength(0)
  await terminal.unmount()
})

test('ajan satırı alt ajanın maskotunu ve rengini alır', async ($, on) => {
  mock.clock(on, { now: 5_000_000 })
  on('ui.render', { component: 'ToolUse' }, () => ({ type: 'engine', ref: 0 }))
  const ui = await $.ui.mount({
    plugin: 'ajan-panosu',
    surface: 'desktop',
    ...step('Agent', { input: { subagent_type: 'okuyucu', description: 'x', prompt: 'y' } }),
  })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('#6A9BCC')
  await ui.unmount()
})

const BAND = {
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 6,
    bodyColumns: 100,
    scroll: { top: 0, bodyRows: 5, rows: 1 },
    view: {},
  },
}

test('bant: ajan yokken çizilmez, çalışırken maskot + canlı yazı, bitince özet', async ($, on) => {
  mock.clock(on, { now: 5_000_000 })
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-b' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  const idle = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await idle.findAll({ type: 'Svg' })).toHaveLength(0)
  await idle.unmount()

  await $.agent.spawn({
    prompt: 'x',
    description: 'Bant denemesi',
    subagentType: 'denetleyici',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

  const busy = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(String((await busy.find({ type: 'Svg' }))?.props.source)).toContain('#4FB39A')
  await busy.post({ id: 'band:ajan-b' }, { in: 'live-band-ajan-b' })
  expect(JSON.stringify(await busy.drawn({ in: 'live-band-ajan-b' }))).toContain('Denetleyici')
  await busy.unmount()

  await $.turn.complete({
    agentId: 'ajan-b',
    answer: 'ok',
    durationMs: 1000,
    isAborted: false,
    turnId: 't-b',
    reason: 'answer',
  })

  const done = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await done.find({ text: /1 ajan bitti/ })).toBeDefined()
  await done.press({ key: 'dismiss' })
  await done.unmount()

  const gone = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await gone.findAll({ type: 'Svg' })).toHaveLength(0)
  await gone.unmount()
})

test('kart açılır: sekmeler (Prompt · Adımlar · Rapor), yerel düğmeler, "Prompt\'a al" ve "Kopyala"', async ($, on) => {
  const clock = mock.clock(on, { now: 6_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-r' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  const copied: string[] = []
  on('ui.copy', ($, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })

  await $.agent.spawn({
    prompt: 'Paneli incele.\nDüğmeleri say.',
    description: 'Rapor denemesi',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await $.turn.complete({
    agentId: 'ajan-r',
    answer: '## Sonuç\n**Panel** düğmelerle kurulur.\n\nİkinci satır.',
    durationMs: 1000,
    isAborted: false,
    turnId: 't-r',
    reason: 'answer',
  })

  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  // Kapalı kartta gövde bölgesi yok; düğmeler panelin kendisinde (yerel).
  expect(await ui.find({ text: /^Sonuç$/ })).toBeUndefined()
  await ui.press({ key: 'more-ajan-r' })
  // Açılınca rapor sekmesi: metnin tamamı, Markdown değil düz yazı.
  const report = { in: 'cardbody-ajan-r-report' }
  expect(await ui.find({ text: /^Sonuç$/, ...report })).toBeDefined()
  expect(await ui.find({ text: /^Panel düğmelerle kurulur\.$/, ...report })).toBeDefined()
  expect(await ui.find({ text: /^İkinci satır\.$/, ...report })).toBeDefined()
  expect(await ui.findAll({ type: 'Markdown', ...report })).toHaveLength(0)
  // Prompt sekmesi: ajana verilen metin kesilmeden.
  await ui.press({ key: 'tab-task-ajan-r' })
  const task = { in: 'cardbody-ajan-r-task' }
  expect(await ui.find({ text: /^Paneli incele\.$/, ...task })).toBeDefined()
  expect(await ui.find({ text: /^Düğmeleri say\.$/, ...task })).toBeDefined()
  expect(await ui.find({ text: /^Sonuç$/ })).toBeUndefined()
  await ui.press({ key: 'tab-report-ajan-r' })
  await ui.press({ key: 'prompt-ajan-r' })
  expect(filled[0]).toContain('Okuyucu sonucu (Rapor denemesi)')
  await ui.press({ key: 'copy-ajan-r' })
  expect(copied[0]).toContain('Panel')
  // Açık sekmeye yeniden basmak metnini kapatır, bir daha basmak açar.
  await ui.press({ key: 'tab-report-ajan-r' })
  expect(await ui.find({ text: /^Sonuç$/ })).toBeUndefined()
  // Basmadan sonra gelen basma her zaman yeni tıklama (hızlı tıklama yutulmaz).
  await ui.press({ key: 'tab-report-ajan-r' })
  expect(await ui.find({ text: /^Sonuç$/, ...report })).toBeDefined()
  await ui.press({ key: 'more-ajan-r' })
  expect(await ui.find({ text: /^Sonuç$/ })).toBeUndefined()
  await ui.unmount()
})

test('tur sonu özeti: panelde kalır, masaüstü bandında ✕ ya da yeni turla gizlenir', async ($, on) => {
  mock.clock(on, { now: 7_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', ($, e) =>
    String(e.tool) === 'Write' && (e as { file_path?: string }).file_path === '/p/kotu.ts'
      ? { ref: 0, result: 'yazılamadı', text: 'yazılamadı', isError: true }
      : { ref: 0, result: 'ok', text: 'ok' },
  )
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))

  await $.turn.start({ text: 'düzelt', turnId: 't-8' })
  const edit = (file: string) =>
    $.tool.call({ tool: 'Edit', file_path: file, old_string: 'a', new_string: 'b', replace_all: false })
  await edit('/p/a.ts')
  await edit('/p/a.ts')
  await $.tool.call({ tool: 'Write', file_path: '/p/b.ts', content: 'x' })
  await $.tool.call({ tool: 'Write', file_path: '/p/kotu.ts', content: 'x' })
  await $.turn.complete({
    answer: 'tamam',
    durationMs: 42_000,
    isAborted: false,
    turnId: 't-8',
    reason: 'answer',
  })

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await pane.find({ text: /^Son tur · 42sn · 4 araç · 2 dosya: a\.ts, b\.ts$/ })).toBeDefined()
  await pane.unmount()

  const terminalBand = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'terminal', ...BAND })
  expect(await terminalBand.find({ text: /Tur bitti/ })).toBeUndefined()
  await terminalBand.unmount()

  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await band.find({ text: /✓ Tur bitti/ })).toBeDefined()
  await band.press({ key: 'turn-dismiss' })
  await band.unmount()

  const hidden = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await hidden.find({ text: /Tur bitti/ })).toBeUndefined()
  await hidden.unmount()

  const still = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await still.find({ text: /^Son tur · 42sn/ })).toBeDefined()
  await still.unmount()
})

test('yeni tur başlayınca bandın tur özeti gizlenir', async ($, on) => {
  mock.clock(on, { now: 8_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))

  await $.turn.start({ text: 'bir', turnId: 't-9' })
  await $.turn.complete({ answer: '', durationMs: 3000, isAborted: true, turnId: 't-9', reason: 'aborted' })

  const shown = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await shown.find({ text: /■ Tur durduruldu/ })).toBeDefined()
  await shown.unmount()

  await $.turn.start({ text: 'iki', turnId: 't-10' })
  const gone = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await gone.find({ text: /Tur durduruldu/ })).toBeUndefined()
  await gone.unmount()
})

test('ses ve kutlama: varsayılan kapalı, /pano ses|kutlama açar, dalga bitince çalar ve konfeti', async ($, on) => {
  mock.clock(on, { now: 9_000_000 })
  mock.store(on)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-s' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  on('command.run', () => ({ text: '' }))
  const played: string[] = []
  on('audio.play', ($, e) => {
    played.push(String(e.clip.asset))
    return { value: undefined }
  })

  const spawn = () =>
    $.agent.spawn({
      prompt: 'x',
      description: 'Ses denemesi',
      subagentType: 'okuyucu',
      provider: { plugin: 'engine', tier: 'core' },
      parentModel: 'claude-opus-5-5',
      background: false,
      fork: false,
    })
  const finish = (reason: 'answer' | 'error') =>
    $.turn.complete({ agentId: 'ajan-s', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-s', reason })

  await spawn()
  await finish('answer')
  expect(played).toHaveLength(0)

  expect((await $.command.run({ command: 'pano', args: 'ses' })).text).toContain('Ses açık')
  expect(played).toEqual(['sounds/bitti.wav'])
  expect((await $.command.run({ command: 'pano', args: 'kutlama' })).text).toContain('Kutlama açık')

  await spawn()
  await finish('answer')
  expect(played).toEqual(['sounds/bitti.wav', 'sounds/bitti.wav'])
  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  const svgs = await band.findAll({ type: 'Svg' })
  expect(svgs.some(svg => String(svg.props.alt) === 'Kutlama')).toBe(true)
  await band.unmount()

  await spawn()
  await finish('error')
  expect(played[2]).toBe('sounds/hata.wav')
  const failed = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await failed.findAll({ type: 'Svg' })).toHaveLength(1)
  await failed.unmount()
})

test('bant: ajan bandı varken tur özeti gösterilmez, ✕ ikisini de kapatır', async ($, on) => {
  mock.clock(on, { now: 10_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-t' }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))

  await $.turn.start({ text: 'x', turnId: 't-11' })
  await $.agent.spawn({
    prompt: 'x',
    description: 'Tek satır',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't-11', reason: 'answer' })
  await $.turn.complete({ agentId: 'ajan-t', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-a', reason: 'answer' })

  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await band.find({ text: /1 ajan bitti/ })).toBeDefined()
  expect(await band.find({ text: /Tur bitti/ })).toBeUndefined()
  expect(await band.findAll({ type: 'Button', text: /✕/ })).toHaveLength(1)
  await band.press({ key: 'dismiss' })
  await band.unmount()

  const gone = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await gone.find({ text: /ajan bitti|Tur bitti/ })).toBeUndefined()
  await gone.unmount()
})

test('tur bitince panel Claude bölgesine güncel satırı verir (soru gelmese de)', async ($, on) => {
  mock.clock(on, { now: 11_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'x', turnId: 't-12' })
  const busy = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(JSON.stringify((await busy.find({ type: 'Client' }))?.props)).toContain('Düşünüyor')
  await busy.unmount()

  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-12', reason: 'answer' })
  const done = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(JSON.stringify((await done.find({ type: 'Client' }))?.props)).toContain('Bitti')
  await done.unmount()
})

test('alt ajan satırı: araç sürerken süre, bitince "düşünüyor", 60 sn üstünde uyarı rengi', async ($, on) => {
  const clock = mock.clock(on, { now: 12_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-z' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  // Araç 70 sn sürer: saat ilerledikçe cevap verir.
  on('tool.call', async () => {
    await clock.sleep(70_000)
    return { ref: 0, result: 'ok', text: 'ok' }
  })

  await $.agent.spawn({
    prompt: 'x',
    description: 'Süre denemesi',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  const inCard = { in: 'card-ajan-z' }
  const inBand = { in: 'live-band-ajan-z' }
  const ask = async () => {
    await pane.post({ card: 'ajan-z' }, inCard)
    await band.post({ id: 'band:ajan-z' }, inBand)
  }

  const running = $.tool.call({ tool: 'Bash', command: 'npm test', description: 'npm test', agentId: 'ajan-z' })
  await clock.advance(34_000)
  await ask()
  const toolRow = await pane.find({ type: 'Text', text: /^↳ Bash · npm test · 34sn$/, ...inCard })
  expect(toolRow).toBeDefined()
  expect(toolRow?.props.color).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^Okuyucu · Bash · npm test · 34sn$/, ...inBand })).toBeDefined()

  await clock.advance(30_000)
  await ask()
  expect((await pane.find({ type: 'Text', text: /^↳ Bash · npm test · 1dk 4sn$/, ...inCard }))?.props.color).toBe('warning')
  expect((await band.find({ type: 'Text', text: /^Okuyucu · Bash · npm test · 1dk 4sn$/, ...inBand }))?.props.color).toBe('warning')

  await clock.advance(6_000)
  await running
  await clock.advance(12_000)
  await ask()
  const thinkRow = await pane.find({ type: 'Text', text: /^↳ düşünüyor · 12sn$/, ...inCard })
  expect(thinkRow).toBeDefined()
  expect(thinkRow?.props.color).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^Okuyucu · düşünüyor · 12sn$/, ...inBand })).toBeDefined()

  await clock.advance(50_000)
  await ask()
  expect((await pane.find({ type: 'Text', text: /^↳ düşünüyor · 1dk 2sn$/, ...inCard }))?.props.color).toBe('warning')

  await $.turn.complete({
    agentId: 'ajan-z',
    answer: 'ok',
    durationMs: 1000,
    isAborted: false,
    turnId: 't-z',
    reason: 'answer',
  })
  await pane.unmount()
  await band.unmount()

  // Biten kartta son araç etiketi kalır, süre ve "düşünüyor" yok.
  const done = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await done.find({ text: /düşünüyor/, ...inCard })).toBeUndefined()
  await done.unmount()
})

const measure = (percent: number | undefined, tokens?: number) => ({
  context: { tokens, window: 1_000_000, percent },
  rateLimits: [],
  changed: ['context' as const],
})

test('sıkıştırma notu: boyutlarla görünür, bir sonraki tur bitince kaybolur', async ($, on) => {
  mock.clock(on, { now: 14_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const sizes: { tokensBefore?: number; tokensAfter?: number } = { tokensBefore: 180_000, tokensAfter: 40_000 }
  const summary = { role: 'user' as const, text: 'özet', toolUses: [] }
  on('session.compact', () => ({ messages: [summary], ...sizes }))
  const finish = (turnId: string) =>
    $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId, reason: 'answer' })

  await $.turn.start({ text: 'bir', turnId: 't-k1' })
  await finish('t-k1')
  await $.session.measure(measure(42, 415_000))
  await $.session.compact({ trigger: 'manual', messages: [summary] })

  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  const inMain = { in: 'live-main' }
  await ui.post({ id: 'main' }, inMain)
  expect(await ui.find({ type: 'Text', text: /^sıkıştırıldı 180k → 40k$/, ...inMain })).toBeDefined()
  // Eski doluluk sıkıştırmadan sonra geçersiz: yeni ölçüme kadar çubuk yok.
  expect(await ui.find({ type: 'Text', text: /▰|▱/, ...inMain })).toBeUndefined()

  await $.turn.start({ text: 'iki', turnId: 't-k2' })
  await ui.post({ id: 'main' }, inMain)
  expect(await ui.find({ type: 'Text', text: /sıkıştırıldı/, ...inMain })).toBeDefined()
  await finish('t-k2')
  await ui.post({ id: 'main' }, inMain)
  expect(await ui.find({ type: 'Text', text: /sıkıştırıldı/, ...inMain })).toBeUndefined()
  await ui.unmount()

  // Boyutlar bilinmiyorsa yalnız "bağlam sıkıştırıldı"; terminalde de görünür.
  delete sizes.tokensBefore
  delete sizes.tokensAfter
  await $.session.compact({ trigger: 'manual', messages: [summary] })
  const terminal = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'terminal', ...PANE })
  expect(await terminal.find({ type: 'Text', text: /^bağlam sıkıştırıldı$/ })).toBeDefined()
  await terminal.unmount()
})

test('arka plan ajanı: sohbetteki Ajan satırı ajan bitene kadar tik almaz; Claude yazısı arka planı söyler', async ($, on) => {
  mock.clock(on, { now: 12_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-bg' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', { component: 'ToolUse' }, () => ({ type: 'engine', ref: 0 }))

  await $.agent.spawn({
    tool_use_id: 'toolu_bg',
    prompt: 'x',
    description: 'Arka plan',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  const row = (isRunning: boolean) => ({
    component: 'ToolUse' as const,
    requestId: 'toolu_bg',
    props: {
      tool_use_id: 'toolu_bg',
      tool: 'Agent',
      input: { subagent_type: 'okuyucu', description: 'Arka plan', prompt: 'x' },
      isRunning,
      isErrored: false,
      isInterrupted: false,
    },
  })

  // Araç çağrısı bitti (isRunning false) ama ajan sürüyor: tik yok.
  const running = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...row(false) })
  expect(String((await running.find({ type: 'Svg' }))?.props.source)).not.toContain('#3FB950')
  await running.unmount()

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  await pane.post({ id: 'main' }, { in: 'live-main' })
  expect(JSON.stringify(await pane.drawn({ in: 'live-main' }))).toContain('Alt ajanı bekliyor · seni de dinliyor')
  await pane.unmount()

  await $.turn.complete({ agentId: 'ajan-bg', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-bg', reason: 'answer' })
  const done = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...row(false) })
  expect(String((await done.find({ type: 'Svg' }))?.props.source)).toContain('#3FB950')
  await done.unmount()
})

test('turunu bitirip sonra devam eden ajanın kartı yeniden "çalışıyor" olur', async ($, on) => {
  mock.clock(on, { now: 15_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-dv' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', () => ({ ref: 0, result: 'ok', text: 'ok' }))

  await $.agent.spawn({
    prompt: 'x',
    description: 'Devam eden',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  await $.turn.complete({ agentId: 'ajan-dv', answer: 'bekliyorum', durationMs: 1000, isAborted: false, turnId: 't-dv', reason: 'answer' })

  const done = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await done.find({ text: /bitti/, in: 'card-ajan-dv' })).toBeDefined()
  await done.unmount()

  await $.tool.call({ tool: 'Read', file_path: '/p/.gitignore', agentId: 'ajan-dv' } as never)
  const again = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await again.find({ text: /çalışıyor/, in: 'card-ajan-dv' })).toBeDefined()
  await again.unmount()
})

// Uygulama yeniden başlayınca pano bu sohbetin kaydından geri gelir (v0.9.12).
const START = { cwd: '/p', surface: 'desktop' as const, isInteractive: true }

const savedCard = (id: string, status: 'running' | 'done', extra: Record<string, unknown> = {}) => ({
  id,
  type: 'okuyucu',
  description: `Kayıtlı ${id}`,
  model: 'claude-sonnet-5-5',
  status,
  startedAt: 1000,
  endedAt: status === 'running' ? null : 2000,
  tools: 3,
  lastTool: 'Read · a.ts',
  tokens: null,
  isBackground: false,
  answer: status === 'done' ? 'rapor' : undefined,
  ...extra,
})

const SAVED_TURN = {
  reason: 'answer' as const,
  durationMs: 42_000,
  tools: 4,
  agents: 2,
  files: ['a.ts'],
  tokens: null,
  isHidden: false,
}

type On = Parameters<Parameters<typeof test>[1]>[1]

// Depo bellekte; test yazılanı doğrudan okur (testin `$`'ında depo yok).
const memStore = (on: On, entries: Record<string, unknown> = {}) => {
  const mem: Record<string, unknown> = { ...entries }
  on('store.get', ($, e) => ({ value: mem[e.key] }))
  on('store.set', ($, e) => {
    mem[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    delete mem[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(mem) }))
  return mem
}

const startMocks = (on: On, listed: unknown[] = []) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'pano' } }))
  on('ui.open', () => ({ value: {} }))
  on('agent.list', () => ({ value: listed }))
}

test('pano kaydı: kartlar ve son tur oturum kimliğiyle depoya yazılır', async ($, on) => {
  const clock = mock.clock(on, { now: 16_000_000 })
  const mem = memStore(on)
  on('session.id', () => ({ value: 'sohbet-1' }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-k' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'x', turnId: 't-k' })
  await $.agent.spawn({
    prompt: 'x',
    description: 'Kayıt denemesi',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await clock.settle()
  const running = mem['panolar'] as Record<string, { agents: { status: string }[] }>
  expect(running['sohbet-1']?.agents[0]?.status).toBe('running')

  await $.turn.complete({ agentId: 'ajan-k', answer: 'rapor', durationMs: 1000, isAborted: false, turnId: 't-a', reason: 'answer' })
  await $.turn.complete({ answer: 'ok', durationMs: 5000, isAborted: false, turnId: 't-k', reason: 'answer' })
  await clock.settle()
  const saved = mem['panolar'] as Record<string, { savedAt: number; agents: { status: string; answer?: string }[]; last: { durationMs: number } | null }>
  expect(saved['sohbet-1']?.agents[0]).toMatchObject({ status: 'done', answer: 'rapor' })
  expect(saved['sohbet-1']?.last?.durationMs).toBe(5000)
  expect(saved['sohbet-1']?.savedAt).toBe(16_000_000)
  // Ayarlar anahtarına dokunulmaz.
  expect(mem['ayarlar']).toBeUndefined()
})

test('yeniden açılış: aynı oturumun kartları geri gelir, çalışan "durduruldu" olur, son tur gizli', async ($, on) => {
  mock.clock(on, { now: 17_000_000 })
  memStore(on, {
    panolar: {
      'sohbet-1': {
        savedAt: 3000,
        agents: [savedCard('k-bitti', 'done'), savedCard('k-calisan', 'running')],
        last: SAVED_TURN,
      },
    },
  })
  on('session.id', () => ({ value: 'sohbet-1' }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  startMocks(on)

  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await pane.find({ text: /Kayıtlı k-bitti/, in: 'card-k-bitti' })).toBeDefined()
  expect(await pane.find({ text: /bitti/, in: 'card-k-bitti' })).toBeDefined()
  expect(await pane.find({ text: /durduruldu/, in: 'card-k-calisan' })).toBeDefined()
  expect(await pane.find({ text: /^Son tur · 42sn/ })).toBeDefined()
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await band.find({ text: /Tur bitti/ })).toBeUndefined()
  await band.unmount()
})

test('yeniden açılış: başka oturumun kartları alınmaz', async ($, on) => {
  mock.clock(on, { now: 18_000_000 })
  memStore(on, {
    panolar: { 'sohbet-1': { savedAt: 3000, agents: [savedCard('k-baska', 'done')], last: SAVED_TURN } },
  })
  on('session.id', () => ({ value: 'sohbet-2' }))
  startMocks(on)

  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await pane.find({ text: /Henüz alt ajan yok/ })).toBeDefined()
  expect(await pane.find({ text: /Son tur/ })).toBeUndefined()
  await pane.unmount()
})

test('pano kaydı: 10 oturumdan fazlasında en eski kayıt silinir', async ($, on) => {
  const clock = mock.clock(on, { now: 19_000_000 })
  const boards = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`eski-${i}`, { savedAt: 1000 + i, agents: [savedCard(`k-${i}`, 'done')], last: null }]),
  )
  const mem = memStore(on, { panolar: boards, ayarlar: { sound: true, party: false } })
  on('session.id', () => ({ value: 'yeni' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'x', turnId: 't-y' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-y', reason: 'answer' })
  await clock.settle()

  const saved = mem['panolar'] as Record<string, unknown>
  expect(Object.keys(saved)).toHaveLength(10)
  expect(saved['yeni']).toBeDefined()
  expect(saved['eski-0']).toBeUndefined()
  expect(saved['eski-1']).toBeDefined()
  expect(mem['ayarlar']).toEqual({ sound: true, party: false })
})

test('/clear: pano boşalır, eski oturumun kaydı depoda kalır', async ($, on) => {
  const clock = mock.clock(on, { now: 20_000_000 })
  const mem = memStore(on)
  on('session.id', () => ({ value: 'sohbet-c' }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-c' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))

  await $.turn.start({ text: 'x', turnId: 't-c' })
  await $.agent.spawn({
    prompt: 'x',
    description: 'Temizlenecek',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await $.turn.complete({ agentId: 'ajan-c', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-a', reason: 'answer' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-c', reason: 'answer' })
  await $.session.end({ reason: 'clear', sessionId: 'sohbet-c', resume: { id: 'sohbet-c' } })
  await clock.settle()

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await pane.find({ text: /Henüz alt ajan yok/ })).toBeDefined()
  expect(await pane.find({ text: /Son tur/ })).toBeUndefined()
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...BAND })
  expect(await band.findAll({ type: 'Svg' })).toHaveLength(0)
  expect(await band.find({ text: /ajan bitti|Tur bitti/ })).toBeUndefined()
  await band.unmount()

  const saved = mem['panolar'] as Record<string, { agents: unknown[] }>
  expect(saved['sohbet-c']?.agents).toHaveLength(1)
})

test('yeniden açılış: hâlâ çalışan ajanın "durduruldu" kartı yeniden "çalışıyor" olur', async ($, on) => {
  mock.clock(on, { now: 21_000_000 })
  memStore(on, {
    panolar: {
      'sohbet-1': { savedAt: 3000, agents: [savedCard('k-yasayan', 'running'), savedCard('k-olen', 'running')], last: null },
    },
  })
  on('session.id', () => ({ value: 'sohbet-1' }))
  startMocks(on, [{ id: 'k-yasayan', type: 'okuyucu', description: 'Kayıtlı k-yasayan', status: 'running' }])

  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  expect(await pane.find({ text: /çalışıyor/, in: 'card-k-yasayan' })).toBeDefined()
  expect(await pane.find({ text: /durduruldu/, in: 'card-k-olen' })).toBeDefined()
  // Devralınan ajan ikinci kart olarak eklenmez.
  const regions = await pane.findAll({ type: 'Client' })
  expect(regions.filter(one => String(one.props.module).includes('card.tsx'))).toHaveLength(2)
  await pane.unmount()
})

test('bekleyiş pozu: tur bitmişken arka plan ajanı sürüyorsa uyanık bakış, ajan bitince normal poz', async ($, on) => {
  mock.clock(on, { now: 16_000_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ajan-w' }))
  // Bekleyişin işareti: aşağı-yana bakan açık gözler (simge yok).
  const hourglass = 'y="14.6" width="1.4"'
  const mainSvg = async () => {
    const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
    const source = String((await ui.find({ type: 'Svg', alt: 'Claude' } as never))?.props.source)
    await ui.unmount()
    return source
  }

  await $.turn.start({ text: 'x', turnId: 't-w' })
  await $.agent.spawn({
    prompt: 'x',
    description: 'Bekletilen',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't-w', reason: 'answer' })
  expect(await mainSvg()).toContain(hourglass)

  await $.turn.complete({ agentId: 'ajan-w', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't-wa', reason: 'answer' })
  expect(await mainSvg()).not.toContain(hourglass)
})

test('yeniden çizimde maskot animasyonu saate göre sürer, baştan başlamaz', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const first = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  const before = String((await first.find({ type: 'Svg' }))?.props.source)
  await first.unmount()
  await clock.advance(2_500)
  const again = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  const after = String((await again.find({ type: 'Svg' }))?.props.source)
  await again.unmount()
  // 1000 sn → saatin 1000. saniyesi; her animasyon o kadar önce başlamış sayılır.
  expect(before).toContain('begin="-1000s"')
  expect(after).toContain('begin="-1002.5s"')
  expect(after).not.toMatch(/<animate(Transform)?\b(?![^>]*\bbegin=)[^>]*>/)
})

test('durdur: çalışan kartta düğme var, basınca TaskStop ajan kimliğiyle çağrılır', async ($, on) => {
  mock.clock(on, { now: 30_000_000 })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'dur-1' }))
  const stopped: unknown[] = []
  on('tool.call', { tool: 'TaskStop' }, ($, e) => {
    stopped.push(e.task_id)
    return { result: { message: 'stopped', task_id: e.task_id } }
  })

  await $.agent.spawn({
    prompt: 'Uzun iş',
    description: 'Durdurulacak',
    subagentType: 'okuyucu',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })

  const ui = await $.ui.mount({ plugin: 'ajan-panosu', surface: 'desktop', ...PANE })
  await ui.press({ key: 'stop-dur-1' })
  expect(stopped).toEqual(['dur-1'])
  await ui.unmount()
})
