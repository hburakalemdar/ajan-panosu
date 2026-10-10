// Piksel maskotlar: her ajan tipi için renk + aksesuar, her durum için poz.
// Çıktı tek bir <svg> dizesi; animasyonlar SMIL (isInteractive Svg içinde oynar).

// 'wait': Claude'un turu bitti ama arka planda alt ajan çalışıyor; o bitince Claude devam eder.
export type Pose = 'run' | 'done' | 'error' | 'aborted' | 'idle' | 'think' | 'tool' | 'wait'

export type ToolKind = 'shell' | 'edit' | 'read' | 'web' | 'agent' | 'other'

export type Gear =
  | 'none'
  | 'glasses'
  | 'quill'
  | 'magnifier'
  | 'antenna'
  | 'headlamp'
  | 'compass'
  | 'flashlight'
  | 'blueprint'
  | 'whiteboard'
  | 'setsquare'
  | 'spark'
  | 'map'
  | 'hardhat'

export type Look = { label: string; color: string; shade: string; gear: Gear }

const LOOKS: Record<string, Look> = {
  main: { label: 'Claude', color: '#D97757', shade: '#B4593B', gear: 'none' },
  okuyucu: { label: 'Okuyucu', color: '#6A9BCC', shade: '#4A78A8', gear: 'glasses' },
  sentezci: { label: 'Sentezci', color: '#A88BD8', shade: '#7E63B2', gear: 'quill' },
  denetleyici: { label: 'Denetleyici', color: '#4FB39A', shade: '#338876', gear: 'magnifier' },
  'web-researcher': {
    label: 'Web araştırmacısı',
    color: '#E0A93B',
    shade: '#B5842A',
    gear: 'antenna',
  },
  explore: { label: 'Kâşif', color: '#7FB069', shade: '#5B8A49', gear: 'headlamp' },
  plan: { label: 'Planlayıcı', color: '#D98BB5', shade: '#B16890', gear: 'whiteboard' },
  // Turuncu aileden (Claude, web araştırmacısı) ayrılsın diye camgöbeği; baret + İngiliz anahtarı.
  'general-purpose': {
    label: 'Genel amaçlı',
    color: '#3EB2C9',
    shade: '#2A8A9E',
    gear: 'hardhat',
  },
  claude: { label: 'Claude', color: '#E8A87C', shade: '#C2805A', gear: 'spark' },
  fork: { label: 'Çatal', color: '#D97757', shade: '#B4593B', gear: 'spark' },
  'claude-code-guide': { label: 'Rehber', color: '#8FA8C8', shade: '#6B84A5', gear: 'map' },
}

const FALLBACK: Look = { label: '', color: '#9AA5B1', shade: '#76818D', gear: 'none' }

export function lookFor(type: string): Look {
  const bare = type.includes(':') ? type.slice(type.lastIndexOf(':') + 1) : type
  const found = LOOKS[bare.toLowerCase()]

  return found ?? { ...FALLBACK, label: bare }
}

const INK = '#2B1B14'
const PAPER = '#F4F1EA'
const LOOP = 'repeatCount="indefinite"'
// Bekleyişin bakış döngüsü: sağa (kartlara) bakıp eğilir, sonra öne (sana) döner.
const WAIT_DUR = '5s'
const WAIT_TIMES = '0;0.45;0.52;0.9;1'

// Uykunun döngüsü: ~10 sn uyur, kısa bir sıçrayışla uyanır, önce sola sonra sağa
// bakar, gözlerini kapatıp yeniden uyur. Uyanıkken "z"ler söner.
const IDLE_DUR = '16s'
const IDLE_AWAKE = { values: '0;0;1;1;0;0', keyTimes: '0;0.62;0.63;0.92;0.93;1' }
const IDLE_LOOK_TIMES = '0;0.67;0.69;0.75;0.77;0.84;0.86;1'

const isMoving = (pose: Pose) => pose === 'run' || pose === 'think' || pose === 'tool'

function body(look: Look, pose: Pose): string {
  const { color, shade } = look
  const legs = [10, 13, 17, 20]
    .map((x, i) => {
      // Bekleyişte en sağdaki ayak sabırsızca yere vurur: tık-tık, kısa duraklama.
      const tap =
        pose === 'wait' && i === 3
          ? `<animate attributeName="height" values="3;1.4;3;1.4;3;3" keyTimes="0;0.08;0.16;0.24;0.32;1" dur="1.8s" ${LOOP}/>`
          : ''
      const step = isMoving(pose)
        ? `<animate attributeName="height" values="3;1.6;3" dur="0.45s" begin="${
            i % 2 === 0 ? 0 : 0.22
          }s" ${LOOP}/>`
        : tap

      return `<rect x="${x}" y="20" width="2" height="3" fill="${shade}">${step}</rect>`
    })
    .join('')
  const wave = isMoving(pose)
    ? `<animate attributeName="y" values="14;13;14" dur="0.9s" ${LOOP}/>`
    : ''

  return (
    legs +
    `<rect x="9" y="12" width="14" height="8" rx="0.6" fill="${color}"/>` +
    `<rect x="9" y="12" width="14" height="1.2" fill="#fff" fill-opacity="0.18"/>` +
    `<rect x="7" y="14" width="2" height="3" fill="${color}">${wave}</rect>` +
    `<rect x="23" y="14" width="2" height="3" fill="${color}"/>`
  )
}

function eyes(pose: Pose): string {
  if (pose === 'done') {
    return `<path d="M12 16 L13 14.6 L14 16 M18 16 L19 14.6 L20 16" stroke="${INK}" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  }

  if (pose === 'error') {
    return `<path d="M12 14 l2 2 M14 14 l-2 2 M18 14 l2 2 M20 14 l-2 2" stroke="${INK}" stroke-width="0.8" stroke-linecap="round"/>`
  }

  if (pose === 'idle') {
    const closed = (x: number) =>
      `<rect x="${x}" y="15.3" width="2" height="0.7" fill="${INK}">` +
      `<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="${IDLE_AWAKE.keyTimes}" dur="${IDLE_DUR}" ${LOOP}/>` +
      `</rect>`
    // Uyanınca gözler aralanır (yükseklik açılır), sola, sağa bakar, ortaya döner.
    const open = (x: number) =>
      `<rect x="${x + 0.3}" y="15.25" width="1.4" height="0.3" fill="${INK}" opacity="0">` +
      `<animate attributeName="opacity" values="${IDLE_AWAKE.values}" keyTimes="${IDLE_AWAKE.keyTimes}" dur="${IDLE_DUR}" ${LOOP}/>` +
      `<animate attributeName="height" values="0.3;0.3;1.6;1.6;0.3;0.3" keyTimes="0;0.62;0.645;0.9;0.93;1" dur="${IDLE_DUR}" ${LOOP}/>` +
      `<animate attributeName="y" values="15.25;15.25;14.6;14.6;15.25;15.25" keyTimes="0;0.62;0.645;0.9;0.93;1" dur="${IDLE_DUR}" ${LOOP}/>` +
      `<animate attributeName="x" values="${[0.3, 0.3, -0.3, -0.3, 0.9, 0.9, 0.3, 0.3].map(d => x + d).join(';')}" keyTimes="${IDLE_LOOK_TIMES}" dur="${IDLE_DUR}" ${LOOP}/>` +
      `</rect>`

    return closed(12) + closed(18) + open(12) + open(18)
  }

  if (pose === 'aborted') {
    return `<rect x="12" y="15.3" width="2" height="0.7" fill="${INK}"/><rect x="18" y="15.3" width="2" height="0.7" fill="${INK}"/>`
  }

  // Bekleyiş: gözler açık; arada sağa (ajan kartlarına) bakıp öne (sana) döner,
  // ara sıra kırpar. Hem "ajanı izliyorum" hem "seni dinliyorum".
  if (pose === 'wait') {
    const look = (x: number) =>
      `<rect x="${x + 0.9}" y="14.6" width="1.4" height="1.6" fill="${INK}">` +
      `<animate attributeName="x" values="${x + 0.9};${x + 0.9};${x};${x};${x + 0.9}" keyTimes="${WAIT_TIMES}" dur="${WAIT_DUR}" ${LOOP}/>` +
      `<animate attributeName="height" values="1.6;1.6;0.3;1.6" keyTimes="0;0.94;0.97;1" dur="4.2s" ${LOOP}/>` +
      `</rect>`

    return look(12) + look(18)
  }

  const blink = (x: number) =>
    `<rect x="${x}" y="14" width="2" height="2" fill="${INK}">` +
    `<animate attributeName="height" values="2;2;0.3;2" keyTimes="0;0.92;0.96;1" dur="3.4s" ${LOOP}/>` +
    `<animate attributeName="y" values="14;14;14.85;14" keyTimes="0;0.92;0.96;1" dur="3.4s" ${LOOP}/>` +
    `</rect>`

  return blink(12) + blink(18)
}

function star(cx: number, cy: number, r: number, fill: string): string {
  const k = r * 0.28

  return `<path d="M${cx} ${cy - r} L${cx + k} ${cy - k} L${cx + r} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + r} L${cx - k} ${cy + k} L${cx - r} ${cy} L${cx - k} ${cy - k} Z" fill="${fill}"/>`
}

function spin(cx: number, cy: number, dur: string): string {
  return `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}" ${LOOP}/>`
}

function gear(look: Look, pose: Pose): string {
  const moving = isMoving(pose)

  switch (look.gear) {
    case 'glasses': {
      const flip = moving
        ? `<rect x="16.2" y="18.6" width="4.2" height="3.8" fill="${PAPER}"><animate attributeName="width" values="4.2;0;4.2" dur="1.6s" ${LOOP}/></rect>`
        : `<rect x="16.2" y="18.6" width="4.2" height="3.8" fill="${PAPER}"/>`

      return (
        `<g stroke="${INK}" stroke-width="0.6" fill="#fff" fill-opacity="0.3"><circle cx="13" cy="15" r="2.1"/><circle cx="19" cy="15" r="2.1"/></g>` +
        `<path d="M15.1 15 h1.8" stroke="${INK}" stroke-width="0.6"/>` +
        `<rect x="11" y="18" width="10" height="5" rx="0.5" fill="#3D5A80"/>` +
        `<rect x="11.6" y="18.6" width="4.2" height="3.8" fill="${PAPER}"/>` +
        flip +
        `<rect x="15.9" y="18.3" width="0.4" height="4.4" fill="#2A4060"/>`
      )
    }

    case 'quill': {
      const ink = [20, 21.6, 23.2]
        .map((y, i) =>
          moving
            ? `<rect x="25" y="${y}" width="0" height="0.5" fill="#8A8A8A"><animate attributeName="width" values="0;4;4;0" keyTimes="0;0.4;0.9;1" dur="2.4s" begin="${i * 0.5}s" ${LOOP}/></rect>`
            : `<rect x="25" y="${y}" width="4" height="0.5" fill="#8A8A8A"/>`,
        )
        .join('')
      const swing = moving
        ? `<animateTransform attributeName="transform" type="rotate" values="0 25 18;-14 25 18;0 25 18" dur="0.7s" ${LOOP}/>`
        : ''

      return (
        `<rect x="24" y="18.5" width="6" height="6.5" rx="0.4" fill="${PAPER}"/>` +
        ink +
        `<g>${swing}<path d="M25 18 L29.5 8 Q31 12 27.5 15.5 Z" fill="#fff" stroke="#9A9A9A" stroke-width="0.3"/>` +
        `<line x1="25" y1="18" x2="28.6" y2="10.5" stroke="#6B6B6B" stroke-width="0.35"/></g>`
      )
    }

    case 'magnifier': {
      const sweep = moving
        ? `<animateTransform attributeName="transform" type="translate" values="0 0;-4 1;-8 0;-4 1;0 0" dur="2.6s" ${LOOP}/>`
        : ''

      return (
        `<g>${sweep}<circle cx="26" cy="11" r="3" fill="#BFE3F2" fill-opacity="0.45" stroke="${INK}" stroke-width="0.8"/>` +
        `<path d="M24.6 9.6 q0.8 -0.8 1.8 -0.6" stroke="#fff" stroke-width="0.5" fill="none"/>` +
        `<line x1="24" y1="13.3" x2="22.6" y2="15.2" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/></g>`
      )
    }

    case 'antenna': {
      const waves = moving
        ? [0, 0.35, 0.7]
            .map(
              (b, i) =>
                `<path d="M${12.6 - i * 1.4} ${2.6 - i * 0.6} q-1.4 2.4 0 4.8 M${19.4 + i * 1.4} ${2.6 - i * 0.6} q1.4 2.4 0 4.8" stroke="${look.color}" stroke-width="0.5" fill="none" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1.2s" begin="${b}s" ${LOOP}/></path>`,
            )
            .join('')
        : ''

      return (
        `<line x1="16" y1="12" x2="16" y2="6.6" stroke="${INK}" stroke-width="0.6"/>` +
        `<g>${moving ? spin(16, 5, '4s') : ''}<circle cx="16" cy="5" r="1.7" fill="#4A90C2" stroke="${INK}" stroke-width="0.35"/>` +
        `<path d="M14.3 5 h3.4 M16 3.3 q-1 1.7 0 3.4 q1 -1.7 0 -3.4" stroke="#BFE3F2" stroke-width="0.3" fill="none"/></g>` +
        waves
      )
    }

    // Kâşif varyantları: A kafa lambası (seçili), B pusula, C el feneri; diğerleri tema için.
    case 'headlamp': {
      const beam = moving
        ? `<g><animateTransform attributeName="transform" type="rotate" values="-10 21 12.4;10 21 12.4;-10 21 12.4" dur="3s" ${LOOP}/>` +
          `<polygon points="21,11.6 31.5,7 31.5,18 21,13.2" fill="#FFF3B0" opacity="0.3"><animate attributeName="opacity" values="0.12;0.45;0.12" dur="1.5s" ${LOOP}/></polygon></g>`
        : ''

      return (
        beam +
        `<rect x="9" y="12.3" width="14" height="1.3" fill="#2F3B2A"/>` +
        `<rect x="17.4" y="10.9" width="3.8" height="3" rx="0.8" fill="#D9D9D9" stroke="#6B6B6B" stroke-width="0.3"/>` +
        `<circle cx="19.3" cy="12.4" r="0.95" fill="#FFF3B0"/>`
      )
    }

    case 'compass': {
      const swing = moving
        ? `<animateTransform attributeName="transform" type="rotate" values="0 4.6 19;55 4.6 19;-25 4.6 19;80 4.6 19;10 4.6 19;0 4.6 19" dur="3.2s" ${LOOP}/>`
        : ''

      return (
        `<circle cx="4.6" cy="19" r="3.4" fill="#C9A227"/>` +
        `<circle cx="4.6" cy="19" r="2.7" fill="#F4F1EA"/>` +
        `<rect x="4.35" y="16.4" width="0.5" height="0.6" fill="#8A8A8A"/>` +
        `<g>${swing}<polygon points="4.6,16.7 5.2,19 4.0,19" fill="#E5534B"/><polygon points="4.6,21.3 5.2,19 4.0,19" fill="#8A8A8A"/></g>` +
        `<circle cx="4.6" cy="19" r="0.35" fill="${INK}"/>`
      )
    }

    case 'flashlight': {
      const beam = moving
        ? `<g><animateTransform attributeName="transform" type="rotate" values="-12 28.6 15.5;12 28.6 15.5;-12 28.6 15.5" dur="2.4s" ${LOOP}/>` +
          `<polygon points="28.6,14.1 33,10 33,21 28.6,16.9" fill="#FFF3B0" opacity="0.35"><animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.2s" ${LOOP}/></polygon></g>`
        : ''

      return (
        beam +
        `<rect x="23.2" y="14.7" width="4" height="1.7" rx="0.3" fill="#3C3C3C"/>` +
        `<rect x="27" y="14" width="1.6" height="3.1" rx="0.3" fill="#9A9A9A"/>` +
        `<rect x="28.4" y="14.3" width="0.4" height="2.5" fill="#FFF3B0"/>`
      )
    }

    // Planlayıcı varyantları: A mavi plan + kulakta kalem, B beyaz tahta (seçili), C gönye.
    case 'blueprint': {
      const lines = [18.6, 19.8, 21]
        .map((y, i) =>
          moving
            ? `<rect x="2.6" y="${y}" width="0" height="0.3" fill="#fff"><animate attributeName="width" values="0;4.8;4.8;0" keyTimes="0;0.4;0.9;1" dur="2.2s" begin="${i * 0.4}s" ${LOOP}/></rect>`
            : `<rect x="2.6" y="${y}" width="4.8" height="0.3" fill="#fff"/>`,
        )
        .join('')

      return (
        `<g transform="rotate(-28 20 11)"><rect x="16.6" y="10.5" width="6" height="1.3" fill="#F2C744"/>` +
        `<polygon points="22.6,10.5 24.2,11.15 22.6,11.8" fill="#E8C9A0"/><polygon points="23.6,10.9 24.2,11.15 23.6,11.4" fill="${INK}"/>` +
        `<rect x="16" y="10.5" width="0.8" height="1.3" fill="#E07A7A"/></g>` +
        `<rect x="2" y="17.6" width="6" height="4.6" rx="0.3" fill="#3A6EA5"/>` +
        `<rect x="2" y="17.6" width="6" height="4.6" rx="0.3" fill="none" stroke="#9CC3EA" stroke-width="0.2" stroke-dasharray="0.4 0.4"/>` +
        lines
      )
    }

    case 'whiteboard': {
      const parts = [
        `<rect x="1.4" y="11.6" width="2.2" height="1.6" fill="none" stroke="#4A90C2" stroke-width="0.35"/>`,
        `<path d="M3.6 12.4 h1.4 l-0.4 -0.35 M5 12.4 l-0.4 0.35" stroke="#8A8A8A" stroke-width="0.3" fill="none"/>`,
        `<rect x="5.2" y="11.6" width="2.2" height="1.6" fill="none" stroke="#E5534B" stroke-width="0.35"/>`,
        `<path d="M6.3 13.2 v1.4" stroke="#8A8A8A" stroke-width="0.3"/>`,
        `<rect x="5.2" y="14.6" width="2.2" height="1.6" fill="none" stroke="#3FB950" stroke-width="0.35"/>`,
      ]
        .map((part, i) =>
          moving
            ? `<g opacity="0">${part}<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.9;1" dur="3.5s" begin="${i * 0.45}s" ${LOOP}/></g>`
            : part,
        )
        .join('')

      return (
        `<line x1="2" y1="17.6" x2="1" y2="22.6" stroke="#8A6A4A" stroke-width="0.5"/><line x1="7" y1="17.6" x2="8" y2="22.6" stroke="#8A6A4A" stroke-width="0.5"/>` +
        `<rect x="0.6" y="10.6" width="7.8" height="7" rx="0.3" fill="#F4F1EA" stroke="#8A8A8A" stroke-width="0.3"/>` +
        parts
      )
    }

    case 'setsquare': {
      const draw = moving
        ? `<line x1="1.8" y1="22" x2="1.8" y2="22" stroke="#3A6EA5" stroke-width="0.4"><animate attributeName="x2" values="1.8;7.6;7.6" keyTimes="0;0.7;1" dur="2s" ${LOOP}/><animate attributeName="y2" values="22;14.6;14.6" keyTimes="0;0.7;1" dur="2s" ${LOOP}/></line>`
        : `<line x1="1.8" y1="22" x2="7.6" y2="14.6" stroke="#3A6EA5" stroke-width="0.4"/>`

      return (
        `<polygon points="1.2,22.8 1.2,13.4 8.6,22.8" fill="#9AD0C2" fill-opacity="0.75" stroke="#4E9C8A" stroke-width="0.3"/>` +
        `<polygon points="2.8,20.8 2.8,17.6 5.3,20.8" fill="#1a1a1a" fill-opacity="0.25"/>` +
        draw +
        `<g transform="rotate(-28 20 11)"><rect x="16.6" y="10.5" width="6" height="1.3" fill="#F2C744"/>` +
        `<polygon points="22.6,10.5 24.2,11.15 22.6,11.8" fill="#E8C9A0"/></g>`
      )
    }

    case 'spark':
      return `<g>${moving ? spin(16, 9, '3s') : ''}${star(16, 9, 2.2, '#F7D2BE')}</g>`

    case 'map':
      return (
        `<path d="M2 17.5 l2 -0.8 l2 0.8 l2 -0.8 v5 l-2 0.8 l-2 -0.8 l-2 0.8 Z" fill="#E9DFC4" stroke="#B7A57A" stroke-width="0.3"/>` +
        `<path d="M3 20 q1.5 -2 3 0 t1.5 -1" stroke="#C0504D" stroke-width="0.4" fill="none" stroke-dasharray="0.6 0.4"/>`
      )

    // Genel amaçlı: her işi yapan usta — baret ve elde İngiliz anahtarı; çalışırken
    // anahtar cıvata sıkar gibi döner.
    case 'hardhat': {
      const turn = moving
        ? `<animateTransform attributeName="transform" type="rotate" values="0 24.6 16.4;-35 24.6 16.4;0 24.6 16.4" dur="0.9s" ${LOOP}/>`
        : ''

      return (
        `<g>${turn}<line x1="24.6" y1="16.4" x2="28.4" y2="12.6" stroke="#A7B0BA" stroke-width="1.1" stroke-linecap="round"/>` +
        `<path d="M27.4 12.2 L28.6 11 L29.4 11.8 L29 12.2 L29.8 13 L30.2 12.6 L31 13.4 L29.8 14.6 Z" fill="#A7B0BA" transform="rotate(-90 28.8 12.6)"/></g>` +
        // Geniş kubbe başın üstünü sarar; kavisli siper ve altındaki gölge onu başa oturtur.
        `<path d="M9.6 13 Q16 15 22.4 13 L22.4 13.9 Q16 15.9 9.6 13.9 Z" fill="${look.shade}" opacity="0.55"/>` +
        `<path d="M9.8 12.9 A6.2 5.2 0 0 1 22.2 12.9 Q16 14.4 9.8 12.9 Z" fill="#F2C744" stroke="#C9971F" stroke-width="0.35"/>` +
        `<path d="M15.1 7.8 Q16 7.6 16.9 7.8 L16.9 13.7 Q16 13.75 15.1 13.7 Z" fill="#FFE38A" opacity="0.7"/>` +
        `<path d="M11.6 11 Q12.2 9.4 13.6 8.6" stroke="#fff" stroke-width="0.5" fill="none" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M8.8 12.6 Q16 14.1 23.2 12.6 Q23.6 12.7 23.4 13.1 Q16 15.3 8.6 13.1 Q8.4 12.7 8.8 12.6 Z" fill="#C9971F"/>`
      )
    }

    case 'none':
      return ''
  }
}

// Sol elde çizilmiş eşyalar aynalanıp sağ ele geçer; sol üst rozete yer kalır.
const LEFT_DRAWN: ReadonlySet<Gear> = new Set(['whiteboard', 'map', 'compass'])

function heldGear(look: Look, pose: Pose): string {
  const drawn = gear(look, pose)

  return LEFT_DRAWN.has(look.gear) ? `<g transform="translate(32 0) scale(-1 1)">${drawn}</g>` : drawn
}

function toolIcon(kind: ToolKind, moving = true): string {
  const bob = moving
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.8;0 0" dur="1s" ${LOOP}/>`
    : ''
  let icon: string

  switch (kind) {
    case 'shell':
      icon =
        `<rect x="11.5" y="2" width="9" height="6.4" rx="0.8" fill="#1E1E1E" stroke="#6E6E6E" stroke-width="0.5"/>` +
        `<path d="M13 4 l1.4 1.2 L13 6.4" stroke="#7EE787" stroke-width="0.6" fill="none"/>` +
        `<rect x="15.2" y="5.9" width="2.6" height="0.6" fill="#7EE787">${moving ? `<animate attributeName="opacity" values="1;0;1" dur="0.9s" ${LOOP}/>` : ''}</rect>`
      break
    case 'edit':
      icon =
        `<rect x="12" y="2" width="6.5" height="7" rx="0.4" fill="${PAPER}"/>` +
        `<rect x="13" y="3.6" width="4" height="0.5" fill="#9A9A9A"/><rect x="13" y="5.2" width="3" height="0.5" fill="#9A9A9A"/>` +
        `<path d="M17 8.6 l4 -5 l1 0.8 l-4 5 l-1.4 0.5 Z" fill="#F2C744" stroke="${INK}" stroke-width="0.3"/>`
      break
    case 'read':
      icon =
        `<rect x="12.5" y="1.8" width="7" height="7.4" rx="0.4" fill="${PAPER}"/>` +
        `<rect x="13.6" y="3.4" width="4.8" height="0.5" fill="#9A9A9A"/><rect x="13.6" y="5" width="4.8" height="0.5" fill="#9A9A9A"/><rect x="13.6" y="6.6" width="3" height="0.5" fill="#9A9A9A"/>`
      break
    case 'web':
      icon =
        `<circle cx="16" cy="5.2" r="3.2" fill="#4A90C2"/>` +
        `<path d="M12.8 5.2 h6.4 M16 2 q-2 3.2 0 6.4 q2 -3.2 0 -6.4" stroke="#BFE3F2" stroke-width="0.4" fill="none"/>`
      break
    case 'agent':
      icon =
        `<rect x="11" y="3" width="4.4" height="3" fill="#E8A87C"/><rect x="11.8" y="4" width="0.8" height="0.8" fill="${INK}"/><rect x="13.8" y="4" width="0.8" height="0.8" fill="${INK}"/>` +
        `<rect x="16.6" y="3" width="4.4" height="3" fill="#6A9BCC"/><rect x="17.4" y="4" width="0.8" height="0.8" fill="${INK}"/><rect x="19.4" y="4" width="0.8" height="0.8" fill="${INK}"/>`
      break
    case 'other':
      icon = `<g>${moving ? spin(16, 5, '2.4s') : ''}${star(16, 5, 3, '#F7D2BE')}</g>`
      break
  }

  return `<g>${bob}${icon}</g>`
}

function above(pose: Pose, kind: ToolKind): string {
  if (pose === 'think') {
    return (
      `<g>${spin(16, 5, '3.2s')}${star(16, 5, 3.2, '#F0B49A')}</g>` +
      `<circle cx="21.5" cy="7.5" r="0.7" fill="#F0B49A"><animate attributeName="opacity" values="0;1;0" dur="1.2s" ${LOOP}/></circle>` +
      `<circle cx="10.5" cy="3" r="0.5" fill="#F0B49A"><animate attributeName="opacity" values="0;1;0" dur="1.2s" begin="0.6s" ${LOOP}/></circle>`
    )
  }

  if (pose === 'tool') {
    return toolIcon(kind)
  }

  // Bekleyişte başın üstünde simge yok (kum saati + balon kalabalıktı, Burak):
  // anlamı açık, kartlara bakan gözler ve "Alt ajanı bekliyor · seni de dinliyor" taşır.
  if (pose === 'idle') {
    const zs = [0, 0.8]
      .map(
        b =>
          `<text x="23" y="11" font-family="monospace" font-size="4" font-weight="bold" fill="#9AA5B1" opacity="0">z<animate attributeName="y" values="11;3" dur="2.4s" begin="${b}s" ${LOOP}/><animate attributeName="x" values="23;27" dur="2.4s" begin="${b}s" ${LOOP}/><animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${b}s" ${LOOP}/></text>`,
      )
      .join('')

    return `<g><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.6;0.62;0.94;1" dur="${IDLE_DUR}" ${LOOP}/>${zs}</g>`
  }

  return ''
}

// Durum rozeti başın sağ üst köşesinde, gövdeye hafifçe biner (eskiden tuvalin
// köşesindeydi, maskottan kopuk görünüyordu). Koyu kenar gövdeden ayırır; satır
// düzeninin (viewBox y 9.5'ten) içinde kalır.
// Rozet her ajanda sol üstte; eşyalar sağ elde ya da başta, böylece çakışmaz.
const BADGE = { x: 7.8, y: 12.4, r: 2.8 }
const BADGE_RING = `stroke="#1B1B1B" stroke-width="0.7"`

function badge(pose: Pose): string {
  const { x, y, r } = BADGE

  if (pose === 'done') {
    return (
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#3FB950" ${BADGE_RING}/>` +
      `<path d="M${x - 1.3} ${y + 0.1} l0.95 0.95 l1.8 -1.95" stroke="#fff" stroke-width="0.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }

  if (pose === 'error') {
    return (
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#F85149" ${BADGE_RING}/>` +
      `<rect x="${x - 0.4}" y="${y - 1.7}" width="0.8" height="2.2" rx="0.3" fill="#fff"/>` +
      `<circle cx="${x}" cy="${y + 1.4}" r="0.5" fill="#fff"/>`
    )
  }

  if (pose === 'aborted') {
    return (
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#8B949E" ${BADGE_RING}/>` +
      `<rect x="${x - 1.2}" y="${y - 1.2}" width="2.4" height="2.4" rx="0.3" fill="#fff"/>`
    )
  }

  return ''
}

// Tek satırlık yerler için yatay düzen: başın üstündeki simge sağa alınır ve
// gövde tuvalin dikey ortasına gelir, maskot yazıyla aynı hizada durur.
export type Layout = 'full' | 'row'

const VIEWS: Record<Layout, string> = { full: '0 0 32 32', row: '4 9.5 30 16' }

export const ROW_ASPECT = 30 / 16

export function mascotSvg(
  type: string,
  pose: Pose,
  kind: ToolKind = 'other',
  layout: Layout = 'full',
  gearOverride?: Gear,
): string {
  const found = lookFor(type)
  const look = gearOverride === undefined ? found : { ...found, gear: gearOverride }
  const bob = isMoving(pose)
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.8;0 0" dur="0.8s" ${LOOP}/>`
    : pose === 'idle' || pose === 'wait'
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 0.4;0 0" dur="3s" additive="sum" ${LOOP}/>`
      : ''
  const dim = pose === 'aborted' ? ' opacity="0.55"' : ''
  // Bekleyişte gözler sağa bakarken beden de o yana hafifçe eğilir.
  // Uykudan uyanınca küçük bir sıçrar, bakarken beden o yana hafifçe döner.
  const lean =
    pose === 'wait'
      ? `<animateTransform attributeName="transform" type="rotate" values="5 16 23;5 16 23;0 16 23;0 16 23;5 16 23" keyTimes="${WAIT_TIMES}" dur="${WAIT_DUR}" additive="sum" ${LOOP}/>`
      : pose === 'idle'
        ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -0.8;0 0;0 0" keyTimes="0;0.62;0.635;0.655;1" dur="${IDLE_DUR}" additive="sum" ${LOOP}/>` +
          `<animateTransform attributeName="transform" type="rotate" values="0 16 23;0 16 23;-4 16 23;-4 16 23;4 16 23;4 16 23;0 16 23;0 16 23" keyTimes="${IDLE_LOOK_TIMES}" dur="${IDLE_DUR}" additive="sum" ${LOOP}/>`
        : ''

  return (
    // Çerçevenin renk şeması paneldekiyle aynı olmazsa tarayıcı ona opak (beyaz)
    // zemin verir; poz değişip çerçeve yeniden yüklenirken beyaz kare görünür.
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWS[layout]}" width="100%" height="100%" style="color-scheme: light dark; background: transparent">` +
    `<style>:root { color-scheme: light dark; background: transparent }</style>` +
    `<ellipse cx="16" cy="24.2" rx="8.5" ry="1.1" fill="#000" fill-opacity="0.16"/>` +
    `<g${dim}>${bob}${lean}${body(look, pose)}${eyes(pose)}${heldGear(look, pose)}</g>` +
    (layout === 'row'
      ? `<g transform="translate(29.5 14) scale(0.75) translate(-16 -5)">${above(pose, kind)}</g>`
      : above(pose, kind)) +
    badge(pose) +
    `</svg>`
  )
}

// Uygulama paneli her yeniden çizişinde (ör. tıklayınca odak değişir) resmi baştan
// yükler, SMIL zaman çizelgesi sıfırlanır. Her animasyonun başlangıcını duvar saatine
// göre geriye çekmek, yeni yüklenen resmin kaldığı yerden sürüyormuş gibi başlamasını
// sağlar. Saat bir saatlik pencerede tutulur (çok büyük negatif sayı olmasın diye).
export function inPhase(svg: string, nowMs: number): string {
  const t = Math.round(((nowMs / 1000) % 3600) * 100) / 100

  return svg.replace(/<(animate|animateTransform)\b([^>]*?)(\/?)>/g, (_tag, name: string, attrs: string, close: string) => {
    const begin = /\sbegin="(-?[\d.]+)s"/.exec(attrs)

    // Düz saniye dışında bir begin (olay, ms, liste) varsa dokunma: ikinci begin XML'i bozar.
    if (begin === null && /\sbegin=/.test(attrs)) {
      return `<${name}${attrs}${close}>`
    }

    const shifted = begin
      ? attrs.replace(begin[0], ` begin="${Math.round((Number(begin[1]) - t) * 100) / 100}s"`)
      : `${attrs} begin="${-t}s"`

    return `<${name}${shifted}${close}>`
  })
}

// Sohbetteki araç adımı satırının simgesi. Hareket yalnız çalışan adımda;
// biten durur, hatalı soluklaşıp kırmızı nokta alır, kesilen soluklaşır.
export type StepPhase = 'run' | 'done' | 'error' | 'stopped'

export const STEP_ASPECT = 13 / 10

export function stepIconSvg(kind: ToolKind, phase: StepPhase): string {
  const icon = toolIcon(kind, phase === 'run')
  const body =
    phase === 'error'
      ? `<g opacity="0.55">${icon}</g><circle cx="21" cy="8.6" r="1.5" fill="#F85149"/>`
      : phase === 'stopped'
        ? `<g opacity="0.45">${icon}</g>`
        : icon

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 0.6 13 10" width="100%" height="100%" style="color-scheme: light dark; background: transparent">` +
    `<style>:root { color-scheme: light dark; background: transparent }</style>` +
    body +
    `</svg>`
  )
}

// Dalga bitince bantta bir kez oynayan konfeti: parçalar ortadan dışa saçılır,
// düşer ve söner; döngü yok (fill="freeze"). Bant yeniden çizilirse yeniden
// oynar; bu yüzden çağıran yalnız bitişten sonraki birkaç saniye içinde çizer.
export const CONFETTI_ASPECT = 64 / 16

const CONFETTI_COLORS = ['#D97757', '#6A9BCC', '#4FB39A', '#F2C744', '#A88BD8']

export function confettiSvg(): string {
  let bits = ''

  for (let i = 0; i < 18; i += 1) {
    const angle = (-170 + (i * 160) / 17) * (Math.PI / 180)
    const reach = 7 + ((i * 7) % 5) * 1.3
    const peakX = Math.round(Math.cos(angle) * reach * 2.6 * 10) / 10
    const peakY = Math.round(Math.sin(angle) * reach * 0.9 * 10) / 10
    const fallX = Math.round(peakX * 1.15 * 10) / 10
    const delay = ((i * 7) % 4) * 0.05
    const dur = 1.9 + ((i * 5) % 4) * 0.2
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const spin = i % 2 === 0 ? 360 : -360
    const shape =
      i % 3 === 0
        ? `<polygon points="0,-2 0.6,-0.6 2,0 0.6,0.6 0,2 -0.6,0.6 -2,0 -0.6,-0.6" fill="${color}"/>`
        : `<rect x="-1.6" y="-0.9" width="3.2" height="1.8" rx="0.3" fill="${color}"/>`

    bits +=
      `<g transform="translate(32 13)"><g opacity="0">` +
      `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.7;1" begin="${delay}s" dur="${dur}s" fill="freeze"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;${peakX} ${peakY};${fallX} 4" keyTimes="0;0.4;1" calcMode="spline" keySplines="0.2 0.8 0.4 1;0.5 0 0.8 0.6" begin="${delay}s" dur="${dur}s" fill="freeze"/>` +
      `<g>${shape}<animateTransform attributeName="transform" type="rotate" values="0;${spin}" begin="${delay}s" dur="${dur}s" fill="freeze"/></g>` +
      `</g></g>`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 16" width="100%" height="100%" style="color-scheme: light dark; background: transparent; overflow: visible">` +
    `<style>:root { color-scheme: light dark; background: transparent }</style>` +
    bits +
    `</svg>`
  )
}
