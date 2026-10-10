import type { ClientModule } from 'claude-code'

import type { LiveLine } from '../types'

export type LiveProps = { id: string; lines: LiveLine[] }

// Kartın sık değişen satırları (son adım, araç sayısı, süre). Kendi bölgesinde
// saniyede bir eklentiye sorar; cevap yalnız bu bölgeyi yeniler, panel ve
// maskot resimleri yeniden çizilmez.
const Live: ClientModule<LiveProps, true> = (props, surface) => {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.every(1000, () => surface.post({ id: props.id }))
    surface.setState(true)
  }

  return (
    <Box flexDirection="column">
      {props.lines.map(line => (
        <Text
          color={line.color === '' ? undefined : line.color}
          dimColor={line.isDim}
          wrap="truncate-end"
        >
          {line.text}
        </Text>
      ))}
    </Box>
  )
}

export default Live
