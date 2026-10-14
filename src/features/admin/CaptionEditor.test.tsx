import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CaptionEditor } from './ShopMediaAdmin';

it('retains local text after a stale refresh and requires an explicit replacement',()=>{
  const save=vi.fn(); const {rerender}=render(<CaptionEditor value="Original" disabled={false} save={save}/>);
  fireEvent.change(screen.getByLabelText('Photo caption · optional'),{target:{value:'My unsaved caption'}});
  rerender(<CaptionEditor value="Other editor caption" disabled={false} save={save}/>);
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('My unsaved caption');
  expect(screen.getByRole('status')).toHaveTextContent('Other editor caption');
  fireEvent.click(screen.getByText('Replace saved caption with my text')); expect(save).toHaveBeenCalledWith('My unsaved caption');
  rerender(<CaptionEditor value="My unsaved caption" disabled={false} save={save}/>);
  expect(screen.getByRole('button',{name:'Save caption'})).toBeDisabled();
  rerender(<CaptionEditor value="New later caption" disabled={false} save={save}/>);
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('New later caption');
});
it('retains text after a failed request, supports explicit clear and abandoning edits',()=>{
  const save=vi.fn(); const {rerender}=render(<CaptionEditor value="Saved" disabled={false} save={save}/>);
  fireEvent.change(screen.getByLabelText('Photo caption · optional'),{target:{value:''}});
  fireEvent.click(screen.getByText('Save caption')); expect(save).toHaveBeenCalledWith('');
  rerender(<CaptionEditor value="Saved" disabled={true} save={save}/>);
  rerender(<CaptionEditor value="Saved" disabled={false} save={save}/>);
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('');
  fireEvent.click(screen.getByText('Use saved caption'));
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('Saved');
});
it.each([[' Caption ', 'Caption'],['   ','']])('acknowledges server-trimmed caption %j without a false conflict', (typed,saved)=>{
  const save=vi.fn(); const {rerender}=render(<CaptionEditor value="Original" disabled={false} save={save}/>);
  fireEvent.change(screen.getByLabelText('Photo caption · optional'),{target:{value:typed}});
  fireEvent.click(screen.getByText('Save caption')); expect(save).toHaveBeenCalledWith(typed);
  rerender(<CaptionEditor value={saved} disabled={false} save={save}/>);
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue(saved);
  expect(screen.getByRole('button',{name:'Save caption'})).toBeDisabled();
  expect(screen.queryByText('Replace saved caption with my text')).toBeNull();
});
it('keeps a trailing space while typing so another word can be appended',()=>{
  render(<CaptionEditor value="Original" disabled={false} save={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Photo caption · optional'),{target:{value:'Original '}});
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('Original ');
  fireEvent.change(screen.getByLabelText('Photo caption · optional'),{target:{value:'Original caption'}});
  expect(screen.getByLabelText('Photo caption · optional')).toHaveValue('Original caption');
  expect(screen.getByRole('button',{name:'Save caption'})).toBeEnabled();
});
