import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  minLength?: number;
  autoFocus?: boolean;
  id?: string;
}

export default function PasswordInput({
  value, onChange, placeholder = 'Enter password',
  label, hint, error, minLength, autoFocus, id,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`input${error ? ' input-error' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          autoFocus={autoFocus}
          autoComplete="new-password"
          style={{ paddingRight: '40px', borderColor: error ? 'var(--color-danger)' : undefined }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', display: 'flex',
          }}
        >
          {show ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
