import { useEffect, useId, useRef, useState } from 'react';
import { Code2, Pencil, FileCode2, ChevronDown, Check } from 'lucide-react';
import { CodeBlock, highlightCode } from './vendor/arc/code-block/code-block';

export function BoardCodeBlock({code,filename,language,onSave}:{code:string;filename:string;language:string;onSave:(code:string,filename:string,language:string)=>void}) {
 const [editing,setEditing]=useState(false);
 const [languagesOpen,setLanguagesOpen]=useState(false);
 const languageButton=useRef<HTMLButtonElement>(null);
 const highlightRef=useRef<HTMLPreElement>(null);
 const languageLabelId=useId();
 const [draft,setDraft]=useState({code,filename,language});
 useEffect(()=>{if(!editing)setDraft({code,filename,language})},[code,filename,language,editing]);
 const cancel=()=>{setDraft({code,filename,language});setLanguagesOpen(false);setEditing(false)};
 const save=()=>{onSave(draft.code,draft.filename,draft.language.trim()||'python');setLanguagesOpen(false);setEditing(false)};
 const languages=[['python','Python'],['javascript','JavaScript'],['typescript','TypeScript'],['jsx','JSX'],['tsx','TSX'],['html','HTML'],['css','CSS'],['json','JSON'],['sql','SQL'],['bash','Bash'],['go','Go'],['rust','Rust'],['java','Java'],['c','C'],['cpp','C++'],['csharp','C#'],['yaml','YAML'],['markdown','Markdown'],['text','Plain text']];
 const languageName=languages.find(([value])=>value===draft.language.toLowerCase())?.[1]||draft.language;
 return <div className="board-code-block">
  {editing ? <form className="code-editor" onSubmit={e=>{e.preventDefault();save()}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();cancel()}else if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.stopPropagation();save()}}}>
   <div className="code-editor-title"><span className="code-editor-title-icon"><FileCode2 size={16}/></span><span>Edit snippet</span></div>
   <div className="code-editor-fields">
    <label>File name<input aria-label="File name" placeholder="File name" value={draft.filename} onChange={e=>setDraft({...draft,filename:e.target.value})}/></label>
    <div className="code-language" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setLanguagesOpen(false)}}>
     <span id={languageLabelId}>Language</span>
     <button ref={languageButton} className="code-language-trigger" type="button" aria-labelledby={languageLabelId} aria-haspopup="listbox" aria-expanded={languagesOpen} onClick={()=>setLanguagesOpen(value=>!value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();const parent=e.currentTarget.parentElement;setLanguagesOpen(true);requestAnimationFrame(()=>parent?.querySelector<HTMLButtonElement>('[role=option]')?.focus())}}}><span>{languageName}</span><ChevronDown size={15}/></button>
     <div className={`code-language-menu ${languagesOpen?'is-open':''}`} role="listbox" aria-label="Language" inert={!languagesOpen} aria-hidden={!languagesOpen} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setLanguagesOpen(false);languageButton.current?.focus()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const options=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]'));const current=options.indexOf(document.activeElement as HTMLButtonElement);options[(current+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus()}}}>
      {languages.map(([value,label])=><button key={value} type="button" role="option" aria-selected={draft.language.toLowerCase()===value} onClick={()=>{setDraft({...draft,language:value});setLanguagesOpen(false);languageButton.current?.focus()}}><span>{label}</span>{draft.language.toLowerCase()===value&&<Check size={14}/>}</button>)}
     </div>
    </div>
   </div>
   <label className="code-editor-source">Code<span className="code-input-wrap"><pre className="code-live-highlight" ref={highlightRef} aria-hidden="true"><code dangerouslySetInnerHTML={{__html:highlightCode(draft.code,draft.language)+'\n'}}/></pre><textarea autoFocus wrap="off" placeholder="Write or paste your code here…" value={draft.code} onScroll={e=>{if(highlightRef.current){highlightRef.current.scrollTop=e.currentTarget.scrollTop;highlightRef.current.scrollLeft=e.currentTarget.scrollLeft}}} onChange={e=>setDraft({...draft,code:e.target.value})} onKeyDown={e=>{if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();e.stopPropagation();const input=e.currentTarget,start=input.selectionStart,end=input.selectionEnd;setDraft(current=>({...current,code:current.code.slice(0,start)+'  '+current.code.slice(end)}));requestAnimationFrame(()=>input.setSelectionRange(start+2,start+2))}}} spellCheck={false}/></span></label>
   <div className="code-actions"><span className="code-shortcut">⌘ / Ctrl + Enter to save</span><button type="button" onClick={cancel}>Cancel</button><button className="code-save" type="submit">Done</button></div>
  </form> : <>
   <div className="code-preview"><CodeBlock code={code} filename={filename || undefined} language={language || 'text'}/>{!code && <div className="code-empty"><span className="code-empty-icon"><Code2 size={20}/></span><span>Add a snippet to your board</span><small>Keep your code close to your ideas.</small></div>}</div>
   <div className="code-footer"><button className="edit-code" onClick={()=>setEditing(true)}><Pencil size={14}/>{code?'Edit code':'Add code'}</button></div>
  </>}
 </div>;
}
