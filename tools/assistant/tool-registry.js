export const TOOL_REGISTRY = {
  'kopermetingen': {
    name: 'Kopermetingen', path: '../kopermetingen/index.html',
    description: 'Werktool voor kopertrajecten met HIO-scan, HVD/KVD/ISRA-route, posities, Argus QR-metingen, LCL, nieuwe positie, OG-aansturing en tekstdocumenten.',
    actions: ['Uitleg', 'HIO-scan', 'Argus QR', 'Nieuwe positie', 'Route hersteld']
  },
  'tv-codes': {
    name: 'Afstandsbediening codes', path: '../tv-codes/index.html',
    description: 'Zoekt TV-codes voor KPN IR/Bluetooth 5202-7022-3918 en afstandsbedieningen C2 en D3 en begeleidt het programmeren.',
    actions: ['Uitleg', 'TV koppelen', 'Bluetooth koppelen']
  },
  'value-fiber-route': {
    name: 'Value Fiber Route', path: '../value-fiber-route/index.html',
    description: 'Leest Excel-koppelbonnen, toont route en locaties en ondersteunt OTDR-keuzes met segmentlengtes.',
    actions: ['Uitleg', 'Excel importeren', 'Route bekijken', 'OTDR']
  },
  'pop-checklist': {
    name: 'Checklist PoP', path: '../pop-checklist/index.html',
    description: 'PoP-inspectiechecklist met formuliergegevens, foto’s, lokale opslag, Excel-template, ZIP en e-mail/share-functies.',
    actions: ['Uitleg', 'Formulier invullen', 'Foto toevoegen', 'ZIP maken', 'E-mail opstellen']
  }
};

export function toolContext(key){
  const t=TOOL_REGISTRY[key];
  if(!t) return '';
  return `Huidige tool: ${t.name}. Werking: ${t.description} Functies: ${t.actions.join(', ')}.`;
}
