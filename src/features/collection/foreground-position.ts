export type PositionFailure = 'permission_denied' | 'stale_position' | 'position_unavailable' | 'position_timeout';
export type ForegroundPosition =
  | { readonly ok:true; readonly position:{ readonly latitude:number; readonly longitude:number; readonly accuracy:number } }
  | { readonly ok:false; readonly code:PositionFailure };

/** One foreground fix. No watch, cache, persistence, telemetry or error payload. */
export function foregroundPosition(signal: AbortSignal): Promise<ForegroundPosition> {
  return new Promise(resolve => {
    if (signal.aborted || document.visibilityState !== 'visible') {
      resolve({ok:false,code:'stale_position'}); return;
    }
    if (!navigator.geolocation) { resolve({ok:false,code:'position_unavailable'}); return; }
    let done = false;
    const finish = (result: ForegroundPosition) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve(result);
    };
    const onAbort = () => finish({ok:false,code:'stale_position'});
    const onVisibility = () => { if (document.visibilityState !== 'visible') onAbort(); };
    const timer = setTimeout(() => finish({ok:false,code:'position_timeout'}), 12000);
    signal.addEventListener('abort', onAbort, {once:true});
    document.addEventListener('visibilitychange', onVisibility);
    try {
      navigator.geolocation.getCurrentPosition(position => {
        if (done) return;
        if (signal.aborted || document.visibilityState !== 'visible') { onAbort(); return; }
        const { latitude,longitude,accuracy } = position.coords;
        finish({ok:true,position:{latitude,longitude,accuracy}});
      }, error => finish({ok:false,code:error.code === 1 ? 'permission_denied' : error.code === 3 ? 'position_timeout' : 'position_unavailable'}),
      {maximumAge:0,enableHighAccuracy:true,timeout:12000});
    } catch { finish({ok:false,code:'position_unavailable'}); }
  });
}
