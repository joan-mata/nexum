import { RecurrenceType, RECURRENCE_LABELS } from '../utils/recurrence';

interface Props {
  type: RecurrenceType;
  endDate: string | null;
  minDate: string;
  onChange: (type: RecurrenceType, endDate: string | null) => void;
}

export function RecurrenceFields({ type, endDate, minDate, onChange }: Props): JSX.Element {
  return (
    <div>
      <div className="flex gap-3 items-end">
        <div className={type !== 'none' ? 'flex-1' : 'w-full'}>
          <label className="label">Repetir</label>
          <select
            className="input"
            value={type}
            onChange={(e) => onChange(e.target.value as RecurrenceType, null)}
          >
            {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map((k) => (
              <option key={k} value={k}>{RECURRENCE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        {type !== 'none' && (
          <div className="flex-1">
            <label className="label">Hasta *</label>
            <input
              type="date"
              className="input"
              value={endDate ?? ''}
              min={minDate}
              onChange={(e) => onChange(type, e.target.value || null)}
              required
            />
          </div>
        )}
      </div>
    </div>
  );
}
