import{e as i,r as xt,j as e}from"./vendor-react-DNIqRoEp.js";import{b as Xe,c as mt,u as gt}from"./vendor-query-DEHbxmQ5.js";import{S as xe}from"./skeleton-CR2JeMUv.js";import{aV as ut,aQ as u}from"./vendor-CecNt-VD.js";import{u as Ze,s as M,c as me,a as ft}from"./index-Db4xcoqm.js";import{U as et}from"./UpgradeLimitModal-BVGdxGRe.js";import{u as qe}from"./usePlanLimits-CNC-Zbrm.js";import{u as ht}from"./useStartMode-BhEAd6Ii.js";import{g as bt,b as yt,i as jt}from"./FirstStoreOnboarding-C35kk3zI.js";import{a_ as Be,q as ae,ab as Ee,V as vt,aK as Nt,aI as wt,ar as kt,O as At,e as tt,ak as _t,aO as zt,aP as Ct,J as St,aQ as Pt,al as ze,aJ as at,ax as Mt,aB as It,aG as Lt,r as Re,az as Dt,s as Oe,t as Ue,Z as Tt}from"./vendor-icons-DRxpxQGV.js";import{P as Et}from"./PlatformLogo-CPhEvGVK.js";import{R as Rt,P as $t,b as st,a as Ft,h as ot,O as rt,d as it}from"./vendor-radix-DwPvr873.js";import"./vendor-supabase-DvHmBoHV.js";import"./usePlan-AoYHF4ft.js";const T=60,O="#0A0A0A",H=a=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a),qt=a=>{try{const r=typeof a=="string"?JSON.parse(a):a;return Array.isArray(r)&&r.length>0?r[0]:null}catch{return null}},Bt=a=>{try{const r=typeof a=="string"?JSON.parse(a):a,t=Array.isArray(r)?r[0]:(r==null?void 0:r[0])??r;return(t==null?void 0:t.vid)??(t==null?void 0:t.variantId)??(t==null?void 0:t.variant_id)??(t==null?void 0:t.id)??(t==null?void 0:t.skuId)??(t==null?void 0:t.sku_id)??null}catch{return null}},Ot=a=>a?`https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(a)}`:null,Ve=[{num:1,label:"Detalhes"},{num:2,label:"Revisão"}],Ut=({open:a,onClose:r,product:t})=>{const{user:n}=Ze(),h=ut(),k=qe(),{isStartMode:N}=ht(),[m,c]=i.useState(1),[j,w]=i.useState(""),[b,_]=i.useState(0),[S,A]=i.useState(!1),[z,d]=i.useState(null),[I,L]=i.useState(!1),[U,se]=i.useState(null),[oe,ge]=i.useState(!1),[Q,ue]=i.useState(2.5),[E,V]=i.useState(""),[K,re]=i.useState(!1),[X,fe]=i.useState(!1),[Ce,Z]=i.useState(!1),[ie,ne]=i.useState(!1),[W,Se]=i.useState({ml:!0,shopee:!1,tiktok:!1});i.useEffect(()=>{!n||!a||(async()=>{const{data:o}=await M.from("user_integrations").select("access_token").eq("user_id",n.id).eq("platform","mercadolivre").maybeSingle();d(!!(o!=null&&o.access_token))})()},[n,a]),i.useEffect(()=>{a?requestAnimationFrame(()=>A(!0)):A(!1)},[a]);const[Pe,q]=i.useState(null);if(t&&t.id!==Pe){q(t.id);const o=t.title.length>T?t.title.substring(0,T):t.title;w(o),ue(2.5),_(Math.round(t.cost_price*2.5*100)/100),c(1),se(null),L(!1),V(""),ne(!1)}const G=(t==null?void 0:t.cost_price)??0,R=G,he=o=>{_(Math.round(G*o*100)/100)},P=i.useMemo(()=>Math.round((b-R)*100)/100,[b,R]),J=i.useMemo(()=>b>0?Math.round((b-R)/b*100):0,[b,R]),ee=t?qt(t.images):null,D=(t==null?void 0:t.stock_quantity)??0,le=D>0;i.useEffect(()=>{if(!a||!(t!=null&&t.description))return;let o=!1;return(async()=>{var g,x,p;Z(!0);try{const{data:y,error:l}=await M.functions.invoke("chat",{body:{messages:[{role:"user",content:`Você é um tradutor especialista em e-commerce brasileiro. Traduza a descrição deste produto para português do Brasil, mantendo o sentido original e adaptando termos naturais de venda. Não invente características novas. Responda APENAS com a descrição traduzida, sem introdução, sem comentários.

Descrição original:
${t.description}`}]}});if(l)throw l;const f=(y==null?void 0:y.response)||((p=(x=(g=y==null?void 0:y.choices)==null?void 0:g[0])==null?void 0:x.message)==null?void 0:p.content)||"";!o&&typeof f=="string"&&f.trim()&&V(f.trim())}catch{o||V(t.description??"")}finally{o||Z(!1)}})(),()=>{o=!0}},[a,t==null?void 0:t.id,t==null?void 0:t.description]);const Y=()=>{I||(A(!1),setTimeout(r,160))},be=async()=>{if(!n)return;const{data:o,error:v}=await M.functions.invoke("ml-connect"),g=(o==null?void 0:o.authUrl)??(o==null?void 0:o.auth_url);if(v||!g){u.error("Não foi possível iniciar a conexão com o Mercado Livre");return}window.location.href=g},Me=async()=>{var o,v,g;if(t){fe(!0);try{const{data:x,error:p}=await M.functions.invoke("chat",{body:{messages:[{role:"user",content:`Você é um tradutor especialista em e-commerce brasileiro. Traduza o nome deste produto para português do Brasil, adaptando para linguagem de venda. Máximo ${T} caracteres. Produto: "${t.title}". Responda APENAS com o título traduzido, sem aspas, sem explicação.`}]}});if(p)throw p;const y=(x==null?void 0:x.response)||((g=(v=(o=x==null?void 0:x.choices)==null?void 0:o[0])==null?void 0:v.message)==null?void 0:g.content)||"";if(typeof y=="string"&&y.trim()){const l=y.trim().replace(/^["']|["']$/g,""),f=l.length>T?l.substring(0,T):l;w(f),ne(!0),u.success("Título traduzido")}else u.error("Não foi possível traduzir")}catch{u.error("Erro ao traduzir")}finally{fe(!1)}}},Ie=async()=>{var o,v,g;if(t){re(!0);try{const x=b.toFixed(2).replace(".",","),p=t.category||"Não informada",y=`Você é um especialista em copywriting para e-commerce brasileiro.
Gere uma descrição de produto persuasiva e completa para o Mercado Livre
com base nestas informações:

Nome: ${j}
Categoria: ${p}
Preço: R$ ${x}

A descrição deve ter:
- 4 a 6 parágrafos
- Parágrafo 1: apresentação do produto e principal benefício
- Parágrafo 2: características técnicas e diferenciais
- Parágrafo 3: para quem é indicado e situações de uso
- Parágrafo 4: garantia de qualidade e satisfação
- Parágrafo 5: call-to-action persuasivo
- Tom: confiante, vendedor e acessível
- Idioma: português brasileiro
- Não use bullet points, escreva em parágrafos corridos
- Mínimo 300 palavras

Retorne APENAS a descrição, sem introdução, sem comentários.`,{data:l,error:f}=await M.functions.invoke("chat",{body:{mode:"product_description",messages:[{role:"user",content:y}]}});if(f)throw f;const C=(l==null?void 0:l.response)||((g=(v=(o=l==null?void 0:l.choices)==null?void 0:o[0])==null?void 0:v.message)==null?void 0:g.content)||"";typeof C=="string"&&C.trim()?(V(C.trim()),u.success("Descrição gerada")):u.error("Não foi possível gerar a descrição")}catch{u.error("Erro ao gerar descrição")}finally{re(!1)}}},Le=()=>j.trim()?j.length>T?(u.error(`Máximo ${T} caracteres`),!1):b<=0?(u.error("Defina um preço válido"),!1):b<=R?(u.error("Preço deve ser maior que o custo"),!1):!W.ml&&!W.shopee&&!W.tiktok?(u.error("Selecione ao menos uma plataforma"),!1):W.ml&&!z?(u.error("Conecte sua conta do Mercado Livre"),!1):le?!0:(u.error("Produto sem estoque"),!1):(u.error("Preencha o título"),!1),ye=async()=>{if(!Le()||!n)return;const o=bt();if(!o){u.error("Crie uma loja antes de publicar produtos");return}const v=yt(o.id),g=o.productLimit??30;if(v>=g){u.error(`Limite de ${g} produtos atingido nesta loja`);return}if(k.loading){u.info("Verificando seu plano...");return}if(!k.canPublishProducts){ge(!0);return}L(!0);try{const x=(()=>{try{const l=typeof(t==null?void 0:t.images)=="string"?JSON.parse(t.images):t==null?void 0:t.images;return Array.isArray(l)?l:[]}catch{return[]}})(),{data:p,error:y}=await M.functions.invoke("ml-publish",{body:{product:{id:t==null?void 0:t.id,external_id:t==null?void 0:t.external_id,cj_product_id:(t==null?void 0:t.external_id)??null,cj_product_url:Ot(t==null?void 0:t.external_id),cj_variant_id:Bt(t==null?void 0:t.variants),title:j.trim(),price:b,cost_price:R,description:E||`${j} - Produto de alta qualidade com envio rápido.`,images:x,available_quantity:Math.min(D,10),condition:"new"}}});if(y||p!=null&&p.error){let l=p==null?void 0:p.error;const f=y==null?void 0:y.context;if(!l&&f&&typeof f.json=="function")try{const C=await f.json();l=(C==null?void 0:C.error)||(C==null?void 0:C.message)}catch{}u.error(l||(y==null?void 0:y.message)||"Erro ao publicar"),L(!1);return}se({permalink:p.permalink,item_id:p.item_id}),c(3),jt(o.id),u.success("Produto publicado com sucesso"),k.refreshUsage(),p.permalink&&window.open(p.permalink,"_blank","noopener,noreferrer")}catch(x){u.error((x==null?void 0:x.message)||"Erro inesperado")}finally{L(!1)}};if(!a&&!S||!t)return null;const je=j.length,ce=m===1?le&&z&&!!j.trim()&&b>R:!0,ve=N?48:0,B=k.plan==="pro"&&k.productLimitReached,Ne=B?"Limite do Pro atingido":"Desbloqueie a operação completa",we=B?"Você atingiu o limite de 30 produtos do plano Pro.":"O plano grátis é modo teste: você pode explorar o catálogo e conectar 1 marketplace, mas publicações reais exigem um plano operacional.",ke=B?"Upgrade Business":"Desbloquear operação completa",Ae=B?"business":"pro",s=B?["Produtos ilimitados","Marketplaces ilimitados","Agentes IA ilimitados","Operação sem limites"]:["Publicação automática","Até 30 produtos publicados","Monitoramento básico 24h","Relatórios financeiros"];return xt.createPortal(e.jsxs("div",{className:"fixed left-0 right-0 bottom-0 z-[60] flex justify-end",style:{top:ve,height:`calc(100vh - ${ve}px)`},children:[e.jsx("div",{className:`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-150 ${S?"opacity-100":"opacity-0"}`,onClick:Y}),e.jsxs("div",{className:`relative flex w-full max-w-[1040px] h-full overflow-hidden bg-white shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out ${S?"translate-x-0":"translate-x-full"}`,children:[e.jsxs("div",{className:"flex flex-1 flex-col min-w-0",children:[e.jsxs("div",{className:"flex items-start justify-between px-8 pt-7 pb-5",children:[e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("div",{className:"flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50",children:e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:O,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"}),e.jsx("polyline",{points:"3.27 6.96 12 12.01 20.73 6.96"}),e.jsx("line",{x1:"12",y1:"22.08",x2:"12",y2:"12"})]})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-[15px] font-semibold text-[#0A0A0A] leading-tight",children:"Importar Produto"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-0.5",children:"Publique facilmente no Mercado Livre."})]})]}),e.jsx("button",{onClick:Y,className:"flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors",children:e.jsx(Be,{size:16})})]}),e.jsx("div",{className:"px-8 pb-6",children:e.jsx("div",{className:"flex items-center",children:Ve.map((o,v)=>{const g=m===o.num,x=m>o.num;return e.jsxs("div",{className:"flex items-center flex-1 last:flex-initial",children:[e.jsxs("button",{onClick:()=>{x&&c(o.num)},className:"flex items-center gap-2.5 group",disabled:!x&&!g,children:[e.jsx("span",{className:`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${g?"text-white shadow-[0_0_0_4px_rgba(249,115,22,0.15)]":x?"bg-[#0A0A0A] text-white":"bg-gray-100 text-gray-400"}`,style:g?{background:O}:void 0,children:x?e.jsx(ae,{size:12,strokeWidth:3}):o.num}),e.jsx("span",{className:`text-[13px] font-medium transition-colors ${g||x?"text-[#0A0A0A]":"text-gray-400"}`,children:o.label})]}),v<Ve.length-1&&e.jsx("div",{className:"flex-1 mx-3 h-px bg-gray-200 relative overflow-hidden",children:e.jsx("div",{className:"absolute inset-y-0 left-0 bg-[#0A0A0A] transition-all duration-500 ease-out",style:{width:m>o.num?"100%":"0%"}})})]},o.num)})})}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-8",style:{scrollbarWidth:"thin",minHeight:320},children:[m===1&&e.jsxs("div",{className:"step-fade space-y-6 pb-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-[14px] font-semibold text-[#0A0A0A]",children:"Título e precificação"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-1",children:"Edite o título e defina seu preço de venda."})]}),z===!1&&e.jsxs("div",{className:"flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[13px] font-medium text-[#0A0A0A]",children:"Conecte sua conta"}),e.jsx("p",{className:"text-[11.5px] text-gray-500 mt-0.5",children:"É necessário para publicar anúncios"})]}),e.jsx("button",{onClick:be,className:"rounded-lg bg-[#0A0A0A] px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1a1a1a] transition-colors",children:"Conectar"})]}),!le&&e.jsxs("div",{className:"rounded-xl border border-red-100 bg-red-50/40 px-4 py-3",children:[e.jsx("p",{className:"text-[13px] font-medium text-red-600",children:"Produto sem estoque disponível"}),e.jsx("p",{className:"text-[11.5px] text-red-500/80 mt-0.5",children:"Não é possível continuar com este produto."})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600",children:"Título do anúncio"}),e.jsxs("button",{onClick:Me,disabled:X,className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50",children:[X?e.jsx(Ee,{size:11,className:"animate-spin"}):e.jsx(vt,{size:11}),X?"Traduzindo":ie?"Retraduzir":"Traduzir p/ PT-BR"]})]}),e.jsx("input",{value:j,onChange:o=>{o.target.value.length<=T&&w(o.target.value)},maxLength:T,className:"w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400",placeholder:"Digite o título"}),e.jsxs("p",{className:"text-[10.5px] text-gray-400 text-right mt-1.5",children:[je,"/",T]})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-[12px] font-medium text-gray-600",children:"Precificação"}),e.jsx("div",{className:"rounded-xl border border-gray-200 divide-y divide-gray-100",children:e.jsx(te,{label:"Custo do produto",value:H(G)})}),e.jsxs("div",{className:"rounded-xl border border-gray-200 p-4",children:[e.jsxs("div",{className:"flex items-center justify-between mb-3",children:[e.jsx("span",{className:"text-[12px] font-medium text-gray-600",children:"Multiplicador"}),e.jsxs("span",{className:"text-[13px] font-semibold text-[#0A0A0A]",children:[Q.toFixed(1),"x"]})]}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:"range",min:"1.5",max:"5.0",step:"0.1",value:Q,onChange:o=>{const v=Number(o.target.value);ue(v),he(v)},className:"w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 slider",style:{background:`linear-gradient(to right, ${O} 0%, ${O} ${(Q-1.5)/(5-1.5)*100}%, #e5e7eb ${(Q-1.5)/(5-1.5)*100}%, #e5e7eb 100%)`}}),e.jsx("style",{children:`
                        .slider::-webkit-slider-thumb {
                          appearance: none;
                          height: 18px;
                          width: 18px;
                          border-radius: 50%;
                          background: ${O};
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        }
                        .slider::-moz-range-thumb {
                          height: 18px;
                          width: 18px;
                          border-radius: 50%;
                          background: ${O};
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        }
                      `})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600 mb-2 block",children:"Preço de venda"}),e.jsxs("div",{className:"relative",children:[e.jsx("span",{className:"absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-gray-400",children:"R$"}),e.jsx("input",{type:"number",step:"0.01",min:"0",value:b||"",readOnly:!0,className:"w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors"})]})]}),e.jsxs("div",{className:"flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3",children:[e.jsx("span",{className:"text-[12px] text-gray-500",children:"Lucro por venda"}),e.jsxs("span",{className:`text-[13.5px] font-semibold ${P>0?"text-[#0A0A0A]":"text-red-500"}`,children:[H(P)," ",e.jsxs("span",{className:"text-[11px] font-medium text-gray-400 ml-1",children:["· ",J,"%"]})]})]})]})]},"s2"),m===2&&e.jsxs("div",{className:"step-fade space-y-6 pb-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-[14px] font-semibold text-[#0A0A0A]",children:"Revisar anúncio"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-1",children:"Escolha onde publicar e finalize a descrição."})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5 mb-2.5",children:[e.jsx(Nt,{size:12,className:"text-gray-500"}),e.jsx("p",{className:"text-[12px] font-medium text-gray-600",children:"Publicar em"})]}),e.jsxs("div",{className:"grid grid-cols-3 gap-2.5",children:[e.jsx($e,{name:"Mercado Livre",status:z?"Conectado":"Desconectado",disabled:!z,selected:W.ml&&!!z,onToggle:()=>{z&&Se(o=>({...o,ml:!o.ml}))}}),e.jsx($e,{name:"Shopee",status:"Em breve",disabled:!0,selected:!1,onToggle:()=>{}}),e.jsx($e,{name:"TikTok Shop",status:"Em breve",disabled:!0,selected:!1,onToggle:()=>{}})]}),!z&&e.jsx("button",{onClick:be,className:"mt-2.5 text-[11.5px] font-medium text-[#0A0A0A] underline hover:no-underline",children:"Conectar Mercado Livre"})]}),e.jsxs("div",{className:"rounded-xl border border-gray-200 divide-y divide-gray-100",children:[e.jsx(te,{label:"Título",value:j}),e.jsx(te,{label:"Plataforma",value:"Mercado Livre"}),e.jsx(te,{label:"Preço",value:H(b)}),e.jsx(te,{label:"Estoque publicado",value:`${Math.min(D,10)} un`}),e.jsx(te,{label:"Lucro",value:H(P),strong:!0})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600",children:"Descrição do anúncio"}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("button",{onClick:Ie,disabled:K,className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50",children:[K?e.jsx(Ee,{size:11,className:"animate-spin"}):e.jsx(wt,{size:11}),K?"Gerando":"Gerar com IA"]}),e.jsxs("button",{onClick:()=>{if(!E.trim()){u.error("Crie uma descrição antes de fazer o vídeo");return}const o=ee||"",v=p=>{if(!p)return"";if(p.match(/\.(png|jpg|jpeg)(\?|$)/i))return p;if(p.includes(".webp"))return p.replace(".webp",".jpg");const y=p.includes("?")?"&":"?";return`${p}${y}format=jpg`},g=v(o),x=(()=>{try{const p=typeof t.images=="string"?JSON.parse(t.images):t.images;return Array.isArray(p)?p.map(y=>v(y)).filter(Boolean):[g].filter(Boolean)}catch{return[g].filter(Boolean)}})();r(),h("/dashboard/criar-video",{state:{product_title:t.title,product_image:g,product_images:x,product_description:E,cost_price:t.cost_price,sale_price:t.suggested_price,profit:Math.round((t.suggested_price-t.cost_price)*100)/100}})},disabled:!E.trim(),className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-30",children:[e.jsx(kt,{size:11}),"Criar vídeo"]})]})]}),e.jsx("textarea",{value:E,onChange:o=>V(o.target.value),placeholder:"Clique em 'Gerar com IA' ou escreva manualmente…",rows:5,className:"w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 resize-none"})]})]},"s3"),m===3&&U&&e.jsxs("div",{className:"step-fade flex flex-col items-center justify-center py-14 text-center",children:[e.jsx("div",{className:"flex h-14 w-14 items-center justify-center rounded-full mb-5",style:{background:O},children:e.jsx(ae,{size:26,strokeWidth:3,className:"text-white"})}),e.jsx("h3",{className:"text-[16px] font-semibold text-[#0A0A0A]",children:"Anúncio publicado"}),e.jsxs("p",{className:"text-[12.5px] text-gray-500 mt-1.5 max-w-[320px]",children:["Seu produto já está no Mercado Livre. ID: ",e.jsx("span",{className:"font-medium text-[#0A0A0A]",children:U.item_id})]}),e.jsxs("a",{href:U.permalink,target:"_blank",rel:"noopener noreferrer",className:"btn-primary btn-primary--md mt-6",children:[e.jsx(At,{size:13}),"Abrir no Mercado Livre"]})]},"s4")]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-gray-100 px-8 py-4 bg-white",children:[e.jsxs("p",{className:"text-[11.5px] text-gray-400",children:["Saiba mais sobre ",e.jsx("span",{className:"text-[#0A0A0A] underline cursor-pointer",children:"Importar Produto"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[m<4&&e.jsx("button",{onClick:Y,className:"rounded-[100px] px-4 py-2 text-[12.5px] font-[400] text-[#737373] transition-all duration-[120ms] hover:text-[#0A0A0A]",children:"Cancelar"}),m>1&&m<4&&e.jsx("button",{onClick:()=>c(m-1),className:"rounded-[100px] border-[1.5px] border-[#E5E5E5] px-4 py-2 text-[12.5px] font-[400] text-[#0A0A0A] transition-all duration-[120ms] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]",children:"Voltar"}),m<2&&e.jsxs("button",{onClick:()=>{ce?c(m+1):u.error("Conecte a conta, confira o estoque, título e preço")},disabled:!ce,className:"btn-primary btn-primary--md",children:["Próximo",e.jsx(tt,{size:13})]}),m===2&&e.jsxs("button",{onClick:ye,disabled:I,className:"btn-primary btn-primary--md",children:[I&&e.jsx(Ee,{size:13,className:"animate-spin"}),I?"Publicando":"Publicar"]}),m===3&&e.jsx("button",{onClick:Y,className:"btn-primary btn-primary--md",children:"Concluir"})]})]})]}),e.jsxs("div",{className:"w-[300px] shrink-0 border-l border-gray-100 bg-gray-50/40 flex flex-col",children:[e.jsx("div",{className:"flex items-center justify-between px-6 pt-7 pb-4",children:e.jsx("h3",{className:"text-[13px] font-semibold text-[#0A0A0A]",children:"Detalhes do produto"})}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-6 pb-6 space-y-5",style:{scrollbarWidth:"thin"},children:[e.jsxs("div",{className:"flex gap-3",children:[e.jsx("div",{className:"h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100",children:ee?e.jsx("img",{src:ee,alt:j,className:"h-full w-full object-cover"}):null}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-[12.5px] font-semibold text-[#0A0A0A] leading-snug line-clamp-2",children:j||t.title}),e.jsxs("p",{className:"text-[10.5px] text-gray-400 mt-1 truncate",children:["SKU: ",t.external_id||t.id.substring(0,10)]})]})]}),t.category&&e.jsx("div",{className:"flex gap-1.5 flex-wrap",children:e.jsx("span",{className:"rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[10.5px] font-medium text-gray-600 capitalize",children:t.category})}),e.jsx("div",{className:"h-px bg-gray-200"}),e.jsxs("div",{className:"space-y-3",children:[e.jsx(pe,{label:"Plataforma",value:e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"h-2 w-2 rounded-full bg-yellow-400"}),"Mercado Livre"]})}),e.jsx(pe,{label:"Preço",value:e.jsx("span",{className:"font-semibold text-[#0A0A0A]",children:H(b||G*2.5)})}),e.jsx(pe,{label:"Estoque",value:`${D} un`}),e.jsx(pe,{label:"Custo",value:H(G)}),m>=2&&e.jsx(pe,{label:"Lucro",value:e.jsx("span",{className:P>0?"text-[#0A0A0A] font-medium":"text-red-500",children:H(P)})})]}),e.jsx("div",{className:"h-px bg-gray-200"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10.5px] font-medium text-gray-400 uppercase tracking-wide mb-2",children:"Descrição"}),e.jsx("p",{className:"text-[12px] text-gray-600 leading-relaxed line-clamp-6",children:Ce?"Traduzindo descrição para PT-BR...":E||"A descrição aparecerá aqui quando for gerada ou escrita."})]})]})]}),I&&e.jsx("div",{className:"absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[3px] animate-in fade-in duration-200",children:e.jsxs("div",{className:"flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] px-10 py-8",children:[e.jsxs("div",{className:"relative h-12 w-12",children:[e.jsx("div",{className:"absolute inset-0 rounded-full border-2 border-gray-100"}),e.jsx("div",{className:"absolute inset-0 rounded-full border-2 border-transparent animate-spin",style:{borderTopColor:O}})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-[13.5px] font-semibold text-[#0A0A0A]",children:"Aguarde um momento"}),e.jsx("p",{className:"text-[11.5px] text-gray-500 mt-0.5",children:"Publicando seu anúncio…"})]})]})})]}),e.jsx(et,{open:oe,onClose:()=>ge(!1),title:Ne,message:we,cta:ke,targetPlan:Ae,benefits:s}),e.jsx("style",{children:`
        .step-fade {
          animation: stepIn 150ms ease both;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `})]}),document.body)},te=({label:a,value:r,strong:t})=>e.jsxs("div",{className:"flex items-center justify-between px-4 py-2.5",children:[e.jsx("span",{className:"text-[12px] text-gray-500",children:a}),e.jsx("span",{className:`text-[12.5px] text-right truncate max-w-[60%] ${t?"font-semibold text-[#0A0A0A]":"text-[#0A0A0A]"}`,children:r})]}),pe=({label:a,value:r})=>e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[11.5px] text-gray-500",children:a}),e.jsx("span",{className:"text-[12px] text-[#0A0A0A]",children:r})]}),$e=({name:a,status:r,selected:t,disabled:n,onToggle:h})=>e.jsxs("button",{onClick:h,disabled:n,className:`relative rounded-xl border p-3 text-center transition-all ${t?"border-[#0A0A0A] bg-[#0A0A0A]/[0.02]":n?"border-gray-200 opacity-50 cursor-not-allowed":"border-gray-200 hover:border-gray-400"}`,children:[t&&e.jsx("span",{className:"absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A]",children:e.jsx(ae,{size:9,strokeWidth:3,className:"text-white"})}),e.jsx("p",{className:`text-[12.5px] font-semibold ${t?"text-[#0A0A0A]":n?"text-gray-500":"text-[#0A0A0A]"}`,children:a}),e.jsx("p",{className:"text-[10.5px] text-gray-400 mt-0.5",children:r})]}),We=[{id:"mercadolivre",name:"Mercado Livre",subtitle:"Integração disponível",section:"available"},{id:"shopee",name:"Shopee",subtitle:"Disponível em breve",section:"coming_soon"},{id:"amazon",name:"Amazon",subtitle:"Disponível em breve",section:"coming_soon"},{id:"shopify",name:"Shopify",subtitle:"Disponível em breve",section:"coming_soon"}],Vt=({on:a,onChange:r,disabled:t=!1})=>e.jsx("button",{onClick:r,disabled:t,title:t?"Disponível em breve":void 0,className:`relative h-6 w-11 rounded-full transition-colors ${t?"cursor-not-allowed bg-gray-200 opacity-60 dark:bg-zinc-800":a?"bg-green-500":"bg-gray-200 dark:bg-zinc-700"}`,children:e.jsx("span",{className:`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${a?"left-5":"left-0.5"}`})}),Ge=({name:a})=>e.jsx("div",{className:"flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 dark:border-white/10 dark:bg-white",children:e.jsx(Et,{platform:a,size:40})}),Wt=({open:a,onClose:r})=>{const{user:t}=Ze(),n=qe(),[h,k]=i.useState(!1),[N,m]=i.useState(!1),[c,j]=i.useState(!1);i.useEffect(()=>{!a||!t||(m(!0),M.from("user_integrations").select("access_token").eq("user_id",t.id).eq("platform","mercadolivre").maybeSingle().then(({data:d})=>k(!!(d!=null&&d.access_token))).finally(()=>m(!1)))},[a,t]);const w=async()=>{if(!t)return;if(!n.loading&&!h&&!n.canConnectMarketplace){j(!0);return}const{data:d,error:I}=await M.functions.invoke("ml-connect"),L=(d==null?void 0:d.authUrl)??(d==null?void 0:d.auth_url);if(I||!L){u.error("Não foi possível iniciar a conexão com o Mercado Livre");return}window.location.href=L},b=async()=>{if(!t)return;const{error:d}=await M.from("user_integrations").delete().eq("user_id",t.id).eq("platform","mercadolivre");if(d){u.error("Não foi possível desconectar o Mercado Livre");return}k(!1),n.refreshUsage(),u.success("Mercado Livre desconectado")};if(!a)return null;const _=We.filter(d=>d.section==="available"),S=We.filter(d=>d.section==="coming_soon"),A=n.plan==="pro"?"business":"pro",z=A==="business"?["Marketplaces ilimitados","Produtos ilimitados","Analytics premium","Processamento prioritário"]:["Até 2 marketplaces","Publicação automática","Monitoramento básico 24h","Suporte prioritário"];return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40",onClick:r}),e.jsxs("div",{className:"relative w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-start justify-between p-6 pb-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",children:e.jsx(_t,{size:20})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-base font-bold text-foreground",children:"Integração de Plataformas"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Conecte suas plataformas de venda."})]})]}),e.jsx("button",{onClick:r,className:"text-muted-foreground hover:text-foreground transition-colors",children:e.jsx(Be,{size:18})})]}),e.jsxs("div",{className:"px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto",style:{scrollbarWidth:"none"},children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Disponível"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:_.map(d=>e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded-xl border border-border p-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(Ge,{name:d.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:d.name}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:d.subtitle})]})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:`rounded-full px-2.5 py-1 text-[11px] font-semibold ${h?"bg-green-100 text-green-700":"bg-muted text-muted-foreground"}`,children:N?"Verificando...":h?"Conectado":"Desconectado"}),e.jsx("button",{onClick:h?b:w,disabled:N,className:"rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black",children:h?"Desconectar":"Conectar"})]})]},d.id))})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Em breve"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:S.map(d=>e.jsxs("div",{title:"Disponível em breve",className:"flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-3",children:[e.jsx(Ge,{name:d.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold text-foreground",children:d.name}),e.jsx("p",{className:"truncate text-[10px] text-muted-foreground",children:d.subtitle})]})]}),e.jsxs("div",{className:"flex shrink-0 items-center gap-2",children:[e.jsx("span",{className:"rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground",children:"Em breve"}),e.jsx(Vt,{on:!1,onChange:()=>{},disabled:!0})]})]},d.id))})]})]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-border px-6 py-4",children:[e.jsxs("p",{className:"text-xs text-muted-foreground",children:["Saiba mais sobre"," ",e.jsx("a",{href:"#",className:"text-foreground underline underline-offset-2 hover:text-muted-foreground",children:"Plataformas"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:r,className:"text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors",children:"Cancelar"}),e.jsx("button",{onClick:r,className:"btn-primary btn-primary--md",children:"Concluir"})]})]})]}),e.jsx(et,{open:c,onClose:()=>j(!1),title:"Limite de marketplaces atingido",message:"Seu plano atual não permite conectar outro marketplace. Faça upgrade para liberar mais integrações.",cta:A==="business"?"Upgrade Business":"Desbloquear operação completa",targetPlan:A,benefits:z})]})},Gt=Rt,Jt=$t,nt=i.forwardRef(({className:a,...r},t)=>e.jsx(rt,{ref:t,className:me("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",a),...r}));nt.displayName=rt.displayName;const lt=i.forwardRef(({className:a,children:r,...t},n)=>e.jsxs(Jt,{children:[e.jsx(nt,{}),e.jsxs(st,{ref:n,className:me("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",a),...t,children:[r,e.jsxs(Ft,{className:"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",children:[e.jsx(Be,{className:"h-4 w-4"}),e.jsx("span",{className:"sr-only",children:"Close"})]})]})]}));lt.displayName=st.displayName;const ct=({className:a,...r})=>e.jsx("div",{className:me("flex flex-col space-y-1.5 text-center sm:text-left",a),...r});ct.displayName="DialogHeader";const dt=i.forwardRef(({className:a,...r},t)=>e.jsx(ot,{ref:t,className:me("text-lg font-semibold leading-none tracking-tight",a),...r}));dt.displayName=ot.displayName;const Yt=i.forwardRef(({className:a,...r},t)=>e.jsx(it,{ref:t,className:me("text-sm text-muted-foreground",a),...r}));Yt.displayName=it.displayName;const Ht={price:.4,shipping:.3,stock:.2,rating:.1};function Qt(a,r,t=Ht){if(a.stock_status!=="available")return 0;const n=r.map(A=>A.cost_price+A.shipping_cost),h=Math.min(...n),k=Math.max(...n),N=a.cost_price+a.shipping_cost,m=k===h?100:(k-N)/(k-h)*100,c=r.map(A=>A.shipping_days),j=Math.min(...c),w=Math.max(...c),b=w===j?100:(w-a.shipping_days)/(w-j)*100,_=a.stock_status==="available"?100:0,S=(a.rating||0)*20;return Math.round(t.price*m+t.shipping*b+t.stock*_+t.rating*S)}function Kt(a){const r=a.filter(n=>n.stock_status==="available");if(r.length===0)return{best:null,ranked:[]};const t=r.map(n=>({...n,_score:Qt(n,r)}));return t.sort((n,h)=>(h._score??0)-(n._score??0)),{best:t[0],ranked:t}}function Xt(a){return Xe({queryKey:["supplier_products",a],enabled:!!a,queryFn:async()=>{const{data:r,error:t}=await M.from("supplier_products").select("*, supplier:suppliers(*)").eq("product_id",a);if(t)throw t;return(r||[]).map(n=>({...n,supplier:n.supplier}))}})}const Fe=a=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a);function Zt({open:a,onClose:r,productId:t,productTitle:n}){const{data:h,isLoading:k}=Xt(t),{best:N,ranked:m}=Kt(h||[]);return e.jsx(Gt,{open:a,onOpenChange:c=>!c&&r(),children:e.jsxs(lt,{className:"max-w-lg",children:[e.jsxs(ct,{children:[e.jsx(dt,{className:"text-base font-semibold",children:"Fornecedores disponíveis"}),e.jsx("p",{className:"text-xs text-muted-foreground line-clamp-1 mt-0.5",children:n})]}),k?e.jsx("div",{className:"space-y-3 py-4",children:[1,2].map(c=>e.jsx(xe,{className:"h-20 w-full rounded-xl"},c))}):m.length===0?e.jsxs("div",{className:"flex flex-col items-center py-10 text-center",children:[e.jsx(zt,{size:32,className:"text-muted-foreground/40 mb-3"}),e.jsx("p",{className:"text-sm font-medium text-foreground",children:"Nenhum fornecedor disponível"}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:"Este produto ainda não possui fornecedores vinculados ou todos estão sem estoque."})]}):e.jsx("div",{className:"space-y-2.5 py-2",children:m.map((c,j)=>{var _;const w=(N==null?void 0:N.id)===c.id,b=c.cost_price+c.shipping_cost;return e.jsxs("div",{className:`relative rounded-xl border p-3.5 transition-colors ${w?"border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20":"border-border bg-background"}`,children:[w&&e.jsxs("span",{className:"absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white",children:[e.jsx(Ct,{size:10})," Melhor opção"]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:((_=c.supplier)==null?void 0:_.name)||"Fornecedor"}),e.jsxs("p",{className:"text-[11px] text-muted-foreground mt-0.5",children:["Score: ",c._score??0,"/100"]})]}),e.jsxs("div",{className:"text-right",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:Fe(b)}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:"custo total"})]})]}),e.jsxs("div",{className:"mt-2.5 grid grid-cols-4 gap-2",children:[e.jsx(_e,{icon:St,label:"Custo",value:Fe(c.cost_price)}),e.jsx(_e,{icon:Pt,label:"Frete",value:Fe(c.shipping_cost)}),e.jsx(_e,{icon:ze,label:"Prazo",value:`${c.shipping_days}d`}),e.jsx(_e,{icon:at,label:"Nota",value:c.rating?`${c.rating}/5`:"—"})]})]},c.id)})})]})})}function _e({icon:a,label:r,value:t}){return e.jsxs("div",{className:"flex flex-col items-center rounded-lg bg-muted/50 p-1.5",children:[e.jsx(a,{size:12,className:"text-muted-foreground mb-0.5"}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:r}),e.jsx("p",{className:"text-[11px] font-semibold text-foreground",children:t})]})}function ea(a,r){const t=new AbortController,n=window.setTimeout(()=>t.abort(),a);return r==null||r.addEventListener("abort",()=>t.abort(),{once:!0}),{signal:t.signal,clear:()=>window.clearTimeout(n)}}const Je=[{key:"todos",label:"Todos"},{key:"beleza",label:"Beleza"},{key:"casa",label:"Casa"},{key:"eletronicos",label:"Eletrônicos"},{key:"moda",label:"Moda"},{key:"esporte",label:"Esporte"},{key:"pet",label:"Pet"},{key:"bebes",label:"Bebês"},{key:"organizacao",label:"Organização"}],Ye=[{key:"todos",label:"Todas as datas"},{key:"today",label:"Hoje"},{key:"7d",label:"Últimos 7 dias"},{key:"30d",label:"Últimos 30 dias"},{key:"90d",label:"Últimos 90 dias"}],He=[{key:"todos",label:"Status de preço"},{key:"priced",label:"Com preço"},{key:"missing_price",label:"Sem preço"},{key:"positive_margin",label:"Margem positiva"}],Qe={cj:{label:"CJ Dropshipping",bg:"#fff4e8",color:"#d86500",icon:"CJ"},aliexpress:{label:"AliExpress",bg:"#fff0f0",color:"#d82f2f",icon:"AE"},amazon:{label:"Amazon",bg:"#fff8de",color:"#a76f00",icon:"AZ"},shopee:{label:"Shopee",bg:"#fff1e8",color:"#d84b23",icon:"SP"},mercadolivre:{label:"Mercado Livre",bg:"#fffbd8",color:"#977000",icon:"ML"}};function ta(a){return a?Qe[a.toLowerCase()]??{label:a,bg:"#f4f4f5",color:"#52525b",icon:a.slice(0,2).toUpperCase()}:Qe.cj}const aa=a=>a?a.replace(/_/g," ").replace(/\b\w/g,r=>r.toUpperCase()):"Catálogo",pt=a=>{try{const r=typeof a=="string"?JSON.parse(a):a;return Array.isArray(r)&&r.length>0?String(r[0]):null}catch{return null}},Ke=({product:a,index:r,onImport:t,onCompare:n,formatPrice:h})=>{const k=pt(a.images),[N,m]=i.useState(r===1),[c,j]=i.useState(!1),w=ta(a.source),b=Math.max(0,Number(a.suggested_price??0)-Number(a.cost_price??0)),_=Number(a.margin_percent??0)||(Number(a.cost_price)>0?b/Number(a.cost_price)*100:0),S=Number(a.suggested_price??0)>0?Number(a.suggested_price):Number(a.cost_price??0),A=aa(a.category);return i.useEffect(()=>{j(!1)},[k]),e.jsxs("article",{className:"catalog-product-card",children:[e.jsxs("div",{className:"catalog-product-media",children:[e.jsx("span",{className:"catalog-product-pill",children:A}),e.jsx("button",{type:"button",className:`catalog-heart-button ${N?"is-active":""}`,onClick:()=>m(z=>!z),"aria-label":N?"Remover dos favoritos":"Adicionar aos favoritos",children:e.jsx(Tt,{size:16,strokeWidth:1.9,fill:N?"currentColor":"none"})}),k&&!c?e.jsx("img",{src:k,alt:a.title,className:"catalog-product-image",loading:"lazy",decoding:"async",onError:()=>j(!0)}):e.jsx("div",{className:"catalog-image-fallback",children:e.jsx(ze,{size:40,strokeWidth:1.35})})]}),e.jsxs("div",{className:"catalog-product-body",children:[e.jsxs("div",{className:"catalog-product-source",style:{color:w.color,background:w.bg},children:[e.jsx("span",{children:w.icon}),w.label]}),e.jsx("h3",{children:a.title}),e.jsxs("div",{className:"catalog-product-meta",children:[e.jsxs("span",{children:[e.jsx(at,{size:13,strokeWidth:1.8,fill:"currentColor"}),_>0?`${Math.round(_)}% margem`:"Novo"]}),e.jsx("strong",{children:h(S)})]}),e.jsxs("div",{className:"catalog-card-actions",children:[e.jsx("button",{type:"button",onClick:n,className:"catalog-secondary-button",children:"Fornecedores"}),e.jsx("button",{type:"button",onClick:t,className:"catalog-primary-button",children:"Importar"})]})]})]})},ha=()=>{var we,ke,Ae;const[a,r]=i.useState("todos"),[t,n]=i.useState(1),[h,k]=i.useState(""),[N,m]=i.useState("todos"),[c,j]=i.useState("todos"),[w,b]=i.useState(!0),[_,S]=i.useState("popular"),[A,z]=i.useState(""),[d,I]=i.useState(""),[L,U]=i.useState(!1),[se,oe]=i.useState(!1),[ge,Q]=i.useState(null),[ue,E]=i.useState(!1),[V,K]=i.useState(!1),[re,X]=i.useState(null),[fe,Ce]=i.useState(""),Z=i.useRef(null),ie=i.useRef(null),ne=mt(),W=qe(),Se=12,Pe="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";i.useEffect(()=>{const s=o=>{Z.current&&!Z.current.contains(o.target)&&U(!1),ie.current&&!ie.current.contains(o.target)&&oe(!1)};return document.addEventListener("mousedown",s),()=>document.removeEventListener("mousedown",s)},[]);const{data:q,isLoading:G,isError:R,refetch:he}=Xe({queryKey:["catalog",a,t,h],staleTime:60*1e3,retry:1,queryFn:async({signal:s})=>{const o=new URLSearchParams({page:String(t),limit:String(Se)});a!=="todos"&&o.set("category",a),h&&o.set("search",h);const g=`${ft}/functions/v1/catalog?${o}`,x=ea(8e3,s);try{const p=await fetch(g,{headers:{Authorization:`Bearer ${Pe}`},signal:x.signal});if(!p.ok)throw new Error("Failed to fetch catalog");return p.json()}finally{x.clear()}}}),P=gt({mutationFn:async()=>{const{data:s,error:o}=await M.functions.invoke("cj-sync-request");if(o)throw new Error(o.message);if(s!=null&&s.error)throw new Error(s.error);return s},onSuccess:s=>{const o=s.synced??0;u.success(o>0?`${o} produtos sincronizados com sucesso!`:"Sincronização concluída (nenhum produto novo encontrado)."),ne.invalidateQueries({queryKey:["catalog"]}),ne.refetchQueries({queryKey:["catalog"]})},onError:s=>u.error(`Erro ao sincronizar: ${s.message}`)}),J=(q==null?void 0:q.products)||[],ee=(q==null?void 0:q.totalPages)||1,D=i.useMemo(()=>{const s=h.trim().toLowerCase(),o=new Date,v=A.trim()===""?Number.NEGATIVE_INFINITY:Number(A.replace(",",".")),g=d.trim()===""?Number.POSITIVE_INFINITY:Number(d.replace(",",".")),x=Number.isFinite(v)?v:Number.NEGATIVE_INFINITY,p=Number.isFinite(g)?g:Number.POSITIVE_INFINITY;return[...J.filter(l=>{const f=l.stock_quantity;if(f!=null&&Number(f)<=0)return!1;const C=[l.title,l.category,l.source,l.supplier_name,l.external_id].filter(Boolean).join(" ").toLowerCase();if(s&&!C.includes(s))return!1;const de=Number(l.suggested_price??l.cost_price??0);if(de<x||de>p)return!1;if(N!=="todos"){const $=l.created_at||l.updated_at;if(!$)return!1;const F=new Date($);if(Number.isNaN(F.getTime()))return!1;if(N==="today"){if(F.toDateString()!==o.toDateString())return!1}else{const De=Number(N.replace("d","")),Te=new Date(o);if(Te.setDate(o.getDate()-De),F<Te)return!1}}if(c!=="todos"){const $=Number(l.cost_price)>0&&Number(l.suggested_price)>0,F=Number(l.margin_percent)>0||Number(l.suggested_price)>Number(l.cost_price);if(c==="priced"&&!$||c==="missing_price"&&$||c==="positive_margin"&&!F)return!1}return!(w&&l.is_active===!1)})].sort((l,f)=>{const C=Number(l.suggested_price??l.cost_price??0),de=Number(f.suggested_price??f.cost_price??0),$=Math.max(0,Number(l.suggested_price??0)-Number(l.cost_price??0)),F=Math.max(0,Number(f.suggested_price??0)-Number(f.cost_price??0));if(_==="price_asc")return C-de;if(_==="price_desc")return de-C;if(_==="profit_desc")return F-$;if(_==="newest")return new Date(f.created_at||f.updated_at||0).getTime()-new Date(l.created_at||l.updated_at||0).getTime();const De=Number(l.margin_percent??0)||(Number(l.cost_price)>0?$/Number(l.cost_price)*100:0);return(Number(f.margin_percent??0)||(Number(f.cost_price)>0?F/Number(f.cost_price)*100:0))-De||F-$})},[J,h,N,c,w,A,d,_]),le=i.useMemo(()=>J.reduce((s,o)=>(s.todos=(s.todos||0)+1,o.category&&(s[o.category]=(s[o.category]||0)+1),s),{}),[J]),Y=s=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(s),be=((we=Je.find(s=>s.key===a))==null?void 0:we.label)??"Todos",Me=((ke=Ye.find(s=>s.key===N))==null?void 0:ke.label)??"Todas as datas",Ie=((Ae=He.find(s=>s.key===c))==null?void 0:Ae.label)??"Status de preço",Le=[a!=="todos",N!=="todos",c!=="todos",w,!!(A||d)].filter(Boolean).length,ye=D[0]||J[0],je=ye?pt(ye.images):null,ce=D.slice(0,4),ve=()=>{k(""),r("todos"),m("todos"),j("todos"),b(!0),z(""),I(""),n(1)},B=s=>{Q(s),E(!0)},Ne=s=>{X(s.id),Ce(s.title)};return e.jsxs("div",{className:"catalog-page-shell",children:[e.jsxs("div",{className:"catalog-apple-board",children:[e.jsxs("header",{className:"catalog-topbar",children:[e.jsxs("a",{href:"/dashboard",className:"catalog-brand","aria-label":"Velo",children:[e.jsx("span",{children:"V"}),"Velo"]}),e.jsxs("nav",{"aria-label":"Seções do catálogo",children:[e.jsx("a",{href:"#produtos",children:"Produtos"}),e.jsx("a",{href:"#recomendacoes",children:"Recomendações"}),e.jsx("button",{type:"button",onClick:()=>K(!0),children:"Integrações"})]}),e.jsx("button",{type:"button",onClick:()=>P.mutate(),disabled:P.isPending,className:"catalog-sync-icon","aria-label":"Sincronizar catálogo",children:e.jsx(Mt,{size:17,strokeWidth:1.8,className:P.isPending?"animate-spin":""})})]}),e.jsxs("section",{className:"catalog-hero",style:je?{backgroundImage:`url(${je})`}:void 0,children:[e.jsx("div",{className:"catalog-hero-overlay"}),e.jsxs("div",{className:"catalog-hero-content",children:[e.jsx("span",{children:"Catálogo Velo"}),e.jsx("h1",{children:"Shop"}),e.jsx("p",{children:"Produtos reais para importar, precificar com margem e publicar em poucos cliques."})]}),e.jsxs("div",{className:"catalog-hero-stats",children:[e.jsxs("span",{children:[D.length," produtos"]}),e.jsx("span",{children:be})]})]}),e.jsxs("section",{className:"catalog-shop-panel",id:"produtos",children:[e.jsxs("div",{className:"catalog-shop-head",children:[e.jsxs("div",{children:[e.jsx("span",{className:"catalog-eyebrow",children:"Give all you need"}),e.jsx("h2",{children:"Escolha o próximo produto vencedor"})]}),e.jsxs("div",{className:"catalog-searchbar",children:[e.jsx(It,{size:16,strokeWidth:1.8}),e.jsx("input",{value:h,onChange:s=>{k(s.target.value),n(1)},placeholder:"Buscar no catálogo"}),e.jsx("button",{type:"button",onClick:()=>void he(),children:"Buscar"})]})]}),e.jsxs("div",{className:"catalog-shop-layout",children:[e.jsxs("aside",{className:"catalog-filter-rail",children:[e.jsxs("div",{className:"catalog-filter-title",children:[e.jsx("span",{children:"Categoria"}),e.jsxs("small",{children:[Le," filtros"]})]}),e.jsx("div",{className:"catalog-category-list",children:Je.map(s=>{const o=a===s.key,v=le[s.key]??0;return e.jsxs("button",{type:"button",className:o?"is-active":"",onClick:()=>{r(s.key),n(1)},children:[e.jsx("span",{className:"catalog-category-icon",children:o?e.jsx(ae,{size:13,strokeWidth:2.5}):e.jsx(Lt,{size:13,strokeWidth:1.8})}),e.jsx("span",{children:s.label}),e.jsx("strong",{children:v})]},s.key)})}),e.jsxs("div",{className:"catalog-filter-block",children:[e.jsxs("button",{type:"button",className:"catalog-filter-row",onClick:()=>U(s=>!s),children:[e.jsx("span",{children:"Data"}),e.jsx("small",{children:Me}),e.jsx(Re,{size:14,className:L?"is-open":""})]}),L&&e.jsx("div",{className:"catalog-dropdown-list",ref:Z,children:Ye.map(s=>e.jsxs("button",{type:"button",className:N===s.key?"is-active":"",onClick:()=>{m(s.key),U(!1),n(1)},children:[s.label,N===s.key&&e.jsx(ae,{size:13,strokeWidth:2.4})]},s.key))})]}),e.jsxs("div",{className:"catalog-filter-block",children:[e.jsxs("button",{type:"button",className:"catalog-filter-row",onClick:()=>oe(s=>!s),children:[e.jsx("span",{children:"Preço"}),e.jsx("small",{children:Ie}),e.jsx(Re,{size:14,className:se?"is-open":""})]}),se&&e.jsx("div",{className:"catalog-dropdown-list",ref:ie,children:He.map(s=>e.jsxs("button",{type:"button",className:c===s.key?"is-active":"",onClick:()=>{j(s.key),oe(!1),n(1)},children:[s.label,c===s.key&&e.jsx(ae,{size:13,strokeWidth:2.4})]},s.key))})]}),e.jsxs("div",{className:"catalog-price-filter",children:[e.jsx("span",{children:"Faixa de preço"}),e.jsxs("div",{children:[e.jsx("input",{value:A,onChange:s=>{z(s.target.value),n(1)},placeholder:"Mín.",inputMode:"decimal"}),e.jsx("input",{value:d,onChange:s=>{I(s.target.value),n(1)},placeholder:"Máx.",inputMode:"decimal"})]})]}),e.jsxs("label",{className:"catalog-toggle-line",children:[e.jsx("button",{type:"button",className:w?"is-active":"",onClick:()=>{b(s=>!s),n(1)},"aria-pressed":w,children:e.jsx("span",{})}),"Somente ativos"]}),e.jsxs("label",{className:"catalog-sort-select",children:[e.jsxs("select",{value:_,onChange:s=>{S(s.target.value),n(1)},children:[e.jsx("option",{value:"popular",children:"Mais promissores"}),e.jsx("option",{value:"price_asc",children:"Menor preço"}),e.jsx("option",{value:"price_desc",children:"Maior preço"}),e.jsx("option",{value:"profit_desc",children:"Maior lucro"}),e.jsx("option",{value:"newest",children:"Mais recentes"})]}),e.jsx(Re,{size:14})]}),e.jsxs("button",{type:"button",className:"catalog-clear-filters",onClick:ve,children:[e.jsx(Dt,{size:14,strokeWidth:1.8}),"Limpar filtros"]})]}),e.jsx("main",{className:"catalog-results-area",children:G?e.jsx("div",{className:"catalog-products-grid",children:Array.from({length:9}).map((s,o)=>e.jsxs("div",{className:"catalog-skeleton-card",children:[e.jsx(xe,{className:"h-[190px] w-full rounded-[18px]"}),e.jsx(xe,{className:"h-5 w-4/5 rounded-md"}),e.jsx(xe,{className:"h-4 w-2/5 rounded-md"}),e.jsx(xe,{className:"h-10 w-full rounded-full"})]},o))}):R?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(ze,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Não foi possível carregar o catálogo"}),e.jsx("span",{children:"Verifique a conexão com o Supabase e tente novamente."}),e.jsx("button",{type:"button",onClick:()=>void he(),children:"Tentar novamente"})]}):D.length===0?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(ze,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Nenhum produto encontrado"}),e.jsx("span",{children:"Sincronize ou ajuste os filtros para encontrar produtos disponíveis."}),e.jsx("button",{type:"button",onClick:()=>P.mutate(),disabled:P.isPending,children:"Sincronizar catálogo"})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"catalog-products-grid",children:D.map((s,o)=>e.jsx(Ke,{product:s,index:o,onImport:()=>B(s),onCompare:()=>Ne(s),formatPrice:Y},s.id))}),e.jsxs("div",{className:"catalog-pagination",children:[e.jsxs("button",{type:"button",onClick:()=>n(s=>Math.max(1,s-1)),disabled:t<=1,children:[e.jsx(Oe,{size:14}),"Anterior"]}),e.jsx("span",{children:t}),e.jsxs("button",{type:"button",onClick:()=>n(s=>Math.min(ee,s+1)),disabled:t>=ee,children:["Próxima",e.jsx(Ue,{size:14})]})]})]})})]})]}),ce.length>0&&e.jsxs("section",{className:"catalog-recommendations",id:"recomendacoes",children:[e.jsxs("div",{className:"catalog-section-heading",children:[e.jsx("h2",{children:"Explore recomendações"}),e.jsxs("div",{children:[e.jsx("button",{type:"button","aria-label":"Voltar recomendações",children:e.jsx(Oe,{size:18})}),e.jsx("button",{type:"button","aria-label":"Avançar recomendações",children:e.jsx(Ue,{size:18})})]})]}),e.jsx("div",{className:"catalog-recommendation-row",children:ce.map((s,o)=>e.jsx(Ke,{product:s,index:o,onImport:()=>B(s),onCompare:()=>Ne(s),formatPrice:Y},`recommendation-${s.id}`))})]}),e.jsxs("section",{className:"catalog-cta",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Pronto para vender sem travar?"}),e.jsxs("form",{onSubmit:s=>s.preventDefault(),children:[e.jsx("input",{placeholder:"Seu melhor e-mail",type:"email"}),e.jsx("button",{type:"submit",children:"Enviar"})]})]}),e.jsx("p",{children:"A Velo ajuda você a escolher, importar e publicar produtos com margem. Menos planilha, mais operação."}),e.jsx(tt,{size:28,strokeWidth:1.5})]})]}),e.jsx(Ut,{open:ue,onClose:()=>{E(!1),W.refreshUsage()},product:ge}),e.jsx(Zt,{open:!!re,onClose:()=>X(null),productId:re||"",productTitle:fe}),e.jsx(Wt,{open:V,onClose:()=>K(!1)}),e.jsx("style",{children:`
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
      `})]})};export{ha as default};
