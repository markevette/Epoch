export function TrendChart({
  points,
}: {
  points: { date: string; score: number; source: "modeled" | "logged" }[]
}) {
  if (points.length < 2) return null
  const width = 640
  const height = 168
  const padX = 12
  const padY = 16
  const min = Math.min(...points.map((point) => point.score)) - 3
  const max = Math.max(...points.map((point) => point.score)) + 3
  const span = Math.max(1, max - min)
  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * (width - padX * 2)
    const y = padY + (1 - (point.score - min) / span) * (height - padY * 2)
    return { ...point, x, y }
  })
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${height - padY} L${coords[0].x.toFixed(1)},${height - padY} Z`
  const first = points[0]
  const last = points[points.length - 1]
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={`Longevity score from ${Math.round(first.score)} to ${Math.round(last.score)} over ${points.length} days`}>
        <path d={area} className="fill-primary/10" />
        <path d={line} className="fill-none stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((point) =>
          point.source === "logged" ? <circle key={point.date} cx={point.x} cy={point.y} r="3.5" className="fill-copper" /> : null
        )}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{first.date.slice(5)}</span>
        <span>Copper dots are days you logged</span>
        <span>{last.date.slice(5)}</span>
      </figcaption>
    </figure>
  )
}

export function CompareChart({
  you,
  them,
  youName,
  themName,
}: {
  you: { date: string; score: number }[]
  them: { date: string; score: number }[]
  youName: string
  themName: string
}) {
  const dates = [...new Set([...you.map((point) => point.date), ...them.map((point) => point.date)])].sort()
  if (dates.length < 2) return null
  const yours = new Map(you.map((point) => [point.date, point.score]))
  const theirs = new Map(them.map((point) => [point.date, point.score]))
  const scores = dates.flatMap((date) => [yours.get(date), theirs.get(date)].filter((score): score is number => score != null))
  const width = 640
  const height = 180
  const padX = 16
  const padY = 18
  const min = Math.min(...scores) - 3
  const max = Math.max(...scores) + 3
  const span = Math.max(1, max - min)
  function path(series: Map<string, number>) {
    const commands: string[] = []
    dates.forEach((date, index) => {
      const score = series.get(date)
      if (score == null) return
      const x = padX + (index / (dates.length - 1)) * (width - padX * 2)
      const y = padY + (1 - (score - min) / span) * (height - padY * 2)
      commands.push(`${commands.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    })
    return commands.join(" ")
  }
  const youPath = path(yours)
  const themPath = path(theirs)
  const youEnd = you[you.length - 1]
  const themEnd = them[them.length - 1]
  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        role="img"
        aria-label={`${youName} ends at ${youEnd ? Math.round(youEnd.score) : "an open day"}, ${themName} ends at ${themEnd ? Math.round(themEnd.score) : "an open day"}, over ${dates.length} days`}
      >
        {themPath ? <path d={themPath} className="fill-none stroke-copper" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="7 5" /> : null}
        {youPath ? <path d={youPath} className="fill-none stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{dates[0]?.slice(5)}</span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-primary" /> {youName} {youEnd ? Math.round(youEnd.score) : ""}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-copper" /> {themName} {themEnd ? Math.round(themEnd.score) : ""}</span>
        </span>
        <span>{dates[dates.length - 1]?.slice(5)}</span>
      </figcaption>
    </figure>
  )
}
