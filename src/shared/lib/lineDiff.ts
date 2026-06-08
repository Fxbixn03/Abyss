/** Minimal LCS-based line diff, shared by the Compare and History views. */

export interface DiffRow {
  left?: string
  right?: string
  type: 'same' | 'add' | 'remove'
}

export function lineDiff(a: string, b: string): DiffRow[] {
  const al = a.split('\n')
  const bl = b.split('\n')
  const n = al.length
  const m = bl.length

  // dp[i][j] = LCS length of al[i:] and bl[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        al[i] === bl[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (al[i] === bl[j]) {
      rows.push({ left: al[i], right: bl[j], type: 'same' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ left: al[i], type: 'remove' })
      i++
    } else {
      rows.push({ right: bl[j], type: 'add' })
      j++
    }
  }
  while (i < n) rows.push({ left: al[i++], type: 'remove' })
  while (j < m) rows.push({ right: bl[j++], type: 'add' })
  return rows
}
