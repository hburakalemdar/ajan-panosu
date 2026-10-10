import type { ClientModule } from 'claude-code'

import type { CardProps } from '../types'

type CardState = { stop?: () => void }

// Kartın canlı yazı bölgeleri. 'head': başlık, açıklama ve meta satırları; 'body':
// açılan kartta seçili sekmenin metni, kesilmeden. Düğmeler (Detay, sekmeler, Prompt'a
// al, Kopyala) panelin kendisinde: masaüstü Client içindeki düğmeyi yerel çizmiyor,
// düz yazı ya da köşeli kutu kalıyordu (Burak: "ucuz", v0.9.37). Çalışan ajanın
// satırları saniyede bir eklentiye sorulur; ajan bitince soru durur.
const Card: ClientModule<CardProps, CardState> = (props, surface) => {
  const { Box, Text } = surface.elements
  const state = surface.state

  if (state === undefined) {
    const stop = props.isRunning
      ? surface.every(1000, () => surface.post({ card: props.id, part: props.part, tab: props.tab }))
      : undefined
    surface.setState({ stop })
  } else if (!props.isRunning && state.stop !== undefined) {
    state.stop()
    surface.setState({})
  }

  const rows = (lines: CardProps['meta']) =>
    lines.map(one => (
      <Text
        color={one.color === '' ? undefined : one.color}
        dimColor={one.isDim}
        wrap="truncate-end"
      >
        {one.text}
      </Text>
    ))

  if (props.part === 'body') {
    const text = props.tab === 'task' ? props.task : props.report

    return (
      // Markdown elemanı masaüstünün Client bölgesinde çizilemiyor (kart bozuluyordu).
      <Box flexDirection="column" paddingRight={1} minWidth={0} overflow="hidden">
        {props.tab === 'steps'
          ? props.steps.length === 0
            ? <Text dimColor>Henüz adım yok.</Text>
            : rows(props.steps)
          : text.map(row => <Text bold={row.isBold}>{row.text}</Text>)}
      </Box>
    )
  }

  return (
    // minWidth 0 + overflow gizli: uzun adım satırı ("↳ WebSearch · …") kartı genişletip
    // çerçeveden taşıyordu (2026-10-10); artık sütun daralır ve satır içeride kesilir.
    <Box flexDirection="column" paddingRight={1} minWidth={0} overflow="hidden">
      <Text wrap="truncate-end">
        <Text bold color={props.color}>
          {props.label}
        </Text>
        {'  '}
        <Text color={props.statusColor}>{props.statusText}</Text>
      </Text>
      <Text wrap="truncate-end">{props.description}</Text>
      {rows(props.meta)}
    </Box>
  )
}

export default Card
