import { useMemo, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { App } from './App';
import { CloudBoards } from './cloud-boards';

export function AuthAwareApp(){
 const {isLoaded,isSignedIn,userId,getToken}=useAuth();
 const tokenRef=useRef(getToken);tokenRef.current=getToken;
 const apiUrl=import.meta.env.VITE_WHITEBOARD_API_URL as string|undefined;
 const cloud=useMemo(()=>isSignedIn&&userId&&apiUrl?new CloudBoards({userId,getToken:()=>tokenRef.current(),apiUrl}):undefined,[isSignedIn,userId,apiUrl]);
 if(!isLoaded)return <main className="missing">Loading boards…</main>;
 return <App key={cloud?userId:'local'} authConfigured cloud={cloud} syncUnavailable={Boolean(isSignedIn&&!apiUrl)}/>;
}
