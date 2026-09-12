import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { foregroundPosition } from './foreground-position';

beforeEach(()=>vi.spyOn(document,'visibilityState','get').mockReturnValue('visible'));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('requests a fresh foreground sample and projects only coordinates and accuracy',async()=>{
  const getCurrentPosition=vi.fn((success:PositionCallback)=>success({coords:{latitude:1,longitude:2,accuracy:100,altitude:99},timestamp:1} as GeolocationPosition));
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});
  expect(await foregroundPosition(new AbortController().signal)).toEqual({ok:true,position:{latitude:1,longitude:2,accuracy:100}});
  expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
  expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function),expect.any(Function),{maximumAge:0,enableHighAccuracy:true,timeout:20000});
});
it('discards a pending fix if the page becomes hidden, including its late callback',async()=>{
  let complete:PositionCallback=()=>{};
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(success:PositionCallback)=>{complete=success;}}});
  const result=foregroundPosition(new AbortController().signal);
  vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  complete({coords:{latitude:1,longitude:2,accuracy:1}} as GeolocationPosition);
  expect(await result).toEqual({ok:false,code:'stale_position'});
});
it('never acquires location when already hidden or cancelled',async()=>{
  const getCurrentPosition=vi.fn();vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});
  const controller=new AbortController();controller.abort();
  expect((await foregroundPosition(controller.signal)).ok).toBe(false);
  vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
  expect((await foregroundPosition(new AbortController().signal)).ok).toBe(false);
  expect(getCurrentPosition).not.toHaveBeenCalled();
});
it('reports permission denial without including the browser error object',async()=>{
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(_success:PositionCallback,error:PositionErrorCallback)=>error({code:1,message:'private'} as GeolocationPositionError)}});
  expect(await foregroundPosition(new AbortController().signal)).toEqual({ok:false,code:'permission_denied'});
});
