import {stepsFor, progress, esc} from './domain.mjs?v=1.15.0';
const STATUS = {
 'À faire': {className:'todo', label:'à faire', mark:''},
 'En cours': {className:'ongoing', label:'en cours', mark:'•'},
 'Terminé': {className:'done', label:'terminée', mark:'✓'},
 'Non requis': {className:'not-required', label:'non requise', mark:'−'}
};
const ICONS = {
 inspection:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10l1 1 2-2M13 10h3M8 16l1 1 2-2M13 16h3"/>',
 mechanique:'<path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z"/>',
 sousTraitance:'<path d="M4 8h12M12 4l4 4-4 4M20 16H8M12 12l-4 4 4 4"/>',
 lavage:'<path d="M5 15h14l-2-5H7l-2 5ZM5 15v5M19 15v5M5 18h14M8 15h1M15 15h1M5 3v3M10 2v3M15 3v3M20 2v3"/>',
 photos:'<path d="M8 6l2-3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4Z"/><circle cx="12" cy="13" r="4"/>',
 pieces:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 6l9 5"/>'
};
export function preparationSummary(v) {
 const steps=stepsFor(v);
 const badges=steps.map(([key,label])=>{
  const state=STATUS[v.steps?.[key]?.status]||STATUS['À faire'];
  const text=esc(`${label} · ${state.label}`);
  return `<span role="listitem"><button type="button" class="preparation-icon ${state.className}" title="${text}" aria-label="${text}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[key]||ICONS.inspection}</svg>${state.mark?`<span class="preparation-mark" aria-hidden="true">${state.mark}</span>`:''}</button></span>`;
 }).join('');
 return `<div class="preparation-summary"><div class="preparation-count">${progress(v)} / ${steps.length} étapes complétées</div><div class="preparation-icons" role="list" aria-label="Avancement de la préparation">${badges}</div>${v.workOrders?.length?'<small class="work-summary">Travaux : '+v.workOrders.filter(w=>['Terminé','Non requis'].includes(w.status)).length+' / '+v.workOrders.length+' complétés</small>':''}${v.blocker?`<button type="button" class="preparation-blocker-icon" title="Attente / blocage : ${esc(v.blocker)}" aria-label="Attente / blocage : ${esc(v.blocker)}">!</button>`:''}</div>`;
}
