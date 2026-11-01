export function workspaceReleaseTarget(release,href){
 if(!/^\d+\.\d+\.\d+$/.test(release?.version)||release.entry!=='app-'+release.version+'.html')return null;
 const target=new URL(href);if(!['https:','http:'].includes(target.protocol))return null;
 target.searchParams.set('v',release.version);return target.href;
}
export async function checkWorkspaceRelease({currentVersion,href,fetcher=globalThis.fetch,navigate=url=>location.replace(url)}){
 try{
  const response=await fetcher(new URL('./groupe/release.json',href),{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;const release=await response.json();if(release.version===currentVersion)return false;
  const target=workspaceReleaseTarget(release,href);if(!target)return false;navigate(target);return true;
 }catch{return false;}
}
