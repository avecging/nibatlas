import { useId } from 'react';
import type { Option, Row } from './shop-contract';
import styles from './ShopAdmin.module.css';

export function MainShopType({rows, options, disabled, error, onChange}: {
  rows: Row[]; options: Option[]; disabled: boolean; error?: string | undefined;
  onChange: (rows: Row[]) => void;
}) {
  const id = useId();
  const current = rows.length === 1 ? String(rows[0]?.shop_type_id ?? '') : '';
  const unavailable = !!current && !options.some(option => option.id === current);
  return <fieldset className={styles.group} data-field-path="types" tabIndex={-1} disabled={disabled}>
    <legend>Main store type</legend>
    <label htmlFor={id}>Store type</label>
    <select id={id} value={current} aria-invalid={!!error || rows.length > 1 || unavailable}
      aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      data-field-path="types.0.shop_type_id"
      onChange={event => {
        const selected = event.target.value;
        const existing = rows.find(row => row.shop_type_id === selected);
        onChange(selected ? [{...existing, shop_type_id: selected, is_primary: true}] : []);
      }}>
      <option value="">Choose a store type</option>
      {unavailable && <option value={current} disabled>Previous type — choose a replacement</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <p id={`${id}-help`} className={styles.help}>
      Choose the shop’s main identity. Add vintage or used stock, nib work and repairs manually under Experiences.
      {rows.length > 1 && ' This shop has multiple older types. Choosing one replaces them when you save.'}
      {unavailable && ' The previous type is no longer available.'}
    </p>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
  </fieldset>;
}
