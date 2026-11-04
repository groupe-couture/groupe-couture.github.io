const validMonth=v=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function groupStartMonth(dealer){const m=dealer?.joined_group_month??dealer?.joinedGroupMonth;return validMonth(m)?m:null;}
export function outsideGroup(dealer,month){const start=groupStartMonth(dealer);return !!start&&validMonth(month)&&month<start;}
export function groupEntryLabel(dealer){const start=groupStartMonth(dealer);return start?'Dans le groupe depuis '+new Date(start+'-15T12:00:00Z').toLocaleDateString('fr-CA',{month:'long',year:'numeric',timeZone:'America/Toronto'}):'';}
export const joinedMonths=dealers=>Object.fromEntries(dealers.map(d=>[d.id,groupStartMonth(d)]).filter(([,m])=>m));
export const inGroupSubmissions=(submissions,dealers)=>{const starts=joinedMonths(dealers);return submissions.filter(s=>!starts[s?.dealership_id]||typeof s?.snapshot?.endDate==='string'&&s.snapshot.endDate.slice(0,7)>=starts[s.dealership_id]);};
export function completionCounts(rows,id){const parts=rows.map(r=>r.departments[id]),exempt=parts.filter(p=>p.outsideGroup).length,received=parts.filter(p=>p.hasOfficial&&!p.outsideGroup).length;const completed=parts.filter(p=>p.outsideGroup||p.hasOfficial&&!p.partial).length;return {exempt,received,completed,dealers:rows.length,expected:rows.length-exempt,pending:rows.length-completed};}
