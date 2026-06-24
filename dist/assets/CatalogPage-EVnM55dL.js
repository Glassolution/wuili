import{e as l,j as e}from"./vendor-react-DNIqRoEp.js";import{b as ke,c as et,u as tt}from"./vendor-query-DEHbxmQ5.js";import{S as T}from"./skeleton-mCUjOYTS.js";import{u as at,s as E,v as S,c as F,a as ot}from"./index-DWI03nT3.js";import{I as st}from"./ImportProductModal-BnYNSNT7.js";import{P as rt}from"./PlatformLogo-CPhEvGVK.js";import{U as it}from"./UpgradeLimitModal-B6u3dr18.js";import{u as ze}from"./usePlanLimits-BBx_LeN1.js";import{al as nt,b1 as _e,aR as lt,aS as ct,L as dt,aT as pt,am as q,aM as Ce,az as gt,aD as mt,r as G,aI as xt,s as Q,aB as ut,t as ue,u as fe,e as ft,_ as ht}from"./vendor-icons-DbTOU4Kb.js";import{R as bt,P as yt,a as Se,C as jt,T as Me,O as Ie,D as Pe}from"./vendor-radix-CsMb8Ol-.js";import"./vendor-DPn51GtS.js";import"./vendor-motion-DrVtW0kb.js";import"./vendor-supabase-gY-fnrCA.js";import"./useStartMode-CP7eHsUi.js";import"./usePlan-BvV7JgCr.js";import"./FirstStoreOnboarding-D-Lqilyy.js";const he=[{id:"mercadolivre",name:"Mercado Livre",subtitle:"Integração disponível",section:"available"},{id:"shopee",name:"Shopee",subtitle:"Disponível em breve",section:"coming_soon"},{id:"amazon",name:"Amazon",subtitle:"Disponível em breve",section:"coming_soon"},{id:"shopify",name:"Shopify",subtitle:"Disponível em breve",section:"coming_soon"}],vt=({on:a,onChange:s,disabled:o=!1})=>e.jsx("button",{onClick:s,disabled:o,title:o?"Disponível em breve":void 0,className:`relative h-6 w-11 rounded-full transition-colors ${o?"cursor-not-allowed bg-gray-200 opacity-60 dark:bg-zinc-800":a?"bg-green-500":"bg-gray-200 dark:bg-zinc-700"}`,children:e.jsx("span",{className:`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${a?"left-5":"left-0.5"}`})}),be=({name:a})=>e.jsx("div",{className:"flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 dark:border-white/10 dark:bg-white",children:e.jsx(rt,{platform:a,size:40})}),wt=({open:a,onClose:s})=>{const{user:o}=at(),r=ze(),[p,f]=l.useState(!1),[g,y]=l.useState(!1),[i,j]=l.useState(!1);l.useEffect(()=>{!a||!o||(y(!0),E.from("user_integrations").select("access_token").eq("user_id",o.id).eq("platform","mercadolivre").maybeSingle().then(({data:n})=>f(!!(n!=null&&n.access_token))).finally(()=>y(!1)))},[a,o]);const m=async()=>{if(!o)return;if(!r.loading&&!p&&!r.canConnectMarketplace){j(!0);return}const{data:n,error:A}=await E.functions.invoke("ml-connect"),M=(n==null?void 0:n.authUrl)??(n==null?void 0:n.auth_url);if(A||!M){S.error("Não foi possível iniciar a conexão com o Mercado Livre");return}window.location.href=M},v=async()=>{if(!o)return;const{error:n}=await E.from("user_integrations").delete().eq("user_id",o.id).eq("platform","mercadolivre");if(n){S.error("Não foi possível desconectar o Mercado Livre");return}f(!1),r.refreshUsage(),S.success("Mercado Livre desconectado")};if(!a)return null;const x=he.filter(n=>n.section==="available"),k=he.filter(n=>n.section==="coming_soon"),u=r.plan==="pro"?"business":"pro",_=u==="business"?["Marketplaces ilimitados","Produtos ilimitados","Analytics premium","Processamento prioritário"]:["Até 2 marketplaces","Publicação automática","Monitoramento básico 24h","Suporte prioritário"];return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40",onClick:s}),e.jsxs("div",{className:"relative w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-start justify-between p-6 pb-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",children:e.jsx(nt,{size:20})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-base font-bold text-foreground",children:"Integração de Plataformas"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Conecte suas plataformas de venda."})]})]}),e.jsx("button",{onClick:s,className:"text-muted-foreground hover:text-foreground transition-colors",children:e.jsx(_e,{size:18})})]}),e.jsxs("div",{className:"px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto",style:{scrollbarWidth:"none"},children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Disponível"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:x.map(n=>e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded-xl border border-border p-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(be,{name:n.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:n.name}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:n.subtitle})]})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p?"bg-green-100 text-green-700":"bg-muted text-muted-foreground"}`,children:g?"Verificando...":p?"Conectado":"Desconectado"}),e.jsx("button",{onClick:p?v:m,disabled:g,className:"rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black",children:p?"Desconectar":"Conectar"})]})]},n.id))})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Em breve"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:k.map(n=>e.jsxs("div",{title:"Disponível em breve",className:"flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-3",children:[e.jsx(be,{name:n.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold text-foreground",children:n.name}),e.jsx("p",{className:"truncate text-[10px] text-muted-foreground",children:n.subtitle})]})]}),e.jsxs("div",{className:"flex shrink-0 items-center gap-2",children:[e.jsx("span",{className:"rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground",children:"Em breve"}),e.jsx(vt,{on:!1,onChange:()=>{},disabled:!0})]})]},n.id))})]})]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-border px-6 py-4",children:[e.jsxs("p",{className:"text-xs text-muted-foreground",children:["Saiba mais sobre"," ",e.jsx("a",{href:"#",className:"text-foreground underline underline-offset-2 hover:text-muted-foreground",children:"Plataformas"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:s,className:"text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors",children:"Cancelar"}),e.jsx("button",{onClick:s,className:"btn-primary btn-primary--md",children:"Concluir"})]})]})]}),e.jsx(it,{open:i,onClose:()=>j(!1),title:"Limite de marketplaces atingido",message:"Seu plano atual não permite conectar outro marketplace. Faça upgrade para liberar mais integrações.",cta:u==="business"?"Upgrade Business":"Desbloquear operação completa",targetPlan:u,benefits:_})]})},Nt=bt,kt=yt,De=l.forwardRef(({className:a,...s},o)=>e.jsx(Ie,{ref:o,className:F("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",a),...s}));De.displayName=Ie.displayName;const Le=l.forwardRef(({className:a,children:s,...o},r)=>e.jsxs(kt,{children:[e.jsx(De,{}),e.jsxs(Se,{ref:r,className:F("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",a),...o,children:[s,e.jsxs(jt,{className:"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",children:[e.jsx(_e,{className:"h-4 w-4"}),e.jsx("span",{className:"sr-only",children:"Close"})]})]})]}));Le.displayName=Se.displayName;const Te=({className:a,...s})=>e.jsx("div",{className:F("flex flex-col space-y-1.5 text-center sm:text-left",a),...s});Te.displayName="DialogHeader";const Ee=l.forwardRef(({className:a,...s},o)=>e.jsx(Me,{ref:o,className:F("text-lg font-semibold leading-none tracking-tight",a),...s}));Ee.displayName=Me.displayName;const zt=l.forwardRef(({className:a,...s},o)=>e.jsx(Pe,{ref:o,className:F("text-sm text-muted-foreground",a),...s}));zt.displayName=Pe.displayName;const _t={price:.4,shipping:.3,stock:.2,rating:.1};function Ct(a,s,o=_t){if(a.stock_status!=="available")return 0;const r=s.map(u=>u.cost_price+u.shipping_cost),p=Math.min(...r),f=Math.max(...r),g=a.cost_price+a.shipping_cost,y=f===p?100:(f-g)/(f-p)*100,i=s.map(u=>u.shipping_days),j=Math.min(...i),m=Math.max(...i),v=m===j?100:(m-a.shipping_days)/(m-j)*100,x=a.stock_status==="available"?100:0,k=(a.rating||0)*20;return Math.round(o.price*y+o.shipping*v+o.stock*x+o.rating*k)}function St(a){const s=a.filter(r=>r.stock_status==="available");if(s.length===0)return{best:null,ranked:[]};const o=s.map(r=>({...r,_score:Ct(r,s)}));return o.sort((r,p)=>(p._score??0)-(r._score??0)),{best:o[0],ranked:o}}function Mt(a){return ke({queryKey:["supplier_products",a],enabled:!!a,queryFn:async()=>{const{data:s,error:o}=await E.from("supplier_products").select("*, supplier:suppliers(*)").eq("product_id",a);if(o)throw o;return(s||[]).map(r=>({...r,supplier:r.supplier}))}})}const X=a=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a);function It({open:a,onClose:s,productId:o,productTitle:r}){const{data:p,isLoading:f}=Mt(o),{best:g,ranked:y}=St(p||[]);return e.jsx(Nt,{open:a,onOpenChange:i=>!i&&s(),children:e.jsxs(Le,{className:"max-w-lg",children:[e.jsxs(Te,{children:[e.jsx(Ee,{className:"text-base font-semibold",children:"Fornecedores disponíveis"}),e.jsx("p",{className:"text-xs text-muted-foreground line-clamp-1 mt-0.5",children:r})]}),f?e.jsx("div",{className:"space-y-3 py-4",children:[1,2].map(i=>e.jsx(T,{className:"h-20 w-full rounded-xl"},i))}):y.length===0?e.jsxs("div",{className:"flex flex-col items-center py-10 text-center",children:[e.jsx(lt,{size:32,className:"text-muted-foreground/40 mb-3"}),e.jsx("p",{className:"text-sm font-medium text-foreground",children:"Nenhum fornecedor disponível"}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:"Este produto ainda não possui fornecedores vinculados ou todos estão sem estoque."})]}):e.jsx("div",{className:"space-y-2.5 py-2",children:y.map((i,j)=>{var x;const m=(g==null?void 0:g.id)===i.id,v=i.cost_price+i.shipping_cost;return e.jsxs("div",{className:`relative rounded-xl border p-3.5 transition-colors ${m?"border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20":"border-border bg-background"}`,children:[m&&e.jsxs("span",{className:"absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white",children:[e.jsx(ct,{size:10})," Melhor opção"]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:((x=i.supplier)==null?void 0:x.name)||"Fornecedor"}),e.jsxs("p",{className:"text-[11px] text-muted-foreground mt-0.5",children:["Score: ",i._score??0,"/100"]})]}),e.jsxs("div",{className:"text-right",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:X(v)}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:"custo total"})]})]}),e.jsxs("div",{className:"mt-2.5 grid grid-cols-4 gap-2",children:[e.jsx(U,{icon:dt,label:"Custo",value:X(i.cost_price)}),e.jsx(U,{icon:pt,label:"Frete",value:X(i.shipping_cost)}),e.jsx(U,{icon:q,label:"Prazo",value:`${i.shipping_days}d`}),e.jsx(U,{icon:Ce,label:"Nota",value:i.rating?`${i.rating}/5`:"—"})]})]},i.id)})})]})})}function U({icon:a,label:s,value:o}){return e.jsxs("div",{className:"flex flex-col items-center rounded-lg bg-muted/50 p-1.5",children:[e.jsx(a,{size:12,className:"text-muted-foreground mb-0.5"}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:s}),e.jsx("p",{className:"text-[11px] font-semibold text-foreground",children:o})]})}function Pt(a,s){const o=new AbortController,r=window.setTimeout(()=>o.abort(),a);return s==null||s.addEventListener("abort",()=>o.abort(),{once:!0}),{signal:o.signal,clear:()=>window.clearTimeout(r)}}const ye=[{key:"todos",label:"Todos"},{key:"beleza",label:"Beleza"},{key:"casa",label:"Casa"},{key:"eletronicos",label:"Eletrônicos"},{key:"moda",label:"Moda"},{key:"esporte",label:"Esporte"},{key:"pet",label:"Pet"},{key:"bebes",label:"Bebês"},{key:"organizacao",label:"Organização"}],je=[{key:"todos",label:"Todas as datas"},{key:"today",label:"Hoje"},{key:"7d",label:"Últimos 7 dias"},{key:"30d",label:"Últimos 30 dias"},{key:"90d",label:"Últimos 90 dias"}],ve=[{key:"todos",label:"Status de preço"},{key:"priced",label:"Com preço"},{key:"missing_price",label:"Sem preço"},{key:"positive_margin",label:"Margem positiva"}],we={cj:{label:"CJ Dropshipping",bg:"#fff4e8",color:"#d86500",icon:"CJ"},aliexpress:{label:"AliExpress",bg:"#fff0f0",color:"#d82f2f",icon:"AE"},amazon:{label:"Amazon",bg:"#fff8de",color:"#a76f00",icon:"AZ"},shopee:{label:"Shopee",bg:"#fff1e8",color:"#d84b23",icon:"SP"},mercadolivre:{label:"Mercado Livre",bg:"#fffbd8",color:"#977000",icon:"ML"}};function Dt(a){return a?we[a.toLowerCase()]??{label:a,bg:"#f4f4f5",color:"#52525b",icon:a.slice(0,2).toUpperCase()}:we.cj}const Lt=a=>a?a.replace(/_/g," ").replace(/\b\w/g,s=>s.toUpperCase()):"Catálogo",Fe=a=>{try{const s=typeof a=="string"?JSON.parse(a):a;return Array.isArray(s)&&s.length>0?String(s[0]):null}catch{return null}},Ne=({product:a,index:s,onImport:o,onCompare:r,formatPrice:p})=>{const f=Fe(a.images),[g,y]=l.useState(s===1),[i,j]=l.useState(!1),m=Dt(a.source),v=Math.max(0,Number(a.suggested_price??0)-Number(a.cost_price??0)),x=Number(a.margin_percent??0)||(Number(a.cost_price)>0?v/Number(a.cost_price)*100:0),k=Number(a.suggested_price??0)>0?Number(a.suggested_price):Number(a.cost_price??0),u=Lt(a.category);return l.useEffect(()=>{j(!1)},[f]),e.jsxs("article",{className:"catalog-product-card",children:[e.jsxs("div",{className:"catalog-product-media",children:[e.jsx("span",{className:"catalog-product-pill",children:u}),e.jsx("button",{type:"button",className:`catalog-heart-button ${g?"is-active":""}`,onClick:()=>y(_=>!_),"aria-label":g?"Remover dos favoritos":"Adicionar aos favoritos",children:e.jsx(ht,{size:16,strokeWidth:1.9,fill:g?"currentColor":"none"})}),f&&!i?e.jsx("img",{src:f,alt:a.title,className:"catalog-product-image",loading:"lazy",decoding:"async",onError:()=>j(!0)}):e.jsx("div",{className:"catalog-image-fallback",children:e.jsx(q,{size:40,strokeWidth:1.35})})]}),e.jsxs("div",{className:"catalog-product-body",children:[e.jsxs("div",{className:"catalog-product-source",style:{color:m.color,background:m.bg},children:[e.jsx("span",{children:m.icon}),m.label]}),e.jsx("h3",{children:a.title}),e.jsxs("div",{className:"catalog-product-meta",children:[e.jsxs("span",{children:[e.jsx(Ce,{size:13,strokeWidth:1.8,fill:"currentColor"}),x>0?`${Math.round(x)}% margem`:"Novo"]}),e.jsx("strong",{children:p(k)})]}),e.jsxs("div",{className:"catalog-card-actions",children:[e.jsx("button",{type:"button",onClick:r,className:"catalog-secondary-button",children:"Fornecedores"}),e.jsx("button",{type:"button",onClick:o,className:"catalog-primary-button",children:"Importar"})]})]})]})},Xt=()=>{var ge,me,xe;const[a,s]=l.useState("todos"),[o,r]=l.useState(1),[p,f]=l.useState(""),[g,y]=l.useState("todos"),[i,j]=l.useState("todos"),[m,v]=l.useState(!0),[x,k]=l.useState("popular"),[u,_]=l.useState(""),[n,A]=l.useState(""),[M,W]=l.useState(!1),[K,V]=l.useState(!1),[Ae,Oe]=l.useState(null),[Re,Z]=l.useState(!1),[Be,ee]=l.useState(!1),[te,ae]=l.useState(null),[Ue,qe]=l.useState(""),$=l.useRef(null),J=l.useRef(null),oe=et(),We=ze(),Ve=12,$e="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";l.useEffect(()=>{const t=c=>{$.current&&!$.current.contains(c.target)&&W(!1),J.current&&!J.current.contains(c.target)&&V(!1)};return document.addEventListener("mousedown",t),()=>document.removeEventListener("mousedown",t)},[]);const{data:C,isLoading:Je,isError:Ye,refetch:se}=ke({queryKey:["catalog",a,o,p],staleTime:60*1e3,retry:1,queryFn:async({signal:t})=>{const c=new URLSearchParams({page:String(o),limit:String(Ve)});a!=="todos"&&c.set("category",a),p&&c.set("search",p);const z=`${ot}/functions/v1/catalog?${c}`,O=Pt(8e3,t);try{const R=await fetch(z,{headers:{Authorization:`Bearer ${$e}`},signal:O.signal});if(!R.ok)throw new Error("Failed to fetch catalog");return R.json()}finally{O.clear()}}}),I=tt({mutationFn:async()=>{const{data:t,error:c}=await E.functions.invoke("cj-sync-request");if(c)throw new Error(c.message);if(t!=null&&t.error)throw new Error(t.error);return t},onMutate:()=>({toastId:S.loading("Sincronizando produtos...")}),onSuccess:(t,c,h)=>{const z=t.synced??0;S.success(z>0?`${z} produtos sincronizados com sucesso!`:"Sincronização concluída (nenhum produto novo encontrado).",{id:h==null?void 0:h.toastId}),oe.invalidateQueries({queryKey:["catalog"]}),oe.refetchQueries({queryKey:["catalog"]})},onError:(t,c,h)=>S.error(`Erro ao sincronizar: ${t.message}`,{id:h==null?void 0:h.toastId})}),P=(C==null?void 0:C.products)||[],re=(C==null?void 0:C.totalPages)||1,D=l.useMemo(()=>{const t=p.trim().toLowerCase(),c=new Date,h=u.trim()===""?Number.NEGATIVE_INFINITY:Number(u.replace(",",".")),z=n.trim()===""?Number.POSITIVE_INFINITY:Number(n.replace(",",".")),O=Number.isFinite(h)?h:Number.NEGATIVE_INFINITY,R=Number.isFinite(z)?z:Number.POSITIVE_INFINITY;return[...P.filter(d=>{const b=d.stock_quantity;if(b!=null&&Number(b)<=0)return!1;const B=[d.title,d.category,d.source,d.supplier_name,d.external_id].filter(Boolean).join(" ").toLowerCase();if(t&&!B.includes(t))return!1;const L=Number(d.suggested_price??d.cost_price??0);if(L<O||L>R)return!1;if(g!=="todos"){const w=d.created_at||d.updated_at;if(!w)return!1;const N=new Date(w);if(Number.isNaN(N.getTime()))return!1;if(g==="today"){if(N.toDateString()!==c.toDateString())return!1}else{const Y=Number(g.replace("d","")),H=new Date(c);if(H.setDate(c.getDate()-Y),N<H)return!1}}if(i!=="todos"){const w=Number(d.cost_price)>0&&Number(d.suggested_price)>0,N=Number(d.margin_percent)>0||Number(d.suggested_price)>Number(d.cost_price);if(i==="priced"&&!w||i==="missing_price"&&w||i==="positive_margin"&&!N)return!1}return!(m&&d.is_active===!1)})].sort((d,b)=>{const B=Number(d.suggested_price??d.cost_price??0),L=Number(b.suggested_price??b.cost_price??0),w=Math.max(0,Number(d.suggested_price??0)-Number(d.cost_price??0)),N=Math.max(0,Number(b.suggested_price??0)-Number(b.cost_price??0));if(x==="price_asc")return B-L;if(x==="price_desc")return L-B;if(x==="profit_desc")return N-w;if(x==="newest")return new Date(b.created_at||b.updated_at||0).getTime()-new Date(d.created_at||d.updated_at||0).getTime();const Y=Number(d.margin_percent??0)||(Number(d.cost_price)>0?w/Number(d.cost_price)*100:0);return(Number(b.margin_percent??0)||(Number(b.cost_price)>0?N/Number(b.cost_price)*100:0))-Y||N-w})},[P,p,g,i,m,u,n,x]),He=l.useMemo(()=>P.reduce((t,c)=>(t.todos=(t.todos||0)+1,c.category&&(t[c.category]=(t[c.category]||0)+1),t),{}),[P]),ie=t=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(t),Ge=((ge=ye.find(t=>t.key===a))==null?void 0:ge.label)??"Todos",Qe=((me=je.find(t=>t.key===g))==null?void 0:me.label)??"Todas as datas",Xe=((xe=ve.find(t=>t.key===i))==null?void 0:xe.label)??"Status de preço",Ke=[a!=="todos",g!=="todos",i!=="todos",m,!!(u||n)].filter(Boolean).length,ne=D[0]||P[0],le=ne?Fe(ne.images):null,ce=D.slice(0,4),Ze=()=>{f(""),s("todos"),y("todos"),j("todos"),v(!0),_(""),A(""),r(1)},de=t=>{Oe(t),Z(!0)},pe=t=>{ae(t.id),qe(t.title)};return e.jsxs("div",{className:"catalog-page-shell",children:[e.jsxs("div",{className:"catalog-apple-board",children:[e.jsxs("header",{className:"catalog-topbar",children:[e.jsxs("a",{href:"/dashboard",className:"catalog-brand","aria-label":"Velo",children:[e.jsx("span",{children:"V"}),"Velo"]}),e.jsxs("nav",{"aria-label":"Seções do catálogo",children:[e.jsx("a",{href:"#produtos",children:"Produtos"}),e.jsx("a",{href:"#recomendacoes",children:"Recomendações"}),e.jsx("button",{type:"button",onClick:()=>ee(!0),children:"Integrações"})]}),e.jsx("button",{type:"button",onClick:()=>I.mutate(),disabled:I.isPending,className:"catalog-sync-icon","aria-label":"Sincronizar catálogo",children:e.jsx(gt,{size:17,strokeWidth:1.8,className:I.isPending?"animate-spin":""})})]}),e.jsxs("section",{className:"catalog-hero",style:le?{backgroundImage:`url(${le})`}:void 0,children:[e.jsx("div",{className:"catalog-hero-overlay"}),e.jsxs("div",{className:"catalog-hero-content",children:[e.jsx("span",{children:"Catálogo Velo"}),e.jsx("h1",{children:"Shop"}),e.jsx("p",{children:"Produtos reais para importar, precificar com margem e publicar em poucos cliques."})]}),e.jsxs("div",{className:"catalog-hero-stats",children:[e.jsxs("span",{children:[D.length," produtos"]}),e.jsx("span",{children:Ge})]})]}),e.jsxs("section",{className:"catalog-shop-panel",id:"produtos",children:[e.jsxs("div",{className:"catalog-shop-head",children:[e.jsxs("div",{children:[e.jsx("span",{className:"catalog-eyebrow",children:"Give all you need"}),e.jsx("h2",{children:"Escolha o próximo produto vencedor"})]}),e.jsxs("div",{className:"catalog-searchbar",children:[e.jsx(mt,{size:16,strokeWidth:1.8}),e.jsx("input",{value:p,onChange:t=>{f(t.target.value),r(1)},placeholder:"Buscar no catálogo"}),e.jsx("button",{type:"button",onClick:()=>void se(),children:"Buscar"})]})]}),e.jsxs("div",{className:"catalog-shop-layout",children:[e.jsxs("aside",{className:"catalog-filter-rail",children:[e.jsxs("div",{className:"catalog-filter-title",children:[e.jsx("span",{children:"Categoria"}),e.jsxs("small",{children:[Ke," filtros"]})]}),e.jsx("div",{className:"catalog-category-list",children:ye.map(t=>{const c=a===t.key,h=He[t.key]??0;return e.jsxs("button",{type:"button",className:c?"is-active":"",onClick:()=>{s(t.key),r(1)},children:[e.jsx("span",{className:"catalog-category-icon",children:c?e.jsx(G,{size:13,strokeWidth:2.5}):e.jsx(xt,{size:13,strokeWidth:1.8})}),e.jsx("span",{children:t.label}),e.jsx("strong",{children:h})]},t.key)})}),e.jsxs("div",{className:"catalog-filter-block",children:[e.jsxs("button",{type:"button",className:"catalog-filter-row",onClick:()=>W(t=>!t),children:[e.jsx("span",{children:"Data"}),e.jsx("small",{children:Qe}),e.jsx(Q,{size:14,className:M?"is-open":""})]}),M&&e.jsx("div",{className:"catalog-dropdown-list",ref:$,children:je.map(t=>e.jsxs("button",{type:"button",className:g===t.key?"is-active":"",onClick:()=>{y(t.key),W(!1),r(1)},children:[t.label,g===t.key&&e.jsx(G,{size:13,strokeWidth:2.4})]},t.key))})]}),e.jsxs("div",{className:"catalog-filter-block",children:[e.jsxs("button",{type:"button",className:"catalog-filter-row",onClick:()=>V(t=>!t),children:[e.jsx("span",{children:"Preço"}),e.jsx("small",{children:Xe}),e.jsx(Q,{size:14,className:K?"is-open":""})]}),K&&e.jsx("div",{className:"catalog-dropdown-list",ref:J,children:ve.map(t=>e.jsxs("button",{type:"button",className:i===t.key?"is-active":"",onClick:()=>{j(t.key),V(!1),r(1)},children:[t.label,i===t.key&&e.jsx(G,{size:13,strokeWidth:2.4})]},t.key))})]}),e.jsxs("div",{className:"catalog-price-filter",children:[e.jsx("span",{children:"Faixa de preço"}),e.jsxs("div",{children:[e.jsx("input",{value:u,onChange:t=>{_(t.target.value),r(1)},placeholder:"Mín.",inputMode:"decimal"}),e.jsx("input",{value:n,onChange:t=>{A(t.target.value),r(1)},placeholder:"Máx.",inputMode:"decimal"})]})]}),e.jsxs("label",{className:"catalog-toggle-line",children:[e.jsx("button",{type:"button",className:m?"is-active":"",onClick:()=>{v(t=>!t),r(1)},"aria-pressed":m,children:e.jsx("span",{})}),"Somente ativos"]}),e.jsxs("label",{className:"catalog-sort-select",children:[e.jsxs("select",{value:x,onChange:t=>{k(t.target.value),r(1)},children:[e.jsx("option",{value:"popular",children:"Mais promissores"}),e.jsx("option",{value:"price_asc",children:"Menor preço"}),e.jsx("option",{value:"price_desc",children:"Maior preço"}),e.jsx("option",{value:"profit_desc",children:"Maior lucro"}),e.jsx("option",{value:"newest",children:"Mais recentes"})]}),e.jsx(Q,{size:14})]}),e.jsxs("button",{type:"button",className:"catalog-clear-filters",onClick:Ze,children:[e.jsx(ut,{size:14,strokeWidth:1.8}),"Limpar filtros"]})]}),e.jsx("main",{className:"catalog-results-area",children:Je?e.jsx("div",{className:"catalog-products-grid",children:Array.from({length:9}).map((t,c)=>e.jsxs("div",{className:"catalog-skeleton-card",children:[e.jsx(T,{className:"h-[190px] w-full rounded-[18px]"}),e.jsx(T,{className:"h-5 w-4/5 rounded-md"}),e.jsx(T,{className:"h-4 w-2/5 rounded-md"}),e.jsx(T,{className:"h-10 w-full rounded-full"})]},c))}):Ye?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(q,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Não foi possível carregar o catálogo"}),e.jsx("span",{children:"Verifique a conexão com o Supabase e tente novamente."}),e.jsx("button",{type:"button",onClick:()=>void se(),children:"Tentar novamente"})]}):D.length===0?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(q,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Nenhum produto encontrado"}),e.jsx("span",{children:"Sincronize ou ajuste os filtros para encontrar produtos disponíveis."}),e.jsx("button",{type:"button",onClick:()=>I.mutate(),disabled:I.isPending,children:"Sincronizar catálogo"})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"catalog-products-grid",children:D.map((t,c)=>e.jsx(Ne,{product:t,index:c,onImport:()=>de(t),onCompare:()=>pe(t),formatPrice:ie},t.id))}),e.jsxs("div",{className:"catalog-pagination",children:[e.jsxs("button",{type:"button",onClick:()=>r(t=>Math.max(1,t-1)),disabled:o<=1,children:[e.jsx(ue,{size:14}),"Anterior"]}),e.jsx("span",{children:o}),e.jsxs("button",{type:"button",onClick:()=>r(t=>Math.min(re,t+1)),disabled:o>=re,children:["Próxima",e.jsx(fe,{size:14})]})]})]})})]})]}),ce.length>0&&e.jsxs("section",{className:"catalog-recommendations",id:"recomendacoes",children:[e.jsxs("div",{className:"catalog-section-heading",children:[e.jsx("h2",{children:"Explore recomendações"}),e.jsxs("div",{children:[e.jsx("button",{type:"button","aria-label":"Voltar recomendações",children:e.jsx(ue,{size:18})}),e.jsx("button",{type:"button","aria-label":"Avançar recomendações",children:e.jsx(fe,{size:18})})]})]}),e.jsx("div",{className:"catalog-recommendation-row",children:ce.map((t,c)=>e.jsx(Ne,{product:t,index:c,onImport:()=>de(t),onCompare:()=>pe(t),formatPrice:ie},`recommendation-${t.id}`))})]}),e.jsxs("section",{className:"catalog-cta",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Pronto para vender sem travar?"}),e.jsxs("form",{onSubmit:t=>t.preventDefault(),children:[e.jsx("input",{placeholder:"Seu melhor e-mail",type:"email"}),e.jsx("button",{type:"submit",children:"Enviar"})]})]}),e.jsx("p",{children:"A Velo ajuda você a escolher, importar e publicar produtos com margem. Menos planilha, mais operação."}),e.jsx(ft,{size:28,strokeWidth:1.5})]})]}),e.jsx(st,{open:Re,onClose:()=>{Z(!1),We.refreshUsage()},product:Ae}),e.jsx(It,{open:!!te,onClose:()=>ae(null),productId:te||"",productTitle:Ue}),e.jsx(wt,{open:Be,onClose:()=>ee(!1)}),e.jsx("style",{children:`
        .catalog-page-shell {
          min-height: 100%;
          padding: 0;
          color: #09090b;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        }

        .catalog-apple-board {
          width: min(100%, 1180px);
          margin: 0 auto 48px;
          background: #ffffff;
          border-radius: 0 0 28px 28px;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        }

        .catalog-topbar {
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0 30px;
          border-bottom: 1px solid rgba(9, 9, 11, 0.06);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(18px);
        }

        .catalog-brand {
          color: #09090b;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .catalog-brand span {
          width: 26px;
          height: 26px;
          border-radius: 9px;
          background: #09090b;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .catalog-topbar nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          font-size: 13px;
          font-weight: 650;
        }

        .catalog-topbar nav a,
        .catalog-topbar nav button {
          border: 0;
          background: transparent;
          color: #2f3033;
          text-decoration: none;
          cursor: pointer;
          padding: 0;
          font: inherit;
        }

        .catalog-sync-icon {
          width: 36px;
          height: 36px;
          border: 1px solid #e8e8ea;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 180ms ease, background 180ms ease;
        }

        .catalog-sync-icon:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #f5f5f7;
        }

        .catalog-sync-icon:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .catalog-hero {
          position: relative;
          min-height: 330px;
          background: #d9d9d9;
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .catalog-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.18) 48%, rgba(255, 255, 255, 0.65)),
            radial-gradient(circle at 18% 20%, rgba(255, 255, 255, 0.92), transparent 34%);
          z-index: 1;
        }

        .catalog-hero:not([style]) {
          background:
            linear-gradient(135deg, #f5f5f7 0%, #dadde3 50%, #ffffff 100%);
        }

        .catalog-hero-overlay {
          position: absolute;
          inset: auto 0 0;
          height: 42%;
          background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.68));
          z-index: 2;
        }

        .catalog-hero-content {
          position: relative;
          z-index: 3;
          padding: 58px 56px 42px;
        }

        .catalog-hero-content span {
          display: inline-flex;
          height: 28px;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: #09090b;
          padding: 0 13px;
          font-size: 12px;
          font-weight: 750;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .catalog-hero-content h1 {
          margin: -2px 0 0;
          color: rgba(255, 255, 255, 0.92);
          font-size: clamp(112px, 20vw, 260px);
          line-height: 0.78;
          font-weight: 900;
          letter-spacing: -0.09em;
          text-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
        }

        .catalog-hero-content p {
          max-width: 450px;
          margin: 20px 0 0;
          color: #1f2937;
          font-size: 17px;
          line-height: 1.45;
          font-weight: 560;
        }

        .catalog-hero-stats {
          position: absolute;
          right: 34px;
          bottom: 28px;
          z-index: 4;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .catalog-hero-stats span {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
          color: #09090b;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 760;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
        }

        .catalog-shop-panel {
          position: relative;
          z-index: 5;
          width: calc(100% - 64px);
          margin: -42px auto 0;
          border-radius: 22px;
          background: #ffffff;
          padding: 26px 28px 34px;
          box-shadow: 0 -10px 44px rgba(15, 23, 42, 0.09);
        }

        .catalog-shop-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 30px;
        }

        .catalog-eyebrow {
          color: #09090b;
          font-size: 13px;
          font-weight: 850;
        }

        .catalog-shop-head h2,
        .catalog-section-heading h2,
        .catalog-cta h2 {
          margin: 8px 0 0;
          color: #050505;
          font-size: clamp(28px, 3vw, 42px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 850;
        }

        .catalog-searchbar {
          width: min(420px, 100%);
          height: 42px;
          border: 1px solid #e7e7ea;
          border-radius: 999px;
          background: #ffffff;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          padding: 4px 5px 4px 13px;
          color: #7a7f87;
        }

        .catalog-searchbar input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #09090b;
          background: transparent;
          font-size: 13px;
          min-width: 0;
        }

        .catalog-searchbar button {
          height: 32px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-shop-layout {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }

        .catalog-filter-rail {
          position: sticky;
          top: 14px;
          min-width: 0;
          color: #09090b;
        }

        .catalog-filter-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 18px;
          font-weight: 840;
          letter-spacing: -0.03em;
        }

        .catalog-filter-title small {
          border-radius: 999px;
          background: #f1f1f3;
          padding: 4px 8px;
          color: #696f77;
          font-size: 11px;
          letter-spacing: 0;
        }

        .catalog-category-list,
        .catalog-dropdown-list {
          display: flex;
          flex-direction: column;
        }

        .catalog-category-list button,
        .catalog-dropdown-list button {
          width: 100%;
          min-height: 38px;
          border: 0;
          background: transparent;
          color: #41464d;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          border-radius: 12px;
          padding: 0 10px;
          text-align: left;
          font-size: 13px;
          font-weight: 620;
          cursor: pointer;
        }

        .catalog-category-list button:hover,
        .catalog-category-list button.is-active,
        .catalog-dropdown-list button:hover,
        .catalog-dropdown-list button.is-active {
          background: #f5f5f7;
          color: #09090b;
        }

        .catalog-category-list strong {
          min-width: 24px;
          height: 20px;
          border-radius: 999px;
          background: #ff465d;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          font-size: 10px;
          font-weight: 850;
        }

        .catalog-category-icon {
          width: 22px;
          height: 22px;
          border-radius: 8px;
          background: #ffffff;
          color: #737880;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px #e8e8eb;
        }

        .catalog-category-list button.is-active .catalog-category-icon {
          background: #09090b;
          color: #ffffff;
        }

        .catalog-filter-block,
        .catalog-price-filter,
        .catalog-toggle-line,
        .catalog-sort-select,
        .catalog-clear-filters {
          margin-top: 16px;
        }

        .catalog-filter-row {
          width: 100%;
          min-height: 40px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #09090b;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          text-align: left;
          font-size: 13px;
          font-weight: 780;
        }

        .catalog-filter-row small {
          max-width: 86px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #757b84;
          font-size: 11px;
          font-weight: 620;
        }

        .catalog-filter-row svg,
        .catalog-sort-select svg {
          transition: transform 160ms ease;
        }

        .catalog-filter-row svg.is-open {
          transform: rotate(180deg);
        }

        .catalog-dropdown-list {
          gap: 4px;
          margin-top: 5px;
          padding: 6px;
          border-radius: 14px;
          background: #fafafa;
          box-shadow: inset 0 0 0 1px #ececef;
        }

        .catalog-dropdown-list button {
          grid-template-columns: minmax(0, 1fr) auto;
          min-height: 32px;
          font-size: 12px;
        }

        .catalog-price-filter > span {
          display: block;
          margin-bottom: 8px;
          color: #09090b;
          font-size: 13px;
          font-weight: 780;
        }

        .catalog-price-filter > div {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .catalog-price-filter input {
          min-width: 0;
          height: 38px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          padding: 0 12px;
          outline: 0;
          font-size: 12px;
          font-weight: 620;
        }

        .catalog-toggle-line {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #41464d;
          font-size: 13px;
          font-weight: 650;
        }

        .catalog-toggle-line button {
          width: 39px;
          height: 22px;
          border: 0;
          border-radius: 999px;
          background: #dedee3;
          position: relative;
          transition: background 160ms ease;
        }

        .catalog-toggle-line button span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.16);
          transition: transform 160ms ease;
        }

        .catalog-toggle-line button.is-active {
          background: #09090b;
        }

        .catalog-toggle-line button.is-active span {
          transform: translateX(17px);
        }

        .catalog-sort-select {
          width: 100%;
          height: 40px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 0 12px;
          color: #09090b;
        }

        .catalog-sort-select select {
          appearance: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          width: 100%;
          min-width: 0;
          font-size: 12px;
          font-weight: 700;
        }

        .catalog-clear-filters {
          width: 100%;
          height: 40px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-results-area {
          min-width: 0;
        }

        .catalog-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 26px 28px;
        }

        .catalog-skeleton-card,
        .catalog-product-card {
          min-width: 0;
          border-radius: 0;
        }

        .catalog-skeleton-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .catalog-product-card {
          position: relative;
          overflow: visible;
          background: transparent;
        }

        .catalog-product-media {
          position: relative;
          min-height: 214px;
          border-radius: 18px;
          background: #f2f2f3;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          overflow: hidden;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .catalog-product-card:hover .catalog-product-media {
          transform: translateY(-2px);
          box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
        }

        .catalog-product-pill {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          min-height: 24px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: #09090b;
          display: inline-flex;
          align-items: center;
          padding: 0 11px;
          font-size: 11px;
          font-weight: 780;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
        }

        .catalog-heart-button {
          position: absolute;
          left: 10px;
          top: 10px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.84);
          color: #6e747c;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 160ms ease, transform 160ms ease;
        }

        .catalog-heart-button:hover,
        .catalog-heart-button.is-active {
          color: #ff3658;
          transform: scale(1.04);
        }

        .catalog-product-image {
          max-width: 92%;
          max-height: 164px;
          width: auto;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 24px rgba(15, 23, 42, 0.12));
          transition: transform 220ms ease;
        }

        .catalog-product-card:hover .catalog-product-image {
          transform: scale(1.04);
        }

        .catalog-image-fallback {
          width: 120px;
          height: 120px;
          border-radius: 26px;
          background: #ffffff;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px #e7e7ea;
        }

        .catalog-product-body {
          padding: 14px 2px 0;
        }

        .catalog-product-source {
          width: fit-content;
          min-height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          font-size: 10px;
          font-weight: 780;
        }

        .catalog-product-source span {
          font-size: 9px;
          font-weight: 900;
        }

        .catalog-product-body h3 {
          min-height: 42px;
          margin: 10px 0 8px;
          color: #09090b;
          font-size: 17px;
          line-height: 1.22;
          letter-spacing: -0.035em;
          font-weight: 780;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .catalog-product-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .catalog-product-meta span {
          color: #6f757d;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 650;
        }

        .catalog-product-meta span svg {
          color: #f2a33a;
        }

        .catalog-product-meta strong {
          color: #09090b;
          font-size: 18px;
          line-height: 1;
          letter-spacing: -0.03em;
          white-space: nowrap;
        }

        .catalog-card-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
        }

        .catalog-primary-button,
        .catalog-secondary-button {
          height: 36px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 780;
          transition: transform 160ms ease, background 160ms ease;
        }

        .catalog-primary-button {
          border: 0;
          background: #09090b;
          color: #ffffff;
        }

        .catalog-secondary-button {
          border: 1px solid #dedee3;
          background: #ffffff;
          color: #09090b;
        }

        .catalog-primary-button:hover,
        .catalog-secondary-button:hover {
          transform: translateY(-1px);
        }

        .catalog-empty-state {
          min-height: 420px;
          border-radius: 24px;
          background: #f5f5f7;
          color: #6f757d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          padding: 36px;
        }

        .catalog-empty-state strong {
          color: #09090b;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .catalog-empty-state button {
          height: 40px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-pagination {
          margin-top: 36px;
          padding-top: 22px;
          border-top: 1px solid #ececef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .catalog-pagination button {
          min-width: 120px;
          height: 38px;
          border: 0;
          background: transparent;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-pagination button:disabled {
          color: #a1a1aa;
          cursor: not-allowed;
        }

        .catalog-pagination span {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #f5f5f7;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .catalog-recommendations {
          padding: 68px 32px 36px;
        }

        .catalog-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 26px;
        }

        .catalog-section-heading div {
          display: flex;
          gap: 8px;
        }

        .catalog-section-heading button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 999px;
          background: #f5f5f7;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-recommendation-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(220px, 1fr));
          gap: 26px;
          overflow: hidden;
        }

        .catalog-cta {
          margin: 38px 32px 42px;
          min-height: 210px;
          border-radius: 18px;
          background: linear-gradient(135deg, #111113, #262628);
          color: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 0.75fr) auto;
          align-items: end;
          gap: 34px;
          padding: 28px;
        }

        .catalog-cta h2 {
          color: #ffffff;
          max-width: 440px;
        }

        .catalog-cta form {
          width: min(250px, 100%);
          height: 42px;
          margin-top: 26px;
          border-radius: 999px;
          background: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          padding: 4px;
        }

        .catalog-cta input {
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 0 12px;
          font-size: 12px;
        }

        .catalog-cta button {
          height: 34px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 16px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-cta p {
          margin: 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          line-height: 1.65;
        }

        @media (max-width: 1220px) {
          .catalog-apple-board {
            width: 100%;
            border-radius: 0;
          }

          .catalog-shop-panel {
            width: calc(100% - 36px);
          }

          .catalog-shop-layout {
            grid-template-columns: 1fr;
          }

          .catalog-filter-rail {
            position: static;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .catalog-filter-title,
          .catalog-category-list {
            grid-column: 1 / -1;
          }

          .catalog-category-list {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
        }

        @media (max-width: 900px) {
          .catalog-topbar {
            padding: 0 18px;
          }

          .catalog-topbar nav {
            display: none;
          }

          .catalog-hero {
            min-height: 280px;
          }

          .catalog-hero-content {
            padding: 42px 28px;
          }

          .catalog-hero-content p {
            font-size: 14px;
          }

          .catalog-shop-head {
            flex-direction: column;
          }

          .catalog-searchbar {
            width: 100%;
          }

          .catalog-products-grid,
          .catalog-recommendation-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .catalog-cta {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .catalog-shop-panel {
            width: calc(100% - 20px);
            padding: 22px 16px 28px;
          }

          .catalog-filter-rail,
          .catalog-category-list,
          .catalog-products-grid,
          .catalog-recommendation-row {
            grid-template-columns: 1fr;
          }

          .catalog-product-media {
            min-height: 230px;
          }

          .catalog-hero-stats {
            left: 24px;
            right: 24px;
            justify-content: flex-start;
          }

          .catalog-recommendations {
            padding: 48px 18px 28px;
          }

          .catalog-cta {
            margin: 26px 18px 34px;
            padding: 22px;
          }
        }
      `})]})};export{Xt as default};
