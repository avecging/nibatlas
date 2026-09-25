'use client';

import { useId } from 'react';
import { ExperienceIcon } from '@/src/components/ui/ExperienceIcon';
import { DEFAULT_EXPERIENCE_ICON, EXPERIENCE_ICONS, type ExperienceIcon as ExperienceIconName } from '@/src/domain/experience-icons';
import styles from './ExperienceIconPicker.module.css';

export function ExperienceIconPicker({value, change, path, error}: {
  value: unknown; change: (value: ExperienceIconName) => void; path: string; error?: string | undefined;
}) {
  const id = useId();
  return <fieldset className={styles.picker} role="radiogroup" aria-invalid={error ? true : undefined}
    aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
    <legend>Experience icon</legend>
    <p id={`${id}-hint`} className={styles.hint}>Choose a symbol for this experience. Existing entries use Writing until you choose another.</p>
    <div className={styles.choices}>
      {EXPERIENCE_ICONS.map(({key,label}) => <label key={key} className={styles.choice}>
        <input type="radio" name={id} value={key} checked={(value ?? DEFAULT_EXPERIENCE_ICON) === key}
          onChange={() => change(key)} data-field-path={path}
          aria-describedby={error ? `${id}-error` : undefined}/>
        <ExperienceIcon name={key} size={24}/><span>{label}</span>
      </label>)}
    </div>
    {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
  </fieldset>;
}
