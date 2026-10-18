(() => {
  let loading;
  function loadOCR(){
    if(!loading) loading=new Promise((resolve,reject)=>{
      if(window.Tesseract)return resolve();
      const s=document.createElement('script');s.src='../../vendor/tesseract/tesseract.min.js';
      s.onload=resolve;s.onerror=()=>{loading=null;reject(new Error('Fotoherkenning kon niet laden.'))};document.head.append(s);
    });
    return loading;
  }
  window.openWebHioScan=()=>{
    const dialog=document.createElement('dialog');
    dialog.style.cssText='width:min(740px,95vw);max-height:90vh;overflow:auto;border:1px solid var(--border);border-radius:14px;background:var(--panel,#fff);color:var(--text,#111);padding:18px';
    dialog.innerHTML=`<h2>HIO foto / import</h2><p>Maak een foto of kies een schermafbeelding. Controleer de herkende gegevens voordat je ze overneemt. Je kunt de route ook handmatig invullen.</p>
      <input type="file" accept="image/*" capture="environment" aria-label="HIO foto"><p role="status"></p>
      <label>Herkende tekst<textarea aria-label="HIO tekst" rows="6" style="width:100%"></textarea></label>
      <button type="button" data-action="parse">Gegevens uit tekst halen</button>
      <p><label>Service ID <input data-field="serviceId"></label> <label>Dikader <input data-field="dikader" inputmode="numeric" size="5"></label></p>
      <div data-rows></div><button type="button" data-action="add">Routepunt toevoegen</button>
      <p><button type="button" data-action="apply">Controleren en overnemen</button> <button type="button" data-action="close">Annuleren</button></p>`;
    document.body.append(dialog);dialog.showModal();
    const $=s=>dialog.querySelector(s), status=$('[role=status]'), rows=$('[data-rows]');
    function add(item={}){
      const box=document.createElement('fieldset');box.style.cssText='margin:12px 0;display:flex;gap:8px;flex-wrap:wrap';
      box.innerHTML='<legend>Routepunt</legend><label>Type <select data-field="type"><option value="hvd">HVD</option><option value="kvd">KVD</option><option value="sip">SIP</option></select></label><label>Naam <input data-field="name" size="8"></label>';
      for(const [key,label] of [['hStijl','H stijl'],['hRij','H rij/cassette'],['hStift','H stift'],['vStijl','V stijl'],['vRij','V rij/cassette'],['vStift','V stift']]){
        const l=document.createElement('label');l.textContent=label+' ';const i=document.createElement('input');i.dataset.field=key;i.size=4;l.append(i);box.append(l);
      }
      const remove=document.createElement('button');remove.type='button';remove.textContent='Verwijderen';remove.onclick=()=>box.remove();box.append(remove);
      for(const i of box.querySelectorAll('[data-field]'))i.value=item[i.dataset.field]|| (i.dataset.field==='type'?'hvd':'');
      rows.append(box);
    }
    function parse(){
      const text=$('textarea').value.replace(/H\s*V\s*D/gi,'HVD').replace(/K\s*V\s*[D0O]/gi,'KVD').replace(/S\s*I\s*P/gi,'SIP');
      const service=text.match(/Service\s*(?:ID|1D)\s*[:\-]?\s*([A-Z]{2,5}\s*\d{4,8})/i);
      if(service)$('[data-field=serviceId]').value=service[1].replace(/\s/g,'').toUpperCase();
      const da=text.match(/\b(?:DA|Dikader)\s*[:\-]?\s*(\d{1,3})/i);if(da)$('[data-field=dikader]').value=da[1];
      const blocks=[...text.matchAll(/\b(HVD|KVD|SIP)\s*[:\-]?\s*([A-Z0-9]+)([\s\S]*?)(?=\b(?:HVD|KVD|SIP)\b|$)/gi)];
      if(blocks.length){rows.replaceChildren();for(const m of blocks){const item={type:m[1].toLowerCase(),name:m[2]};
        for(const side of ['h','v']){const section=m[3].match(new RegExp('\\b'+side+'(?:orizontaal|erticaal)?\\b([\\s\\S]*?)(?=\\b[HV]\\b|$)','i'));
          if(!section)continue;
          for(const [label,key] of [['Stijl','Stijl'],['(?:Rij|Cassette)','Rij'],['Stift','Stift']]){const value=section[1].match(new RegExp(label+'\\s*[:=-]?\\s*([A-Z0-9]+)','i'));if(value)item[side+key]=value[1];}
        }add(item);
      }}
      status.textContent='Controleer Service ID, dikader en alle posities. Vul ontbrekende waarden aan.';
    }
    $('[data-action=add]').onclick=()=>add({type:'kvd'});
    $('[data-action=parse]').onclick=parse;
    $('[data-action=close]').onclick=()=>dialog.close();
    $('[data-action=apply]').onclick=()=>{
      const items=[...rows.children].map(box=>Object.fromEntries([...box.querySelectorAll('[data-field]')].map(i=>[i.dataset.field,i.value.trim()])));
      if(!items.length||items.some(i=>!i.name)){status.textContent='Vul voor ieder routepunt een naam in.';return;}
      const result={serviceId:$('[data-field=serviceId]').value.trim(),dikader:$('[data-field=dikader]').value.trim(),items};
      if(!result.serviceId){status.textContent='Vul eerst een Service ID in.';return;}
      dialog.close();window.receiveHioScanResult(result);
    };
    let worker=null,closed=false;
    dialog.addEventListener('close',()=>{closed=true;if(worker)worker.terminate();dialog.remove()},{once:true});
    $('input[type=file]').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      status.textContent='Foto herkennen…';e.target.disabled=true;
      try{await loadOCR();if(closed)return;
        const base=new URL('../../vendor/tesseract/',location.href).href;
        worker=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,logger:m=>{if(!closed&&m.status==='recognizing text')status.textContent='Foto herkennen: '+Math.round(m.progress*100)+'%'}});
        if(closed){await worker.terminate();worker=null;return;}
        const {data}=await worker.recognize(file);if(!closed){$('textarea').value=data.text;parse();}
      }catch(error){if(!closed)status.textContent='Herkenning mislukt: '+error.message+'. Vul de gegevens handmatig in.';}
      finally{if(worker){await worker.terminate();worker=null;}e.target.disabled=false;}
    };
    add();
  };
})();
