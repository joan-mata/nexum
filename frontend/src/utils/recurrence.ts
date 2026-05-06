export type RecurrenceType = 'none' | 'weekly' | 'monthly';

export interface RecurrenceState {
  type: RecurrenceType;
  endDate: string | null;
}

export const EMPTY_RECURRENCE: RecurrenceState = { type: 'none', endDate: null };

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: 'Nunca',
  weekly: 'Semanal',
  monthly: 'Mensual',
};
