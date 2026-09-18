(() => {
  const path = location.pathname.toLowerCase();
  const tool = path.includes('/kopermetingen/') ? 'kopermetingen' :
               path.includes('/tv-codes/') ? 'tv-codes' :
               path.includes('/value-fiber-route/') ? 'value-fiber-route' :
               path.includes('/pop-checklist/') ? 'pop-checklist' : '';
  if (!tool) return;

  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
  ready(() => {
    const panel=document.getElementById('settingsPanel');
    if(!panel || document.getElementById('toolsAssistantSetting')) return;

    const row=document.createElement('div');
    row.className='setting-row';
    row.id='toolsAssistantSetting';
    row.innerHTML='<span>Assistent</span><span>›</span>';
    panel.appendChild(row);

    const overlay=document.createElement('div');
    overlay.id='toolsAssistantOverlay';
    overlay.style.cssText='display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.58);padding:12px;align-items:center;justify-content:center';
    const shell=document.createElement('div');
    shell.style.cssText='width:min(720px,100%);height:min(780px,92vh);background:var(--panel,#11151d);border:1px solid var(--border,#2a303c);border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.5);display:grid;grid-template-rows:48px 1fr';
    const top=document.createElement('div');
    top.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 16px;border-bottom:1px solid var(--border,#2a303c);color:var(--text,#fff);font-weight:900';
    top.innerHTML='<span>Assistent</span>';
    const close=document.createElement('button');
    close.type='button'; close.textContent='×';
    close.setAttribute('aria-label','Sluiten');
    close.style.cssText='width:38px;height:38px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer';
    top.appendChild(close);
    const frame=document.createElement('iframe');
    frame.title='Assistent';
    frame.src='../assistant/index.html?embedded=1&tool='+encodeURIComponent(tool);
    frame.style.cssText='width:100%;height:100%;border:0;background:transparent';
    shell.append(top,frame); overlay.appendChild(shell); document.body.appendChild(overlay);

    const open=()=>{ overlay.style.display='flex'; try{panel.classList.remove('open')}catch(e){} };
    const hide=()=>{ overlay.style.display='none'; };
    row.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open()});
    close.addEventListener('click',hide);
    overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});
  });
})();