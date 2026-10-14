import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {MainShopType} from './MainShopType';

const options=[{id:'a',label:'Stationery Store'},{id:'b',label:'Bookshop'}];
describe('main store type',()=>{
 it('uses one selector and replaces the old type without carrying its provenance to a different type',()=>{
  const change=vi.fn();
  render(<MainShopType rows={[{shop_type_id:'a',is_primary:true,note:'Only applies to stationery'}]} options={options} disabled={false} onChange={change}/>);
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Store type'),{target:{value:'b'}});
  expect(change).toHaveBeenLastCalledWith([{shop_type_id:'b',is_primary:true}]);
  fireEvent.change(screen.getByLabelText('Store type'),{target:{value:''}});
  expect(change).toHaveBeenLastCalledWith([]);
 });
 it('requires deliberate resolution of multiple legacy types and retains the chosen row metadata',()=>{
  const change=vi.fn(), selected={shop_type_id:'b',is_primary:false,note:'Existing note',source_id:'source'};
  render(<MainShopType rows={[{shop_type_id:'a',is_primary:true},selected]} options={options} disabled={false} onChange={change}/>);
  expect(screen.getByText(/multiple older types/)).toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Store type'),{target:{value:'b'}});
  expect(change).toHaveBeenCalledWith([{...selected,is_primary:true}]);
 });
 it('exposes missing choices and validation errors without enabling archived edits',()=>{
  render(<MainShopType rows={[{shop_type_id:'missing',is_primary:true}]} options={options} disabled error="Choose a current type." onChange={vi.fn()}/>);
  expect(screen.getByLabelText('Store type')).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a current type.');
  expect(screen.getByText(/Previous type/)).toBeInTheDocument();
 });
});
