const te=!0;let $=null,x=0;const f="$wc$",D="wc-wc",I=/<\/?$/g,H=/\s+([^\s]*?)="?$/g,L=/(<([a-z]*?-[a-z]*).*?)\/>/gs,v=/<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi,V=/^(?:script|style|textarea|title)$/i,C=0,S=1,w=2,N=typeof global<"u",P=N?{createTreeWalker(){}}:document,y=P.createTreeWalker(P,129);class F{constructor(e,t){this.template=e,this.dependencies=t}clone(){const e=this.template.content,t=this.dependencies,s=document.importNode(e,!0);y.currentNode=s;let n=y.nextNode(),i=0,a=0,r=t[0];const c=[];for(;r!==void 0;){if(i===r.index){let l;const d=r.type;d===C?l=new T(n,n.nextSibling):d===S?l=new j(n,r):d===w&&(l=new q(n)),c.push(l),r=t[++a]}i!==r?.index&&(n=y.nextNode(),i++)}return y.currentNode=document,[s,c]}}class z{constructor(e,t){this.values=e.values,this.parts=e.parts,this.template=t}}class T{constructor(e,t){this.isNode=!0;this.isAttr=!1;this.isTag=!1;this.startNode=e,this.endNode=t}clearValue(){let e=this.startNode.nextSibling;for(;e!==this.endNode;)e.remove(),e=this.startNode.nextSibling}dispose(){this.clearValue(),this.startNode.remove(),this.endNode.remove()}}class j{constructor(e,t){this.isNode=!1;this.isAttr=!0;this.isTag=!1;this.__eventInitialized=!1;this.node=e,this.name=t.name,this.attrStructure=t.attrDynamics}updateValue(e){if(this.name==="ref"&&e.__wcRef){if(e.current=this.node,this.node._$womp){const n=this.node.onDisconnected;this.node.onDisconnected=()=>{e.current=null,n()}}return}this.name==="wc-perf"&&(this.node._$measurePerf=!0);const t=this.node._$womp;t&&this.node.updateProps(this.name,e);const s=e!==Object(e);if(e===!1)this.node.removeAttribute(this.name);else if(s&&(!this.name.match(/[A-Z]/)||this.node.nodeName==="svg"))this.node.setAttribute(this.name,e);else if(this.name==="style"){let n="";const i=Object.keys(e);for(const a of i){let r=e[a],c=a.replace(/[A-Z]/g,l=>"-"+l.toLowerCase());typeof r=="number"&&(r=`${r}px`),n+=`${c}:${r};`}this.node.setAttribute(this.name,n)}this.name==="title"&&t&&this.node.removeAttribute(this.name)}set callback(e){if(!this.__eventInitialized){const t=this.name.substring(1);this.node.addEventListener(t,this.__listener.bind(this)),this.__eventInitialized=!0}this.__callback=e}__listener(e){this.__callback&&this.__callback(e)}}class q{constructor(e){this.isNode=!1;this.isAttr=!1;this.isTag=!0;this.node=e}}class U{constructor(e){this._$wompChildren=!0;this.nodes=e}}class B{constructor(e,t){this.isArrayDependency=!0;this.dynamics=[],this.__parentDependency=t,this.addDependenciesFrom(t.startNode,e.length),this.__oldValues=k(this.dynamics,e,[])}addDependenciesFrom(e,t){let s=e,n=t;for(;n;){const i=document.createComment("?START"),a=document.createComment("?END");s.after(i),i.after(a);const r=new T(i,a);s=a,this.dynamics.push(r),n--}}checkUpdates(e){let t=e.length-this.__oldValues.length;if(t>0){let s=this.dynamics[this.dynamics.length-1]?.endNode;s||(s=this.__parentDependency.startNode),this.addDependenciesFrom(s,t)}else if(t<0)for(;t;)this.dynamics.pop().dispose(),t++;return this.__oldValues=k(this.dynamics,e,this.__oldValues),this}}const Z=(o,e)=>{const{css:t}=o,{shadow:s,name:n,cssModule:i}=e,a=n,r={};let c=t;if(i){t.includes(":host")||(c=`${s?":host":a} {display:block;} ${t}`);{const l=[];[...c.matchAll(/.*?}([\s\S]*?){/gm)].forEach(d=>{const p=d[1].trim();p.match(/\.|:host|@/)||l.push(p)}),l.forEach(d=>{console.warn(`The CSS selector "${d} {...}" in the component "${a}" is not enough specific: include at least one class or deactive the "cssModule" option on the component.`)})}s||(c=c.replace(/:host/g,a)),c=c.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm,(l,d)=>{const p=`${a}__${d}`;return r[d]=p,`.${p}`})}return[c,r]},K=o=>{let e="";const t=[],s=o.length-1;let n="",i="";for(let a=0;a<s;a++){let r=o[a];if(n&&r.includes(n)&&(n=""),i&&new RegExp(`</${i}>`)&&(i=""),n||i)e+=r+f;else{H.lastIndex=0;const c=H.exec(r);if(c){const[l,d]=c,p=l[l.length-1];n=p==='"'||p==="'"?p:"",r=r.substring(0,r.length-n.length-1);let m=`${r}${f}=`;n?m+=`${n}${f}`:m+='"0"',e+=m,t.push(d)}else{if(r.match(I)){e+=r+D;continue}v.lastIndex=0;const l=v.exec(r);l?(i=l[1],e+=r+f):e+=r+`<?${f}>`}}}return e+=o[o.length-1],e=e.replace(L,"$1></$2>"),[e,t]},G=(o,e,t)=>{const s=[];y.currentNode=o.content;let n,i=0,a=0;const r=e.length;for(;(n=y.nextNode())!==null&&s.length<r;){if(n.nodeType===1){if(n.nodeName===D.toUpperCase()){const c={type:w,index:a};s.push(c)}if(n.hasAttributes()){const c=n.getAttributeNames();for(const l of c)if(l.endsWith(f)){const d=t[i++],p=n.getAttribute(l);if(p!=="0"){const m=p.split(f);for(let u=0;u<m.length-1;u++){const h={type:S,index:a,attrDynamics:p,name:d};s.push(h)}}else{const m={type:S,index:a,name:d};s.push(m)}n.removeAttribute(l)}}if(V.test(n.tagName)){const c=n.textContent.split(f),l=c.length-1;if(l>0){n.textContent="";for(let d=0;d<l;d++)n.append(c[d],document.createComment("")),y.nextNode(),s.push({type:C,index:++a});n.append(c[l],document.createComment(""))}}}else n.nodeType===8&&n.data===`?${f}`&&s.push({type:C,index:a});a++}return s},W=o=>{const[e,t]=K(o.parts),s=document.createElement("template");s.innerHTML=e;const n=G(s,o.parts,t);return new F(s,n)},Y=(o,e)=>{if(!o||!e)return!1;const t=o.parts,s=e.parts;if(t.length!==s?.length)return!1;const n=o.values,i=e.values;for(let a=0;a<t.length;a++)if(t[a]!==s[a]||n[a]?._$wompF&&(!i[a]?._$wompF||n[a].componentName!==i[a].componentName))return!1;return!0},J=(o,e,t)=>{const s=o!==e,n=!!t.attrStructure,a=o?._$wompChildren&&t.startNode.nextSibling!==o.nodes[0];return s||n||a},R=(o,e,t,s,n)=>{const i=e.node;let a=null;const r=o._$wompF,c=r?o.componentName:o;if(i.nodeName!==c.toUpperCase()){const l=i.getAttributeNames();if(r){const m={};for(const h of l){const g=i.getAttribute(h);m[h]=g===""?!0:g}a=new o.class,a._$initialProps=m;const u=i.childNodes;for(;u.length;)a.appendChild(u[0])}else{a=document.createElement(c);for(const m of l)a.setAttribute(m,i.getAttribute(m))}let d=t,p=s[d];for(;p?.node===i;)p.node=a,p=s[++d],p?.name&&p?.name!=="ref"&&(a._$initialProps[p.name]=n[d]);return i.replaceWith(a),a}},k=(o,e,t)=>{const s=[...e];for(let n=0;n<o.length;n++){const i=o[n],a=s[n],r=t[n];if(J(a,r,i)){if(i.isNode){if(a===!1||a===void 0||a===null){i.clearValue();continue}if(a?._$wompHtml){const p=Y(a,r);if(r===void 0||!p){const u=W(a).clone(),[h,g]=u;s[n]=new z(a,u),k(g,a.values,r?.values??r??[]);const O=i.endNode,E=i.startNode;let _=E.nextSibling;for(;_!==O;)_.remove(),_=E.nextSibling;for(_=E;h.childNodes.length;)_.after(h.childNodes[0]),_=_.nextSibling}else{const[m,u]=r.template,h=k(u,a.values,r.values);r.values=h,s[n]=r}continue}const c=a!==Object(a),l=r!==Object(r)&&r!==void 0,d=i.startNode;if(c)l?d.nextSibling?d.nextSibling.textContent=a:d.after(a):(i.clearValue(),d.after(a));else{let p=d.nextSibling,m=0,u=0;if(a._$wompChildren){const h=a.nodes;for(;u<h.length;){(!p||u===0)&&(p=d);const g=h[m];m++,p.after(g),p=p.nextSibling,u++}}else if(Array.isArray(a))r?.isArrayDependency?s[n]=r.checkUpdates(a):(i.clearValue(),s[n]=new B(a,i));else throw new Error("Rendering objects is not supported. Please stringify or remove the object.")}}else if(i.isAttr)if(i.name.startsWith("@"))i.callback=a;else{const l=i.attrStructure;if(l){const d=l.split(f);let p=a;for(let m=0;m<d.length-1;m++)d[m]=`${d[m]}${p}`,n++,p=s[n];n--,i.updateValue(d.join("").trim())}else i.updateValue(a)}else if(i.isTag)if(a._$wompLazy){const l=i.node,d=M(l);d&&(d.addSuspense?d.addSuspense(l):(d.loadingComponents=new Set,d.loadingComponents.add(l)),l.suspense=d),a().then(p=>{const m=R(p,i,n,o,e);d&&d.removeSuspense(l,m)});continue}else R(a,i,n,o,e)}}return s},Q=(o,e)=>{const{generatedCSS:t,styles:s}=o.options;let n;const i=`${e.name}__styles`;return window.wompHydrationData?(n=document.createElement("link"),n.rel="stylesheet",n.href=`/${e.name}.css`):(n=document.createElement("style"),t&&(n.classList.add(i),n.textContent=t)),class extends HTMLElement{constructor(){super();this._$womp=!0;this.props={};this._$hooks=[];this._$measurePerf=!1;this._$initialProps={};this._$usesContext=!1;this._$hasBeenMoved=!1;this._$layoutEffects=[];this.__updating=!1;this.__oldValues=[];this.__isInitializing=!0;this.__connected=!1;this.__isInDOM=!1}static{this._$womp=!0}static{this.componentName=e.name}static _$getOrCreateTemplate(c){return this._$cachedTemplate||(this._$cachedTemplate=W(c)),this._$cachedTemplate}connectedCallback(){this.__isInDOM=!0,!this.__connected&&this.isConnected&&this.initElement()}disconnectedCallback(){this.__connected&&(this.__isInDOM=!1,Promise.resolve().then(()=>{if(this.__isInDOM)this._$hasBeenMoved=!0,this._$usesContext&&this.requestRender();else{this.onDisconnected();for(const c of this._$hooks)c?.cleanupFunction&&c.cleanupFunction()}}))}onDisconnected(){}initElement(){this.__ROOT=this,this.props={...this.props,...this._$initialProps,styles:s};const c=this.getAttributeNames();for(const m of c)if(!this.props.hasOwnProperty(m)){const u=this.getAttribute(m);this.props[m]=u===""?!0:u}this.props["wc-perf"]&&(this._$measurePerf=!0),this._$measurePerf&&console.time("First render "+e.name);const l=this.__ROOT.childNodes,d=[];for(;l.length;)d.push(l[0]),l[0].remove();const p=new U(d);if(this.props.children=p,e.shadow&&!this.shadowRoot&&(this.__ROOT=this.attachShadow({mode:"open"})),t){const m=n.cloneNode(!0);this.__ROOT.appendChild(m)}this.__render(),this.__isInitializing=!1,this.__connected=!0,this._$measurePerf&&console.timeEnd("First render "+e.name)}__callComponent(){$=this,x=0;const c=o.call(this,this.props);let l=c;return(typeof c=="string"||c instanceof HTMLElement)&&(l=html`${c}`),l}__render(){try{const c=this.__callComponent();if(c==null){this.remove();return}const l=this.constructor;if(this.__isInitializing){const d=l._$getOrCreateTemplate(c),[p,m]=d.clone();this.__dynamics=m;const u=k(this.__dynamics,c.values,this.__oldValues);for(this.__oldValues=u,this.__isInitializing||(this.__ROOT.innerHTML="");p.childNodes.length;)this.__ROOT.appendChild(p.childNodes[0])}else{const d=k(this.__dynamics,c.values,this.__oldValues);this.__oldValues=d}for(;this._$layoutEffects.length;){const d=this._$layoutEffects.pop();d.cleanupFunction=d.callback()}}catch(c){console.error(c);{const l=new b.class;l.props.error=c,l.props.element=this,this.__ROOT.innerHTML="",this.__ROOT.appendChild(l)}}}requestRender(){this.__updating||(this.__updating=!0,Promise.resolve().then(()=>{this._$measurePerf&&console.time("Re-render "+e.name),this.__render(),this.__updating=!1,this._$hasBeenMoved=!1,this._$measurePerf&&console.timeEnd("Re-render "+e.name)}))}updateProps(c,l){this.props[c]!==l&&(this.props[c]=l,this.__isInitializing||this.requestRender())}}};export const useHook=()=>{const t=[$,x];return x++,t},useState=o=>{const[e,t]=useHook();if(!e)return[o,()=>{}];if(!e._$hooks.hasOwnProperty(t)){const n=t;e._$hooks[n]=[o,i=>{let a=i;const r=e._$hooks[n];typeof i=="function"&&(a=i(r[0])),a!==r[0]&&(r[0]=a,e.requestRender())}]}return e._$hooks[t]},useEffect=(o,e=null)=>{const[t,s]=useHook();if(t._$hooks.hasOwnProperty(s)){const n=t._$hooks[s];if(e!==null){for(let i=0;i<e.length;i++)if(n.dependencies[i]!==e[i]){typeof n.cleanupFunction=="function"&&n.cleanupFunction(),Promise.resolve().then(()=>{n.cleanupFunction=o(),n.dependencies=e});break}}else Promise.resolve().then(()=>{n.cleanupFunction=o(),n.dependencies=e})}else{const n={dependencies:e,callback:o,cleanupFunction:null};t._$hooks[s]=n,Promise.resolve().then(()=>{n.cleanupFunction=o()})}},useLayoutEffect=(o,e=null)=>{const[t,s]=useHook();if(t._$hooks.hasOwnProperty(s)){const n=t._$hooks[s];if(e!==null){for(let i=0;i<e.length;i++)if(n.dependencies[i]!==e[i]){typeof n.cleanupFunction=="function"&&n.cleanupFunction(),n.dependencies=e,n.callback=o,t._$layoutEffects.push(n);break}}else t._$layoutEffects.push(n)}else{const n={dependencies:e,callback:o,cleanupFunction:null};t._$hooks[s]=n,t._$layoutEffects.push(n)}},useRef=(o=null)=>{const[e,t]=useHook();return e._$hooks.hasOwnProperty(t)||(e._$hooks[t]={current:o,__wcRef:!0}),e._$hooks[t]},useCallback=o=>{const[e,t]=useHook();return e._$hooks.hasOwnProperty(t)||(e._$hooks[t]=o),e._$hooks[t]};const X=()=>{let o=0;return()=>{const[e,t]=useHook();return e._$hooks.hasOwnProperty(t)||(e._$hooks[t]=`:r${o}:`,o++),e._$hooks[t]}};export const useId=X(),useMemo=(o,e)=>{const[t,s]=useHook();if(!t._$hooks.hasOwnProperty(s))t._$hooks[s]={value:o(),dependencies:e};else{const i=t._$hooks[s];for(let a=0;a<e.length;a++)if(i.dependencies[a]!==e[a]){i.dependencies=e,i.value=o();break}}return t._$hooks[s].value},useReducer=(o,e)=>{const[t,s]=useHook(),n=s;if(!t._$hooks.hasOwnProperty(n)){const r=[e,c=>{const l=t._$hooks[n][0],d=o(l,c),p=Object.keys(d);for(const u of p)if(d[u]!==l[u]){t.requestRender();break}const m={...l,...d};t._$hooks[s][0]=m}];t._$hooks[s]=r}return t._$hooks[s]},useExposed=o=>{const e=$,t=Object.keys(o);for(const s of t)e[s]=o[s]};const A=(o,e,t)=>{const[s,n]=o;e&&e.addSuspense(s),s._$hooks[n].value=null,t().then(a=>{s.requestRender(),e.removeSuspense(s),s._$hooks[n].value=a}).catch(a=>console.error(a))};export const useAsync=(o,e)=>{const[t,s]=useHook(),n=M(t);if(!t._$hooks.hasOwnProperty(s))t._$hooks[s]={dependencies:e,value:null},A([t,s],n,o);else{const i=t._$hooks[s];let a=!1;for(let r=0;r<e.length;r++)if(i.dependencies[r]!==e[r]){i.dependencies=e,a=!0;break}a&&A([t,s],n,o)}return t._$hooks[s].value};const ee=()=>{let o=0;return e=>{const t=`womp-context-provider-${o}`;o++;const s=defineWomp(({children:i})=>{const r=useRef(new Set);return useExposed({subscribers:r}),r.current.forEach(c=>c.requestRender()),html`${i}`},{name:t,cssModule:!1});return{name:t,Provider:s,default:e,subscribers:new Set}}};export const createContext=ee(),useContext=o=>{const[e,t]=useHook();if(e._$usesContext=!0,!e._$hooks.hasOwnProperty(t)||e._$hasBeenMoved){let n=e;const i=o.name.toUpperCase();for(;n&&n.nodeName!==i&&n!==document.body;)n instanceof ShadowRoot?n=n.host:n=n.parentNode;const a=e._$hooks[t]?.node;if(n&&n!==document.body){n.subscribers.current.add(e);const r=e.onDisconnected;e.onDisconnected=()=>{n.subscribers.current.delete(e),r()}}else a?(console.warn(`The element ${e.tagName} doens't have access to the Context ${o.name} because is no longer a child of it.`),a.subscribers.current.delete(e)):e.isConnected&&console.warn(`The element ${e.tagName} doens't have access to the Context ${o.name}. The default value will be returned instead.`);e._$hooks[t]={node:n}}const s=e._$hooks[t].node;return s?s.props.value:o.default};export function html(o,...e){const t=[],s=o.length-1;if(N)t.push(...e);else for(let n=0;n<s;n++)o[n].endsWith("</")||t.push(e[n]);return{parts:o,values:t,_$wompHtml:!0}}export const wompDefaultOptions={shadow:!1,name:"",cssModule:!0},registeredComponents={};export function defineWomp(o,e){o.css||(o.css="");const t={...wompDefaultOptions,...e||{}};if(!t.name){let i=o.name.replace(/.[A-Z]/g,a=>`${a[0]}-${a[1].toLowerCase()}`).toLowerCase();i.includes("-")||(i+="-womp"),t.name=i}o.componentName=t.name,o._$wompF=!0;const[s,n]=Z(o,t);if(o.css=s,o.options={generatedCSS:s,styles:n,shadow:t.shadow},!N){const i=Q(o,t);o.class=i,customElements.define(t.name,i)}return registeredComponents[t.name]=o,o}export const lazy=o=>{let e=null;async function t(){if(!e)try{return e=(await o()).default,e}catch(s){return console.error(s),b}return e}return t._$wompLazy=!0,t};const M=o=>{let e=o;for(;e&&e.nodeName!==Suspense.componentName.toUpperCase();)e.parentNode===null&&e.host?e=e.host:e=e?.parentNode;return e};let b;b=function({styles:o,error:e,element:t}){let s;return t&&e?s=html`<div>
				<p>An error rised while rendering the element "${t.nodeName.toLowerCase()}".</p>
				<p>${e.stack.split(`
`).map(n=>html`${n}<br />`)}</p>
			</div>`:s=html`<div>
				<p>An error rised while rendering. Check the developer console for more details.</p>
			</div>`,html`${s}`},b.css=`
		:host {
			display: block;
			padding: 20px;
			background-color: #ffd0cf;
			color: #a44040;
			margin: 20px;
			border-left: 3px solid #a44040;
		}
	`,defineWomp(b,{name:"womp-error",shadow:!0});export function Suspense({children:o,fallback:e}){return this.loadingComponents||(this.loadingComponents=useRef(new Set).current),this.addSuspense=t=>{this.loadingComponents.size||this.requestRender(),this.loadingComponents.add(t)},this.removeSuspense=(t,s=null)=>{if(this.loadingComponents.delete(t),s){for(let n=0;n<o.nodes.length;n++)if(o.nodes[n]===t){o.nodes[n]=s;break}}this.loadingComponents.size||this.requestRender()},this.loadingComponents.size?html`${e}`:html`${o}`}defineWomp(Suspense,{name:"womp-suspense"});
