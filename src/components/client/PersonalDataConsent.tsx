import PrivacyPolicyLink from './PrivacyPolicyLink';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant: 'booking' | 'callback';
  error?: string;
};

const policyLink = (
  <PrivacyPolicyLink>политикой обработки персональных данных</PrivacyPolicyLink>
);

/** Required ПДн consent + policy link/modal for forms that collect name/phone. Not for cookie banner. */
export default function PersonalDataConsent({ checked, onChange, variant, error }: Props) {
  if (variant === 'booking') {
    return (
      <>
        <label className={`calc-opt ${checked ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            required
          />
          <span className="calc-opt-main">
            <strong>
              Согласен с {policyLink}
            </strong>
            <span className="muted">Имя и телефон нужны только для связи по заявке</span>
          </span>
        </label>
        {error && (
          <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{error}</span>
        )}
      </>
    );
  }

  return (
    <>
      <label className={`callback-consent ${checked ? 'is-on' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
        />
        <span>
          Согласен с {policyLink}
        </span>
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>
          {error}
        </p>
      )}
    </>
  );
}
