export function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

export function formatDuration(milliseconds) {
  const seconds = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
    .format(milliseconds / 1000)
  return `${seconds} seconds`
}
