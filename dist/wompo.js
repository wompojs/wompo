const oe=!1;let S=null,E=0;const f="$wc$",D="wc-wc",I=/<\/?$/g,H=/\s+([^\s]*?)="?$/g,V=/(<([a-z]*-[a-z]*).*?)\/?>/gs,P=/<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi,L=/^(?:script|style|textarea|title)$/i,x=0,C=1,$=2,N=typeof global<"u",W=N?{createTreeWalker(){}}:document,g=W.createTreeWalker(W,129);class F{constructor(e,t){this.template=e,this.dependencies=t}clone(){const e=this.template.content,t=this.dependencies,s=document.importNode(e,!0);g.currentNode=s;let o=g.nextNode(),a=0,r=0,i=t[0];const p=[];for(;i!==void 0;){if(a===i.index){let l;const c=i.type;c===x?l=new R(o,o.nextSibling):c===C?l=new z(o,i):c===$&&(l=new j(o)),p.push(l),i=t[++r]}a!==i?.index&&(o=g.nextNode(),a++)}return g.currentNode=document,[s,p]}}class T{constructor(e,t){this.values=e.values,this.parts=e.parts,this.template=t}}class R{constructor(e,t){this.isNode=!0;this.isAttr=!1;this.isTag=!1;this.startNode=e,this.endNode=t}clearValue(){let e=this.startNode.nextSibling;for(;e&&e!==this.endNode;)e.remove(),e=this.startNode.nextSibling}dispose(){this.clearValue(),this.startNode.remove(),this.endNode&&this.endNode.remove()}}class z{constructor(e,t){this.isNode=!1;this.isAttr=!0;this.isTag=!1;this.__eventInitialized=!1;this.node=e,this.name=t.name,this.attrStructure=t.attrDynamics}updateValue(e){if(this.name==="ref"&&e.__wcRef){if(e.current=this.node,this.node._$wompo){const o=this.node.onDisconnected;this.node.onDisconnected=()=>{e.current=null,o()}}return}const t=this.node._$wompo;t&&this.node.updateProp(this.name,e);const s=e!==Object(e);if(e===!1)this.node.removeAttribute(this.name);else if(s&&(!this.name.match(/[A-Z]/)||this.node.nodeName==="svg"))this.node.setAttribute(this.name,e);else if(this.name==="style"){let o="";const a=Object.keys(e);for(const r of a){let i=e[r],p=r.replace(/[A-Z]/g,l=>"-"+l.toLowerCase());typeof i=="number"&&(i=`${i}px`),o+=`${p}:${i};`}this.node.setAttribute(this.name,o)}this.name==="title"&&t&&this.node.removeAttribute(this.name)}set callback(e){if(!this.__eventInitialized){const t=this.name.substring(1);this.node.addEventListener(t,this.__listener.bind(this)),this.__eventInitialized=!0}this.__callback=e}__listener(e){this.__callback&&this.__callback(e)}}class j{constructor(e){this.isNode=!1;this.isAttr=!1;this.isTag=!0;this.node=e}}class q{constructor(e){this._$wompoChildren=!0;this.nodes=e}}class U{constructor(e,t){this.isArrayDependency=!0;this.dynamics=[],this.__parentDependency=t,this.addDependenciesFrom(t.startNode,e.length),this.__oldValues=k(this.dynamics,e,[])}addDependenciesFrom(e,t){let s=e,o=t;for(;o;){const a=document.createComment("?START"),r=document.createComment("?END");s.after(a),a.after(r);const i=new R(a,r);s=r,this.dynamics.push(i),o--}}checkUpdates(e){let t=e.length-this.__oldValues.length;if(t>0){let s=this.dynamics[this.dynamics.length-1]?.endNode;s||(s=this.__parentDependency.startNode),this.addDependenciesFrom(s,t)}else if(t<0)for(;t;)this.dynamics.pop().dispose(),t++;return this.__oldValues=k(this.dynamics,e,this.__oldValues),this}}const B=(n,e)=>{const{css:t}=n,{shadow:s,name:o,cssModule:a}=e,r=o,i={};let p=t;return a&&(t.includes(":host")||(p=`${s?":host":r} {display:block;} ${t}`),s||(p=p.replace(/:host/g,r)),p=p.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm,(l,c)=>{const d=`${r}__${c}`;return i[c]=d,`.${d}`})),[p,i]},K=n=>{let e="";const t=[],s=n.length-1;let o="",a="";for(let r=0;r<s;r++){let i=n[r];if(o&&i.includes(o)&&(o=""),a&&new RegExp(`</${a}>`)&&(a=""),o||a)e+=i+f;else{H.lastIndex=0;const p=H.exec(i);if(p){const[l,c]=p,d=l[l.length-1];o=d==='"'||d==="'"?d:"",i=i.substring(0,i.length-o.length-1);let m=`${i}${f}=`;o?m+=`${o}${f}`:m+='"0"',e+=m,t.push(c)}else{if(i.match(I)){e+=i+D;continue}P.lastIndex=0;const l=P.exec(i);l?(a=l[1],e+=i+f):e+=i+`<?${f}>`}}}return e+=n[n.length-1],e=e.replace(V,(r,i,p)=>r.endsWith("/>")?`${i}></${p}>`:r),[e,t]},Z=(n,e,t)=>{const s=[];g.currentNode=n.content;let o,a=0,r=0;const i=e.length;for(;(o=g.nextNode())!==null&&s.length<i;){if(o.nodeType===1){if(o.nodeName===D.toUpperCase()){const p={type:$,index:r};s.push(p)}if(o.hasAttributes()){const p=o.getAttributeNames();for(const l of p)if(l.endsWith(f)){const c=t[a++],d=o.getAttribute(l);if(d!=="0"){const m=d.split(f);for(let u=0;u<m.length-1;u++){const h={type:C,index:r,attrDynamics:d,name:c};s.push(h)}}else{const m={type:C,index:r,name:c};s.push(m)}o.removeAttribute(l)}}if(L.test(o.tagName)){const p=o.textContent.split(f),l=p.length-1;if(l>0){o.textContent="";for(let c=0;c<l;c++)o.append(p[c],document.createComment("")),g.nextNode(),s.push({type:x,index:++r});o.append(p[l],document.createComment(""))}}}else o.nodeType===8&&o.data===`?${f}`&&s.push({type:x,index:r});r++}return s},v=n=>{const[e,t]=K(n.parts),s=document.createElement("template");s.innerHTML=e;const o=Z(s,n.parts,t);return new F(s,o)},G=(n,e)=>{if(!n||!e)return!1;const t=n.parts,s=e.parts;if(t.length!==s?.length)return!1;const o=n.values,a=e.values;for(let r=0;r<t.length;r++)if(t[r]!==s[r]||o[r]?._$wompoF&&(!a[r]?._$wompoF||o[r].componentName!==a[r].componentName))return!1;return!0},Y=(n,e,t)=>{const s=n!==e,o=!!t.attrStructure,r=n?._$wompoChildren&&t.startNode.nextSibling!==n.nodes[0];return s||o||r},A=(n,e,t,s,o)=>{const a=e.node;let r=null;const i=n._$wompoF,p=i?n.componentName:n;if(a.nodeName!==p.toUpperCase()){const l=a.getAttributeNames();if(i){const m={};for(const h of l){const y=a.getAttribute(h);m[h]=y===""?!0:y}r=new n.class,r._$initialProps=m;const u=a.childNodes;for(;u.length;)r.appendChild(u[0])}else{r=document.createElement(p);for(const m of l)r.setAttribute(m,a.getAttribute(m))}let c=t,d=s[c];for(;d?.node===a;)d.node=r,c===t?(c++,d=s[c]):(d?.name&&d?.name!=="ref"&&(r._$initialProps[d.name]=o[c]),c++,d=s[c]);return a.replaceWith(r),r}},k=(n,e,t)=>{const s=[...e];for(let o=0;o<n.length;o++){const a=n[o],r=s[o],i=t[o];if(Y(r,i,a)){if(a.isNode){if(r===!1||r===void 0||r===null){a.clearValue();continue}if(r?._$wompoHtml){const d=G(r,i);if(i===void 0||!d){const u=v(r).clone(),[h,y]=u;s[o]=new T(r,u),k(y,r.values,i?.values??i??[]);const w=a.endNode,b=a.startNode;let _=b.nextSibling;for(;_!==w;)_.remove(),_=b.nextSibling;for(_=b;h.childNodes.length;)_.after(h.childNodes[0]),_=_.nextSibling}else{let m=i;if(!i.template){const b=v(r).clone(),[_,te]=b;s[o]=new T(r,b),m=s[o]}const[u,h]=m.template,y=k(h,r.values,i.values);i.values=y,s[o]=i}continue}const p=r!==Object(r),l=i!==Object(i)&&i!==void 0,c=a.startNode;if(p)l?c.nextSibling?c.nextSibling.textContent=r:c.after(r):(a.clearValue(),c.after(r));else{let d=c.nextSibling,m=0,u=0;if(r._$wompoChildren){i&&!i?._$wompoChildren&&a.clearValue();const h=r.nodes;for(;u<h.length;){(!d||u===0)&&(d=c);const y=h[m];m++,d.after(y),d=d.nextSibling,u++}}else Array.isArray(r)&&(i?.isArrayDependency?s[o]=i.checkUpdates(r):(a.clearValue(),s[o]=new U(r,a)))}}else if(a.isAttr)if(a.name.startsWith("@"))a.callback=r;else{const l=a.attrStructure;if(l){const c=l.split(f);let d=r;for(let m=0;m<c.length-1;m++)c[m]=`${c[m]}${d}`,o++,d=s[o];o--,a.updateValue(c.join("").trim())}else a.updateValue(r)}else if(a.isTag)if(r._$wompoLazy){const l=a.node,c=M(l);c&&(c.addSuspense?c.addSuspense(l):(c.loadingComponents=new Set,c.loadingComponents.add(l)),l.suspense=c),r().then(d=>{const m=A(d,a,o,n,e);c&&c.removeSuspense(l,m)});continue}else A(r,a,o,n,e)}}return s},J=(n,e)=>{const{generatedCSS:t,styles:s}=n.options,o=new CSSStyleSheet;return o.replaceSync(t),class extends HTMLElement{constructor(){super();this._$wompo=!0;this.props={};this.hooks=[];this._$measurePerf=!1;this._$initialProps={};this._$usesContext=!1;this._$hasBeenMoved=!1;this._$layoutEffects=[];this.__updating=!1;this.__oldValues=[];this.__isInitializing=!0;this.__connected=!1;this.__isInDOM=!1}static{this._$wompo=!0}static{this.componentName=e.name}static _$getOrCreateTemplate(i){return this._$cachedTemplate||(this._$cachedTemplate=v(i)),this._$cachedTemplate}connectedCallback(){this.__isInDOM=!0,!this.__connected&&this.isConnected&&this.__initElement()}disconnectedCallback(){this.__connected&&(this.__isInDOM=!1,Promise.resolve().then(()=>{if(this.__isInDOM)this._$hasBeenMoved=!0,this._$usesContext&&this.requestRender();else{this.onDisconnected();for(const i of this.hooks)i?.cleanupFunction&&i.cleanupFunction()}}))}onDisconnected(){}__initElement(){this.__ROOT=this,this.props={...this.props,...this._$initialProps,styles:s};const i=this.getAttributeNames();for(const m of i)if(!this.props.hasOwnProperty(m)){const u=this.getAttribute(m);this.props[m]=u===""?!0:u}const p=Object.keys(this._$initialProps);for(const m of p){const u=this._$initialProps[m];u!==Object(u)&&(u||u===0)&&m!=="title"&&this.setAttribute(m,u.toString())}const l=this.__ROOT.childNodes,c=[];for(;l.length;)c.push(l[0]),l[0].remove();const d=new q(c);this.props.children=d,e.shadow&&!this.shadowRoot&&(this.__ROOT=this.attachShadow({mode:"open"})),e.shadow?this.__ROOT.adoptedStyleSheets=[o]:this.getRootNode().adoptedStyleSheets.push(o),this.__render(),this.__isInitializing=!1,this.__connected=!0,new MutationObserver(m=>{this.__updating||m.forEach(u=>{this.updateProp(u.attributeName,this.getAttribute(u.attributeName))})}).observe(this,{attributes:!0})}__callComponent(){S=this,E=0;const i=n.call(this,this.props);let p=i;return(typeof i=="string"||i instanceof HTMLElement)&&(p=html`${i}`),p}__render(){try{const i=this.__callComponent();if(i==null){this.remove();return}const p=this.constructor;if(this.__isInitializing){const l=p._$getOrCreateTemplate(i),[c,d]=l.clone();this.__dynamics=d;const m=k(this.__dynamics,i.values,this.__oldValues);for(this.__oldValues=m,this.__isInitializing||(this.__ROOT.innerHTML="");c.childNodes.length;)this.__ROOT.appendChild(c.childNodes[0])}else{const l=k(this.__dynamics,i.values,this.__oldValues);this.__oldValues=l}for(;this._$layoutEffects.length;){const l=this._$layoutEffects.pop();l.cleanupFunction=l.callback()}}catch(i){console.error(i)}}requestRender(){this.__updating||(this.__updating=!0,Promise.resolve().then(()=>{this.__render(),this.__updating=!1,this._$hasBeenMoved=!1}))}updateProp(i,p){this.props[i]!==p&&(this.props[i]=p,this.__isInitializing||this.requestRender())}}};export const useHook=()=>{const t=[S,E];return E++,t},useState=n=>{const[e,t]=useHook();if(!e)return typeof n=="function"?[n(),()=>{}]:[n,()=>{}];if(!e.hooks.hasOwnProperty(t)){const o=t;e.hooks[o]=[typeof n=="function"?n():n,a=>{let r=a;const i=e.hooks[o];typeof a=="function"&&(r=a(i[0])),r!==i[0]&&(i[0]=r,e.requestRender())}]}return e.hooks[t]},useEffect=(n,e=null)=>{const[t,s]=useHook();if(t.hooks.hasOwnProperty(s)){const o=t.hooks[s];if(e!==null){for(let a=0;a<e.length;a++)if(o.dependencies[a]!==e[a]){typeof o.cleanupFunction=="function"&&o.cleanupFunction(),Promise.resolve().then(()=>{o.cleanupFunction=n(),o.dependencies=e});break}}else Promise.resolve().then(()=>{o.cleanupFunction=n(),o.dependencies=e})}else{const o={dependencies:e,callback:n,cleanupFunction:null};t.hooks[s]=o,Promise.resolve().then(()=>{o.cleanupFunction=n()})}},useLayoutEffect=(n,e=null)=>{const[t,s]=useHook();if(t.hooks.hasOwnProperty(s)){const o=t.hooks[s];if(e!==null){for(let a=0;a<e.length;a++)if(o.dependencies[a]!==e[a]){typeof o.cleanupFunction=="function"&&o.cleanupFunction(),o.dependencies=e,o.callback=n,t._$layoutEffects.push(o);break}}else t._$layoutEffects.push(o)}else{const o={dependencies:e,callback:n,cleanupFunction:null};t.hooks[s]=o,t._$layoutEffects.push(o)}},useRef=(n=null)=>{const[e,t]=useHook();return e.hooks.hasOwnProperty(t)||(e.hooks[t]={current:n,__wcRef:!0}),e.hooks[t]},useCallback=(n,e=[])=>{const[t,s]=useHook();if(!t.hooks.hasOwnProperty(s))t.hooks[s]={dependencies:e,value:n};else{const a=t.hooks[s];for(let r=0;r<e.length;r++)if(a.dependencies[r]!==e[r]){a.dependencies=e,a.value=n;break}}return t.hooks[s].value};const Q=()=>{let n=0;return()=>{const[e,t]=useHook();return e.hooks.hasOwnProperty(t)||(e.hooks[t]=`:w${n}:`,n++),e.hooks[t]}};export const useId=Q(),useMemo=(n,e)=>{const[t,s]=useHook();if(!t.hooks.hasOwnProperty(s))t.hooks[s]={value:n(),dependencies:e};else{const a=t.hooks[s];for(let r=0;r<e.length;r++)if(a.dependencies[r]!==e[r]){a.dependencies=e,a.value=n();break}}return t.hooks[s].value},useReducer=(n,e)=>{const[t,s]=useHook(),o=s;if(!t.hooks.hasOwnProperty(o)){const i=[e,p=>{const l=t.hooks[o][0],c=n(l,p);let d=c;typeof l=="object"&&!Array.isArray(l)&&l!==null&&(d={...l,...c}),t.hooks[s][0]=d,d!==l&&t.requestRender()}];t.hooks[s]=i}return t.hooks[s]},useExposed=n=>{const e=S,t=Object.keys(n);for(const s of t)e[s]=n[s]};const O=(n,e,t)=>{const[s,o]=n;e&&e.addSuspense(s),s.hooks[o].value=null,t().then(r=>{s.requestRender(),e.removeSuspense(s),s.hooks[o].value=r}).catch(r=>console.error(r))};export const useAsync=(n,e)=>{const[t,s]=useHook(),o=M(t);if(!t.hooks.hasOwnProperty(s))t.hooks[s]={dependencies:e,value:null},O([t,s],o,n);else{const a=t.hooks[s];let r=!1;for(let i=0;i<e.length;i++)if(a.dependencies[i]!==e[i]){a.dependencies=e,r=!0;break}r&&O([t,s],o,n)}return t.hooks[s].value};const X=()=>{let n=0;return e=>{const t=`wompo-context-provider-${n}`;n++;const s=defineWompo(({children:a})=>{const i=useRef(new Set);return useExposed({subscribers:i}),i.current.forEach(p=>p.requestRender()),html`${a}`},{name:t,cssModule:!1});return{name:t,Provider:s,default:e,subscribers:new Set}}};export const createContext=X(),useContext=n=>{const[e,t]=useHook();if(e._$usesContext=!0,!e.hooks.hasOwnProperty(t)||e._$hasBeenMoved){let o=e;const a=n.name.toUpperCase();for(;o&&o.nodeName!==a&&o!==document.body;)o instanceof ShadowRoot?o=o.host:o=o.parentNode;const r=e.hooks[t]?.node;if(o&&o!==document.body){o.subscribers.current.add(e);const i=e.onDisconnected;e.onDisconnected=()=>{o.subscribers.current.delete(e),i()}}else r&&r.subscribers.current.delete(e);e.hooks[t]={node:o}}const s=e.hooks[t].node;return s?s.props.value:n.default};export function html(n,...e){const t=[],s=n.length-1;if(N)t.push(...e);else for(let o=0;o<s;o++)n[o].endsWith("</")||t.push(e[o]);return{parts:n,values:t,_$wompoHtml:!0}}export const wompoDefaultOptions={shadow:!1,name:"",cssModule:!0},registeredComponents={};export function defineWompo(n,e){n.css||(n.css="");const t={...wompoDefaultOptions,...e||{}};if(!t.name){let a=n.name.replace(/.[A-Z]/g,r=>`${r[0]}-${r[1].toLowerCase()}`).toLowerCase();a.includes("-")||(a+="-wompo"),t.name=a}n.componentName=t.name,n._$wompoF=!0;const[s,o]=B(n,t);if(n.css=s,n.options={generatedCSS:s,styles:o,shadow:t.shadow},!N){const a=J(n,t);n.class=a,customElements.define(t.name,a)}return registeredComponents[t.name]=n,n}export const lazy=n=>{let e=null;async function t(){if(!e)try{return e=(await n()).default,e}catch(s){return console.error(s),ee}return e}return t._$wompoLazy=!0,t};const M=n=>{let e=n;for(;e&&e.nodeName!==Suspense.componentName.toUpperCase();)e.parentNode===null&&e.host?e=e.host:e=e?.parentNode;return e};let ee;export function Suspense({children:n,fallback:e}){return this.loadingComponents||(this.loadingComponents=useRef(new Set).current),this.addSuspense=t=>{this.loadingComponents.size||this.requestRender(),this.loadingComponents.add(t)},this.removeSuspense=(t,s=null)=>{if(this.loadingComponents.delete(t),s){for(let o=0;o<n.nodes.length;o++)if(n.nodes[o]===t){n.nodes[o]=s;break}}this.loadingComponents.size||this.requestRender()},this.loadingComponents.size?html`${e}`:html`${n}`}defineWompo(Suspense,{name:"wompo-suspense"});
