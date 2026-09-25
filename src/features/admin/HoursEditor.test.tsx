import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HoursEditor } from './HoursEditor';
import { document, type Value } from './shop-contract';
import { normalizeShopDocument, ShopValidationError, type FieldIssue } from './shop-normalization';

const hours = {note:'Seasonal hours\nCheck before travelling',entries:[
  {day:'monday',opens:'09:00',closes:'12:00',closed:false,note:'Morning'},
  {day:'monday',opens:'22:00',closes:'02:00',closed:null,note:'Late'},
  {day:'tuesday',closed:true,note:'Rest day'},
  {day:'wednesday',closed:null,note:'Call first'},
]};
function Harness({initial=hours as Value}:{initial?:Value}) {
  const [value,setValue] = useState(initial),[errors,setErrors] = useState<FieldIssue[]>([]);
  return <><HoursEditor value={value} errors={errors} onChange={v=>{setValue(v);setErrors([]);}}/>
    <button onClick={()=>{
      try {
        const d = normalizeShopDocument({shop:{name:'Synthetic shop',slug:'synthetic-shop',source_quality:'demo',operational_status:'unknown',position_precision:'locality',opening_hours:value},sources:[],aliases:[],links:[],types:[],services:[],specialties:[],brands:[]});
        setValue(document(d).shop.opening_hours!);
      } catch(e) { if (e instanceof ShopValidationError) setErrors(e.issues); else throw e; }
    }}>Save and reopen</button><output data-testid="hours-value">{JSON.stringify(value)}</output></>;
}
const result = () => JSON.parse(screen.getByTestId('hours-value').textContent!);
describe('weekly hours editor',()=>{
  it('retains split/overnight, unknown/closed and multiline notes through save and reopen',()=>{
    render(<Harness/>);
    expect(screen.getAllByLabelText('Hours state').map(e=>(e as HTMLSelectElement).value)).toEqual(['open','open','closed','unknown']);
    expect(screen.getByText('Closes the following day.')).toBeVisible();
    fireEvent.click(screen.getByText('Save and reopen'));
    expect(result().note).toBe(hours.note);
    hours.entries.forEach((entry,i)=>expect(result().entries[i]).toMatchObject(entry));
    expect(result().entries).toHaveLength(4);
  });
  it('copies all spans and notes and only replaces a destination after a deliberate confirmation',()=>{
    render(<Harness/>); const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText('Copy hours')); expect(result()).toEqual(hours);
    confirm.mockReturnValue(true); fireEvent.click(screen.getByText('Copy hours'));
    expect(result().entries.filter((r:{day:string})=>r.day==='tuesday')).toEqual(hours.entries.slice(0,2).map(r=>({...r,day:'tuesday'})));
    expect(result().entries.find((r:{day:string})=>r.day==='wednesday')).toEqual(hours.entries[3]);
    expect(result().note).toBe(hours.note);
    expect(result().entries.map((r:{day:string})=>r.day)).toEqual(['monday','monday','tuesday','tuesday','wednesday']); confirm.mockRestore();
  });
  it('requires a deliberate clear and preserves a note when changing a span to unknown',()=>{
    render(<Harness/>); const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    fireEvent.change(screen.getAllByLabelText('Hours state')[0]!,{target:{value:'unknown'}});
    expect(result()).toEqual(hours); confirm.mockReturnValue(true);
    fireEvent.change(screen.getAllByLabelText('Hours state')[0]!,{target:{value:'unknown'}});
    expect(result().entries[0]).toEqual({...hours.entries[0],opens:null,closes:null,closed:null});
    fireEvent.click(screen.getByText('Clear all hours')); expect(result()).toBeNull();
    fireEvent.click(screen.getByText('Save and reopen')); expect(result()).toBeNull(); confirm.mockRestore();
  });
  it('shows close-to-field validation and leaves invalid work recoverable',()=>{
    render(<Harness initial={null}/>); fireEvent.click(screen.getByText('Add hours'));
    const row=within(screen.getByRole('group',{name:'Hours 1'}));
    fireEvent.change(row.getByLabelText('Opens'),{target:{value:'25:00'}});
    fireEvent.click(screen.getByText('Save and reopen'));
    expect(row.getByLabelText('Opens')).toHaveAttribute('aria-invalid','true');
    expect(row.getByLabelText('Closes')).toHaveAttribute('aria-invalid','true');
    expect(row.getByLabelText('Opens')).toHaveValue('25:00');
    fireEvent.change(row.getByLabelText('Opens'),{target:{value:'09:00'}});
    fireEvent.change(row.getByLabelText('Closes'),{target:{value:'17:00'}});
    fireEvent.click(screen.getByText('Save and reopen'));
    expect(row.getByLabelText('Opens')).not.toHaveAttribute('aria-invalid');
    expect(result().entries[0]).toMatchObject({opens:'09:00',closes:'17:00'});
  });
  it('does not materialize unknown days just by opening the editor',()=>{
    render(<Harness initial={null}/>); expect(result()).toBeNull();
    expect(screen.getByText(/No entry \(unknown\): Monday, Tuesday/)).toBeVisible();
  });
});
