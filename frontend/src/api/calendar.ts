import client from './client';

export interface ScheduledEvent {
  id: string;
  expected_date: string;
  type: string;
  description: string;
  estimated_amount: number | null;
  currency: 'EUR' | 'USD' | null;
  lender_id: string | null;
  lender_name: string | null;
  is_completed: boolean;
  completed_transaction_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EventInput {
  expected_date: string;
  type: string;
  description: string;
  estimated_amount?: number | null;
  currency?: 'EUR' | 'USD' | null;
  lender_id?: string | null;
  notes?: string | null;
}

export const calendarApi = {
  events: (from?: string, to?: string) =>
    client.get<ScheduledEvent[]>('/calendar/events', { params: { from, to } }),
  create: (data: EventInput) => client.post<ScheduledEvent>('/calendar/events', data),
  update: (id: string, data: EventInput) =>
    client.put<ScheduledEvent>(`/calendar/events/${id}`, data),
  complete: (id: string, transactionId?: string) =>
    client.put<ScheduledEvent>(`/calendar/events/${id}/complete`, {
      completed_transaction_id: transactionId ?? null,
    }),
};
