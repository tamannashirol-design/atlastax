// U.S. states (+ DC) and countries for the State and Citizenship questions.

export type Place = { value: string; label: string }

export const usStates: Place[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([value, label]) => ({ value, label }))

// Countries: built from the browser's own region names (always up to date, no
// hand-typed list). Codes that aren't countries are skipped. The U.S. is left
// out: this question is for people who aren't U.S. citizens.
const notCountries = new Set(['AQ', 'BV', 'EU', 'EZ', 'HM', 'QO', 'UM', 'UN', 'US', 'XA', 'XB', 'ZZ'])

let cached: Place[] | null = null
export function countries(): Place[] {
  if (cached) return cached
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  const out: Place[] = []
  const A = 65
  for (let i = 0; i < 26; i++)
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      if (notCountries.has(code)) continue
      const label = names.of(code)
      if (label && label !== code) out.push({ value: code, label })
    }
  cached = out.sort((a, b) => a.label.localeCompare(b.label, 'en'))
  return cached
}

/** Case- and accent-insensitive "contains" match, e.g. "cote" finds Côte d’Ivoire. */
export function matches(label: string, query: string) {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return norm(label).includes(norm(query.trim()))
}
