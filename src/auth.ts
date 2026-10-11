import {createAuth0Client, type Auth0Client} from './auth0-spa-js.production.esm.js';

export type AuthUser={sub?:string,name?:string,email?:string,picture?:string};
export type LocalProfile={userId:string,role:'Nonprofit'|'Business'|'Volunteer'|'Sponsor',details:Record<string,string>,createdAt:string};

const DOMAIN='dev-zxinp130rbcvzrfu.us.auth0.com';
const CLIENT_ID='kFSOlcq8zi9kd08arUMcvaNyM00NWcXg';
const PROFILE_KEY='missionmesh-auth-profile-v1';
let clientPromise:Promise<Auth0Client>|undefined;

function client(){return clientPromise||(clientPromise=createAuth0Client({domain:DOMAIN,clientId:CLIENT_ID,cacheLocation:'memory',useRefreshTokens:false,authorizationParams:{redirect_uri:window.location.origin}}));}
function callbackPresent(){const q=new URLSearchParams(window.location.search);return q.has('code')&&q.has('state');}
function clearCallback(){const url=new URL(window.location.href);url.search='';url.hash='';history.replaceState({},'',url.pathname);}

export async function initializeAuth(){const sdk=await client();if(callbackPresent()){await sdk.handleRedirectCallback();clearCallback()}const isAuthenticated=await sdk.isAuthenticated();const user=isAuthenticated?await sdk.getUser():undefined;return{sdk,isAuthenticated,user};}
export async function login(signUp=false){const sdk=await client();await sdk.loginWithRedirect({authorizationParams:{redirect_uri:window.location.origin,screen_hint:signUp?'signup':undefined}})}
export async function logout(){const sdk=await client();await sdk.logout({logoutParams:{returnTo:window.location.origin}})}
export function getProfile(user?:AuthUser){if(!user?.sub)return undefined;try{const profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');return profile?.userId===user.sub?profile as LocalProfile:undefined}catch{return undefined}}
export function saveProfile(user:AuthUser,role:LocalProfile['role'],details:Record<string,string>){if(!user.sub)throw new Error('Authenticated user identity is unavailable.');const profile:LocalProfile={userId:user.sub,role,details,createdAt:new Date().toISOString()};localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return profile;}
export function clearLocalProfile(){localStorage.removeItem(PROFILE_KEY)}
export const authConfig={domain:DOMAIN,clientId:CLIENT_ID};
