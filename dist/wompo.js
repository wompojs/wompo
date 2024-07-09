const oe=!1;let x=null,S=0;const y="$wc$",w="wc-wc",V=/<\/?$/g,H=/\s+([^\s]*?)="?$/g,I=/(<([a-z]*-[a-z]*).*?)\/?>/gs,D=/<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi,L=/^(?:script|style|textarea|title)$/i,E=0,C=1,$=2,N=typeof global<"u",W=N?{createTreeWalker(){}}:document,g=W.createTreeWalker(W,129),F=["class","style","id"];class z{constructor(e,o){this.template=e,this.dependencies=o}clone(){const e=this.template.content,o=this.dependencies,n=document.importNode(e,!0);g.currentNode=n;let t=g.nextNode(),a=0,s=0,i=o[0];const p=[];for(;i!==void 0;){if(a===i.index){let l;const c=i.type;c===E?l=new v(t,t.nextSibling):c===C?l=new j(t,i):c===$&&(l=new U(t)),p.push(l),i=o[++s]}a!==i?.index&&(t=g.nextNode(),a++)}return g.currentNode=document,[n,p]}}class T{constructor(e,o){this.values=e.values,this.parts=e.parts,this.template=o}}class v{constructor(e,o){this.isNode=!0;this.isAttr=!1;this.isTag=!1;this.startNode=e,this.endNode=o}clearValue(){let e=this.startNode.nextSibling;for(;e&&e!==this.endNode;)e.remove(),e=this.startNode.nextSibling}dispose(){this.clearValue(),this.startNode.remove(),this.endNode&&this.endNode.remove()}}class j{constructor(e,o){this.isNode=!1;this.isAttr=!0;this.isTag=!1;this.__eventInitialized=!1;this.node=e,this.name=o.name,this.attrStructure=o.attrDynamics}updateValue(e){if(this.name==="ref"&&e.__wcRef){e.current=this.node;return}const o=this.node._$wompo;o&&this.node.updateProp(this.name,e);const n=e!==Object(e);if(e===!1||e===null||e===void 0)this.node.removeAttribute(this.name);else if(n&&(!this.name.match(/[A-Z]/)||this.node.nodeName==="svg"))this.node.setAttribute(this.name,e);else if(this.name==="style"){let t="";const a=Object.keys(e);for(const s of a){let i=e[s],p=s.replace(/[A-Z]/g,l=>"-"+l.toLowerCase());typeof i=="number"&&(i=`${i}px`),i!=null&&i!==!1&&(t+=`${p}:${i};`)}this.node.setAttribute(this.name,t)}this.name==="title"&&o&&this.node.removeAttribute(this.name)}set callback(e){if(!this.__eventInitialized){const o=this.name.substring(1);this.node.addEventListener(o,this.__listener.bind(this)),this.__eventInitialized=!0}this.__callback=e}__listener(e){this.__callback&&this.__callback(e)}}class U{constructor(e){this.isNode=!1;this.isAttr=!1;this.isTag=!0;this.node=e}}class q{constructor(e){this._$wompoChildren=!0;this.nodes=e}}class Z{constructor(e,o){this.isArrayDependency=!0;this.dynamics=[],this.__oldValues=[],this.__parentDependency=o,o.startNode.after(document.createComment("?wc-end")),this.addDependenciesFrom(o.startNode,e),this.__oldPureValues=e}addDependenciesFrom(e,o){let n=e;for(let t=0;t<o.length;t++){const a=o[t];n.after(document.createTextNode("")),n.after(document.createTextNode(""));const s=new v(n.nextSibling,n.nextSibling.nextSibling);n=n.nextSibling.nextSibling,this.dynamics.push(s),this.__oldValues.push(b([s],[a],[])[0])}}checkUpdates(e){if(e===this.__oldPureValues)return this;let o=e.length-this.__oldValues.length;if(o<0)for(;o;){const n=this.dynamics.pop();this.__oldValues.pop(),n.dispose(),o++}for(let n=0;n<this.dynamics.length;n++){const t=e[n],a=this.dynamics[n],s=this.__oldValues[n];this.__oldValues[n]=b([a],[t],[s])[0]}if(o>0){let n=this.dynamics[this.dynamics.length-1]?.endNode;n||(n=this.__parentDependency.startNode);for(let t=0;t<o;t++){const a=e[this.__oldValues.length+t];n.after(document.createTextNode("")),n.after(document.createTextNode(""));const s=new v(n.nextSibling,n.nextSibling.nextSibling);n=n.nextSibling.nextSibling,this.dynamics.push(s),this.__oldValues.push(b([s],[a],[]))}}return this.__oldPureValues=e,this}}const B=(r,e)=>{const{css:o}=r,{shadow:n,name:t,cssModule:a}=e,s=t,i={};let p=o;return a&&(o.includes(":host")||(p=`${n?":host":s} {display:block;} ${o}`),n||(p=p.replace(/:host/g,s)),p=p.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm,(l,c)=>{const d=`${s}__${c}`;return i[c]=d,`.${d}`})),[p,i]},K=r=>{let e="";const o=[],n=r.length-1;let t="",a="";for(let s=0;s<n;s++){let i=r[s];if(t&&i.includes(t)&&(t=""),a&&new RegExp(`</${a}>`)&&(a=""),t||a)e+=i+y;else{H.lastIndex=0;const p=H.exec(i);if(p){const[l,c]=p,d=l[l.length-1];t=d==='"'||d==="'"?d:"",i=i.substring(0,i.length-t.length-1);let u=`${i}${y}=`;t?u+=`${t}${y}`:u+='"0"',e+=u,o.push(c)}else{if(i.match(V)){e+=i+w;continue}D.lastIndex=0;const l=D.exec(i);l?(a=l[1],e+=i+y):e+=i+`<?${y}>`}}}return e+=r[r.length-1],e=e.replace(I,(s,i,p)=>s.endsWith("/>")?`${i}></${p}>`:s),e=e.replace(/<[a-z]*-[a-z]*\s?.*?>/gms,s=>s.replace(/\s([a-z]*[A-Z][a-z]*)[=\s]/gms,i=>i.replace(/[A-Z]/g,p=>`-${p.toLowerCase()}`))),[e,o]},G=(r,e,o)=>{const n=[];g.currentNode=r.content;let t,a=0,s=0;const i=e.length;for(;(t=g.nextNode())!==null&&n.length<i;){if(t.nodeType===1){if(t.nodeName===w.toUpperCase()){const p={type:$,index:s};n.push(p)}if(t.hasAttributes()){const p=t.getAttributeNames();for(const l of p)if(l.endsWith(y)){const c=o[a++],d=t.getAttribute(l);if(d!=="0"){const u=d.split(y);for(let m=0;m<u.length-1;m++){const h={type:C,index:s,attrDynamics:d,name:c};n.push(h)}}else{const u={type:C,index:s,name:c};n.push(u)}t.removeAttribute(l)}}if(L.test(t.tagName)){const p=t.textContent.split(y),l=p.length-1;if(l>0){t.textContent="";for(let c=0;c<l;c++)t.append(p[c],document.createComment("")),g.nextNode(),n.push({type:E,index:++s});t.append(p[l],document.createComment(""))}}}else t.nodeType===8&&t.data===`?${y}`&&n.push({type:E,index:s});s++}return n},P=r=>{const[e,o]=K(r.parts),n=document.createElement("template");n.innerHTML=e;const t=G(n,r.parts,o);return new z(n,t)},Y=(r,e)=>{if(!r||!e)return!1;const o=r.parts,n=e.parts;if(o.length!==n?.length)return!1;const t=r.values,a=e.values;for(let s=0;s<o.length;s++)if(o[s]!==n[s]||t[s]?._$wompoF&&(!a[s]?._$wompoF||t[s].componentName!==a[s].componentName))return!1;return!0},J=(r,e,o)=>{const n=r!==e,t=!!o.attrStructure,s=r?._$wompoChildren&&o.startNode.nextSibling!==r.nodes[0];return n||t||s},R=(r,e,o,n,t)=>{const a=e.node;let s=null;const i=r._$wompoF,p=i?r.componentName:r;if(a.nodeName!==p.toUpperCase()){const l=a.getAttributeNames();if(i){const u={};for(const h of l){const f=a.getAttribute(h);let _=h;_.includes("-")&&(_=_.replace(/-(.)/g,(k,M)=>M.toUpperCase())),u[_]=f===""?!0:f}s=new r.class,s._$initialProps=u,s.props=u;const m=a.childNodes;for(;m.length;)s.appendChild(m[0])}else{s=document.createElement(p);for(const u of l)s.setAttribute(u,a.getAttribute(u))}let c=o,d=n[c];for(;d?.node===a;)d.node=s,c===o?(c++,d=n[c]):(d?.name&&d?.name!=="ref"&&(s._$initialProps[d.name]=t[c],s.props[d.name]=t[c]),c++,d=n[c]);return a.replaceWith(s),s}},b=(r,e,o)=>{const n=[...e];for(let t=0;t<r.length;t++){const a=r[t],s=n[t],i=o[t];if(s?.__wcRef&&a.isAttr&&a.name==="ref"&&(s.current=a.node),!!J(s,i,a)){if(a.isNode){if(s===!1||s===void 0||s===null){a.clearValue();continue}if(s?._$wompoHtml){const d=Y(s,i);if(i===void 0||!d){const m=P(s).clone(),[h,f]=m;n[t]=new T(s,m),n[t].values=b(f,s.values,i?.values??i??[]);const _=a.startNode;a.clearValue();let k=_;for(;h.childNodes.length;)k.after(h.childNodes[0]),k=k.nextSibling}else{let u=i;if(!i.template){const k=P(s).clone();n[t]=new T(s,k),u=n[t]}const[m,h]=u.template,f=b(h,s.values,i.values);i.values=f,n[t]=i}continue}const p=s!==Object(s),l=i!==Object(i)&&i!==void 0,c=a.startNode;if(p)l?c.nextSibling?c.nextSibling.textContent=s:c.after(s):(a.clearValue(),c.after(s));else{let d=c.nextSibling,u=0,m=0;if(s._$wompoChildren){i&&!i?._$wompoChildren&&a.clearValue();const h=s.nodes;for(;m<h.length;){(!d||m===0)&&(d=c);const f=h[u];u++,d.after(f),d=d.nextSibling,m++}}else Array.isArray(s)&&(i?.isArrayDependency?n[t]=i.checkUpdates(s):(a.clearValue(),n[t]=new Z(s,a)))}}else if(a.isAttr)if(a.name.startsWith("@"))a.callback=s;else{const l=a.attrStructure;if(l){const c=l.split(y);let d=s;for(let u=0;u<c.length-1;u++)c[u]=`${c[u]}${d}`,t++,d=n[t];t--,a.updateValue(c.join("").trim())}else a.updateValue(s)}else if(a.isTag)if(s._$wompoLazy){const l=a.node,c=O(l);c&&(c.addSuspense?c.addSuspense(l):(c.loadingComponents=new Set,c.loadingComponents.add(l)),l.suspense=c),s().then(d=>{const u=R(d,a,t,r,e);c&&c.removeSuspense(l,u)});continue}else R(s,a,t,r,e)}}return n},Q=(r,e)=>{const{generatedCSS:o,styles:n}=r.options,t=new CSSStyleSheet;return t.replaceSync(o),class extends HTMLElement{constructor(){super();this._$wompo=!0;this.props={};this.hooks=[];this._$measurePerf=!1;this._$initialProps={};this._$usesContext=!1;this._$hasBeenMoved=!1;this._$layoutEffects=[];this.__updating=!1;this.__oldValues=[];this.__isInitializing=!0;this.__connected=!1;this.__disconnected=!1;this.__isInDOM=!1}static{this._$wompo=!0}static{this.componentName=e.name}static _$getOrCreateTemplate(i){return this._$cachedTemplate||(this._$cachedTemplate=P(i)),this._$cachedTemplate}connectedCallback(){if(this.__disconnected&&this.isConnected){this.__disconnected=!1;for(const i of this.hooks)i?.callback&&Promise.resolve().then(()=>{i.callback()})}this.__isInDOM=!0,!this.__connected&&this.isConnected&&this.__initElement()}disconnectedCallback(){this.__connected&&(this.__isInDOM=!1,Promise.resolve().then(()=>{if(this.__isInDOM)this._$hasBeenMoved=!0,this._$usesContext&&this.requestRender();else{this.onDisconnected(),this.__disconnected=!0;for(const i of this.hooks)i?.cleanupFunction&&i.cleanupFunction()}}))}onDisconnected(){}__initElement(){this.__ROOT=this,this.props={...this.props,...this._$initialProps,styles:n};const i=this.getAttributeNames();for(const u of i){let m=u;if(m.includes("-")&&(m=m.replace(/-(.)/g,(h,f)=>f.toUpperCase())),!this.props.hasOwnProperty(m)){const h=this.getAttribute(u);this.props[m]=h===""?!0:h}}const p=Object.keys(this._$initialProps);for(const u of p){const m=this._$initialProps[u];m!==Object(m)&&(m||m===0)&&u!=="title"&&this.setAttribute(u.replace(/[A-Z]/g,h=>`-${h.toLowerCase()}`),m.toString())}const l=this.__ROOT.childNodes,c=[];for(;l.length;)c.push(l[0]),l[0].remove();const d=new q(c);this.props.children=d,e.shadow&&!this.shadowRoot&&(this.__ROOT=this.attachShadow({mode:"open"})),e.shadow?this.__ROOT.adoptedStyleSheets=[t]:this.getRootNode().adoptedStyleSheets.push(t),this.__render(),this.__isInitializing=!1,this.__connected=!0,new MutationObserver(u=>{this.__updating||u.forEach(m=>{if(!F.includes(m.attributeName)){let h=m.attributeName;h.includes("-")&&(h=h.replace(/-(.)/g,(f,_)=>_.toUpperCase())),this.updateProp(h,this.getAttribute(m.attributeName))}})}).observe(this,{attributes:!0})}__callComponent(){x=this,S=0;const i=r.call(this,this.props);let p=i;return(typeof i=="string"||i instanceof HTMLElement)&&(p=html`${i}`),p}__render(){try{const i=this.__callComponent();if(i==null){this.remove();return}const p=this.constructor;if(this.__isInitializing){const l=p._$getOrCreateTemplate(i),[c,d]=l.clone();this.__dynamics=d;const u=b(this.__dynamics,i.values,this.__oldValues);for(this.__oldValues=u,this.__isInitializing||(this.__ROOT.innerHTML="");c.childNodes.length;)this.__ROOT.appendChild(c.childNodes[0])}else{const l=b(this.__dynamics,i.values,this.__oldValues);this.__oldValues=l}for(;this._$layoutEffects.length;){const l=this._$layoutEffects.pop();l.cleanupFunction=l.callback()}}catch(i){console.error(i)}}requestRender(){this.__updating||(this.__updating=!0,Promise.resolve().then(()=>{this.__render(),this.__updating=!1,this._$hasBeenMoved=!1}))}updateProp(i,p){this.props[i]!==p&&(this.props[i]=p,this.__isInitializing||this.requestRender())}}};export const useHook=()=>{const o=[x,S];return S++,o},useState=r=>{const[e,o]=useHook();if(!e)return typeof r=="function"?[r(),()=>{}]:[r,()=>{}];if(!e.hooks.hasOwnProperty(o)){const t=o;e.hooks[t]=[typeof r=="function"?r():r,a=>{let s=a;const i=e.hooks[t];typeof a=="function"&&(s=a(i[0])),s!==i[0]&&(i[0]=s,e.requestRender())}]}return e.hooks[o]},useEffect=(r,e=null)=>{const[o,n]=useHook();if(o.hooks.hasOwnProperty(n)){const t=o.hooks[n];if(e!==null){for(let a=0;a<e.length;a++)if(t.dependencies[a]!==e[a]){typeof t.cleanupFunction=="function"&&t.cleanupFunction(),Promise.resolve().then(()=>{t.cleanupFunction=r(),t.dependencies=e});break}}else Promise.resolve().then(()=>{t.cleanupFunction=r(),t.dependencies=e})}else{const t={dependencies:e,callback:r,cleanupFunction:null};o.hooks[n]=t,Promise.resolve().then(()=>{t.cleanupFunction=r()})}},useLayoutEffect=(r,e=null)=>{const[o,n]=useHook();if(o.hooks.hasOwnProperty(n)){const t=o.hooks[n];if(e!==null){for(let a=0;a<e.length;a++)if(t.dependencies[a]!==e[a]){typeof t.cleanupFunction=="function"&&t.cleanupFunction(),t.dependencies=e,t.callback=r,o._$layoutEffects.push(t);break}}else o._$layoutEffects.push(t)}else{const t={dependencies:e,callback:r,cleanupFunction:null};o.hooks[n]=t,o._$layoutEffects.push(t)}},useRef=(r=null)=>{const[e,o]=useHook();return e.hooks.hasOwnProperty(o)||(e.hooks[o]={current:r,__wcRef:!0}),e.hooks[o]},useCallback=(r,e=[])=>{const[o,n]=useHook();if(!o.hooks.hasOwnProperty(n))o.hooks[n]={dependencies:e,value:r};else{const a=o.hooks[n];for(let s=0;s<e.length;s++)if(a.dependencies[s]!==e[s]){a.dependencies=e,a.value=r;break}}return o.hooks[n].value};const X=()=>{let r=0;return()=>{const[e,o]=useHook();return e.hooks.hasOwnProperty(o)||(e.hooks[o]=`:w${r}:`,r++),e.hooks[o]}};export const useId=X(),useMemo=(r,e)=>{const[o,n]=useHook();if(!o.hooks.hasOwnProperty(n))o.hooks[n]={value:r(),dependencies:e};else{const a=o.hooks[n];for(let s=0;s<e.length;s++)if(a.dependencies[s]!==e[s]){a.dependencies=e,a.value=r();break}}return o.hooks[n].value},useReducer=(r,e)=>{const[o,n]=useHook(),t=n;if(!o.hooks.hasOwnProperty(t)){const i=[e,p=>{const l=o.hooks[t][0],c=r(l,p);let d=c;typeof l=="object"&&!Array.isArray(l)&&l!==null&&(d={...l,...c}),o.hooks[n][0]=d,d!==l&&o.requestRender()}];o.hooks[n]=i}return o.hooks[n]},useExposed=r=>{const e=x,o=Object.keys(r);for(const n of o)e[n]=r[n]};const A=(r,e,o)=>{const[n,t]=r;e&&e.addSuspense(n),n.hooks[t].value=null,o().then(s=>{n.requestRender(),e?.removeSuspense(n),n.hooks[t].value=s}).catch(s=>console.error(s))};export const useAsync=(r,e)=>{const[o,n]=useHook(),t=O(o);if(!o.hooks.hasOwnProperty(n))o.hooks[n]={dependencies:e,value:null},A([o,n],t,r);else{const a=o.hooks[n];let s=!1;for(let i=0;i<e.length;i++)if(a.dependencies[i]!==e[i]){a.dependencies=e,s=!0;break}s&&A([o,n],t,r)}return o.hooks[n].value};const ee=()=>{let r=0;return e=>{const o=`wompo-context-provider-${r}`;r++;const n=defineWompo(({children:a})=>{const i=useRef(new Set);return useExposed({subscribers:i}),i.current.forEach(p=>p.requestRender()),html`${a}`},{name:o,cssModule:!1});return{name:o,Provider:n,default:e,subscribers:new Set}}};export const createContext=ee(),useContext=r=>{const[e,o]=useHook();if(e._$usesContext=!0,!e.hooks.hasOwnProperty(o)||e._$hasBeenMoved){let t=e;const a=r.name.toUpperCase();for(;t&&t.nodeName!==a&&t!==document.body;)t instanceof ShadowRoot?t=t.host:t=t.parentNode;const s=e.hooks[o]?.node;if(t&&t!==document.body){t.subscribers.current.add(e);const i=e.onDisconnected;e.onDisconnected=()=>{t.subscribers.current.delete(e),i()}}else s&&s.subscribers.current.delete(e);e.hooks[o]={node:t}}const n=e.hooks[o].node;return n?n.props.value:r.default};export function html(r,...e){const o=[],n=r.length-1;if(N)o.push(...e);else for(let t=0;t<n;t++)r[t].endsWith("</")||o.push(e[t]);return{parts:r,values:o,_$wompoHtml:!0}}export const wompoDefaultOptions={shadow:!1,name:"",cssModule:!0},registeredComponents={};export function defineWompo(r,e){r.css||(r.css="");const o={...wompoDefaultOptions,...e||{}};if(!o.name){let a=r.name.replace(/.[A-Z]/g,s=>`${s[0]}-${s[1].toLowerCase()}`).toLowerCase();a.includes("-")||(a+="-wompo"),o.name=a}r.componentName=o.name,r._$wompoF=!0;const[n,t]=B(r,o);if(r.css=n,r.options={generatedCSS:n,styles:t,shadow:o.shadow},!N){const a=Q(r,o);r.class=a,customElements.define(o.name,a)}return registeredComponents[o.name]=r,r}export const lazy=r=>{let e=null;async function o(){if(!e)try{return e=(await r()).default,e}catch(n){return console.error(n),te}return e}return o._$wompoLazy=!0,o};const O=r=>{let e=r;for(;e&&e.nodeName!==Suspense.componentName.toUpperCase();)e.parentNode===null&&e.host?e=e.host:e=e?.parentNode;return e};let te;export function Suspense({children:r,fallback:e}){return this.loadingComponents||(this.loadingComponents=useRef(new Set).current),this.addSuspense=o=>{this.loadingComponents.size||this.requestRender(),this.loadingComponents.add(o)},this.removeSuspense=(o,n=null)=>{if(this.loadingComponents.delete(o),n){for(let t=0;t<r.nodes.length;t++)if(r.nodes[t]===o){r.nodes[t]=n;break}}this.loadingComponents.size||this.requestRender()},this.loadingComponents.size?html`${e}`:html`${r}`}defineWompo(Suspense,{name:"wompo-suspense"});
//# sourceMappingURL=wompo.js.map
