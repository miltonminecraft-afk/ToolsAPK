(() => {
  if(location.protocol==='file:')return;
  const native=window.Capacitor?.isNativePlatform?.();
  if(native||!('serviceWorker' in navigator))return;
  const root=new URL('../',document.currentScript.src);
  window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname}).catch(()=>{}));
})();
