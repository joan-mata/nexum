export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const str = d.toLocaleDateString('es-ES', options);
  return capitalizeDate(str);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const str = d.toLocaleString('es-ES');
  return capitalizeDate(str);
}

function capitalizeDate(str: string): string {
  return str
    .replace(/^[a-záéíóúüñ]/i, (c) => c.toUpperCase())
    .replace(/\bde ([a-záéíóúüñ])/g, (_, c) => `de ${c.toUpperCase()}`);
}
