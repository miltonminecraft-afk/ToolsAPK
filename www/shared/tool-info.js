import {PARTS} from './tool-info-content.js';
export function sectionMarkup(part){return '<p>'+part.intro+'</p>'+part.sections.map(([title,steps])=>'<h3>'+title+'</h3><ol>'+steps.map(step=>'<li>'+step+'</li>').join('')+'</ol>').join('')+'<p class="parts-note">'+part.note+'</p>';}
const path=decodeURIComponent(location.pathname).toLowerCase();
const key=path.includes('/kopermetingen/')?'kopermetingen':path.includes('/tv-codes/')?'tv-codes':/\/(fiber route|value-fiber-route)\//.test(path)?'value-fiber-route':path.includes('/pop-checklist/')?'pop-checklist':'';
if(key){
 const header=document.querySelector('.header, header.top');
 if(header){const details=document.createElement('details');details.className='parts-help';details.id='onderdeel-uitleg';const summary=document.createElement('summary');summary.textContent='Uitleg: '+PARTS[key].title;details.appendChild(summary);const body=document.createElement('div');body.innerHTML=sectionMarkup(PARTS[key]);const link=document.createElement('a');link.className='parts-link';link.href='../info/index.html';link.textContent='Info over alle onderdelen';body.appendChild(link);details.appendChild(body);header.after(details);}
}
