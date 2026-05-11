const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined

function wrap(open: string, close: string) {
  return (value: string) => useColor ? `${open}${value}${close}` : value
}

export default {
  bold: wrap("[1m", "[22m"),
  cyan: wrap("[36m", "[39m"),
  dim: wrap("[2m", "[22m"),
  red: wrap("[31m", "[39m"),
  yellow: wrap("[33m", "[39m"),
  blue: wrap("[34m", "[39m"),
  green: wrap("[32m", "[39m"),
}
