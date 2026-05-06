import { RecurrenceType, RECURRENCE_LABELS } from '../utils/recurrence';

interface Props {
  type: RecurrenceType;
  endDate: string | null;
  minDate: string;
  onChange: (type: RecurrenceType, endDate: string | null) => void;
}

export function RecurrenceFields({ type, endDate, minDate, onChange }: Props): JSX.Element {
  return (
    <div className="border-t border-gray-700 pt-4 space-y-3">
      <div>
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
        <div>
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
  );
}
