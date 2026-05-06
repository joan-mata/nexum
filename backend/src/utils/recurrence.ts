export function generateRecurringDates(
  startDate: string,
  type: 'weekly' | 'monthly',
  endDate: string
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T12:00:00Z');
  const current = new Date(startDate + 'T12:00:00Z');
  const MAX_INSTANCES = 156;

  for (let i = 0; i < MAX_INSTANCES; i++) {
    if (type === 'weekly') {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
    if (current > end) break;
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}
