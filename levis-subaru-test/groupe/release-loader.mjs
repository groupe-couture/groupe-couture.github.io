export function releaseTarget(release,href){
 if(!/^\d+\.\d+\.\d+$/.test(release?.version)||release.entry!=='app-'+release.version+'.html')return null;
 const current=new URL(href),target=new URL(release.entry,current);
 target.search=current.search;target.searchParams.set('v',release.version);target.hash=current.hash;
 return target.href;
}
export async function checkDashboardRelease({currentVersion,href,fetcher=globalThis.fetch,navigate=url=>location.replace(url)}){
 try{
  const response=await fetcher(new URL('./release.json',href),{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;const release=await response.json();
  if(release.version===currentVersion)return false;
  const target=releaseTarget(release,href);if(!target)return false;navigate(target);return true;
 }catch{return false;}
}
