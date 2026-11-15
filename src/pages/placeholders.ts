// Placeholder pages linked from the logged-out page. TODO confirm: real content (and real sign-in) to come.
export const PLACEHOLDER_PAGES: Record<string, { title: string; body: string }> = {
  '/privacy': { title: 'Privacy', body: 'Our privacy policy will be published here.' },
  '/terms': { title: 'Terms', body: 'Our terms of use will be published here.' },
  '/contact': { title: 'Contact', body: 'Contact details will be published here.' },
}

export const isPlaceholderPath = (path: string) => path in PLACEHOLDER_PAGES

