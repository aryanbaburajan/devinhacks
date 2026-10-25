export default function TrackIcon({ name }) {
  const paths = {
    volume: 'M11 5 6 9H3v6h3l5 4V5m4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    muted: 'M11 5 6 9H3v6h3l5 4V5m5 4 5 6m0-6-5 6',
    duplicate: 'M9 9h11v11H9V9M15 5V3H3v12h2',
    delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    close: 'm6 6 12 12M6 18 18 6',
    retry: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
    mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-4 0h8',
    guitar: 'm14 10 6-7 2 2-7 6M14 10c-4-2-3 2-6 2s-6 3-4 7 6 3 8 0 0-4 3-6l-1-3ZM8 16h.01',
    electric: 'm14 10 6-7 2 2-7 6M14 10l-4-1-1 4-6 3 3 5 6-2 3-6-1-3ZM8 16h.01',
    piano: 'M3 4h18v16H3V4m6 0v16m6-16v16M7 4v8h4V4m2 0v8h4V4',
  }
  return <svg className="track-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
