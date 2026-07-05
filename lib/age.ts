export function formatAge(age: number | string, unit?: string | null) {
  const n = Number(age)
  return unit === 'months' ? `${n} mo` : `${n} yrs`
}
