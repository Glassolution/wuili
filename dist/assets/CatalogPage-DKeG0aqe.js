import{e as r,r as st,j as e}from"./vendor-react-DNIqRoEp.js";import{b as Ue,c as ot,u as rt}from"./vendor-query-DEHbxmQ5.js";import{S as me}from"./skeleton-V4XhJgfm.js";import{aV as it,aQ as y}from"./vendor-DBDc-N9F.js";import{u as Ve,s as I,c as ge,a as nt}from"./index-BJ_ayW1w.js";import{U as Ge}from"./UpgradeLimitModal-DDa0As-R.js";import{u as Te}from"./usePlanLimits-CJZIXba2.js";import{u as lt}from"./useStartMode-WYLVLOmc.js";import{g as ct,b as dt,i as pt}from"./FirstStoreOnboarding-BzDMbHj5.js";import{a_ as Ee,q as H,ab as Ie,U as xt,aK as ut,aI as mt,ar as gt,N as ft,e as ht,ak as bt,aO as yt,aP as jt,I as vt,aQ as Nt,al as we,aJ as kt,aH as wt,aa as At,V as _t,r as ae,ax as Ct,as as St,aA as zt,t as $e,s as Pt,Z as Mt,aF as It}from"./vendor-icons-BrYDjh4V.js";import{P as Dt}from"./PlatformLogo-CPhEvGVK.js";import{R as Lt,P as Tt,b as He,a as Et,h as Je,O as Ye,d as Qe}from"./vendor-radix-CA0u1YsU.js";import"./vendor-supabase-2gAmIy76.js";import"./usePlan-BdkaOPUs.js";const L=60,O="#0A0A0A",G=a=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a),$t=a=>{try{const o=typeof a=="string"?JSON.parse(a):a;return Array.isArray(o)&&o.length>0?o[0]:null}catch{return null}},qt=a=>{try{const o=typeof a=="string"?JSON.parse(a):a,t=Array.isArray(o)?o[0]:(o==null?void 0:o[0])??o;return(t==null?void 0:t.vid)??(t==null?void 0:t.variantId)??(t==null?void 0:t.variant_id)??(t==null?void 0:t.id)??(t==null?void 0:t.skuId)??(t==null?void 0:t.sku_id)??null}catch{return null}},Rt=a=>a?`https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(a)}`:null,qe=[{num:1,label:"Detalhes"},{num:2,label:"Revisão"}],Bt=({open:a,onClose:o,product:t})=>{const{user:l}=Ve(),h=it(),A=Te(),{isStartMode:v}=lt(),[m,c]=r.useState(1),[N,k]=r.useState(""),[b,_]=r.useState(0),[P,w]=r.useState(!1),[C,p]=r.useState(null),[S,D]=r.useState(!1),[F,oe]=r.useState(null),[re,fe]=r.useState(!1),[q,he]=r.useState(2.5),[R,W]=r.useState(""),[J,be]=r.useState(!1),[Y,ie]=r.useState(!1),[ye,je]=r.useState(!1),[Ae,Q]=r.useState(!1),[T,ne]=r.useState({ml:!0,shopee:!1,tiktok:!1});r.useEffect(()=>{!l||!a||(async()=>{const{data:i}=await I.from("user_integrations").select("access_token").eq("user_id",l.id).eq("platform","mercadolivre").maybeSingle();p(!!(i!=null&&i.access_token))})()},[l,a]),r.useEffect(()=>{a?requestAnimationFrame(()=>w(!0)):w(!1)},[a]);const[ve,_e]=r.useState(null);if(t&&t.id!==ve){_e(t.id);const i=t.title.length>L?t.title.substring(0,L):t.title;k(i),he(2.5),_(Math.round(t.cost_price*2.5*100)/100),c(1),oe(null),D(!1),W(""),Q(!1)}const U=(t==null?void 0:t.cost_price)??0,E=U,B=i=>{_(Math.round(U*i*100)/100)},V=r.useMemo(()=>Math.round((b-E)*100)/100,[b,E]),Ce=r.useMemo(()=>b>0?Math.round((b-E)/b*100):0,[b,E]),le=t?$t(t.images):null,$=(t==null?void 0:t.stock_quantity)??0,K=$>0;r.useEffect(()=>{if(!a||!(t!=null&&t.description))return;let i=!1;return(async()=>{var x,g,d;je(!0);try{const{data:f,error:j}=await I.functions.invoke("chat",{body:{messages:[{role:"user",content:`Você é um tradutor especialista em e-commerce brasileiro. Traduza a descrição deste produto para português do Brasil, mantendo o sentido original e adaptando termos naturais de venda. Não invente características novas. Responda APENAS com a descrição traduzida, sem introdução, sem comentários.

Descrição original:
${t.description}`}]}});if(j)throw j;const z=(f==null?void 0:f.response)||((d=(g=(x=f==null?void 0:f.choices)==null?void 0:x[0])==null?void 0:g.message)==null?void 0:d.content)||"";!i&&typeof z=="string"&&z.trim()&&W(z.trim())}catch{i||W(t.description??"")}finally{i||je(!1)}})(),()=>{i=!0}},[a,t==null?void 0:t.id,t==null?void 0:t.description]);const M=()=>{S||(w(!1),setTimeout(o,160))},X=async()=>{if(!l)return;const{data:i,error:n}=await I.functions.invoke("ml-connect"),x=(i==null?void 0:i.authUrl)??(i==null?void 0:i.auth_url);if(n||!x){y.error("Não foi possível iniciar a conexão com o Mercado Livre");return}window.location.href=x},Se=async()=>{var i,n,x;if(t){ie(!0);try{const{data:g,error:d}=await I.functions.invoke("chat",{body:{messages:[{role:"user",content:`Você é um tradutor especialista em e-commerce brasileiro. Traduza o nome deste produto para português do Brasil, adaptando para linguagem de venda. Máximo ${L} caracteres. Produto: "${t.title}". Responda APENAS com o título traduzido, sem aspas, sem explicação.`}]}});if(d)throw d;const f=(g==null?void 0:g.response)||((x=(n=(i=g==null?void 0:g.choices)==null?void 0:i[0])==null?void 0:n.message)==null?void 0:x.content)||"";if(typeof f=="string"&&f.trim()){const j=f.trim().replace(/^["']|["']$/g,""),z=j.length>L?j.substring(0,L):j;k(z),Q(!0),y.success("Título traduzido")}else y.error("Não foi possível traduzir")}catch{y.error("Erro ao traduzir")}finally{ie(!1)}}},ze=async()=>{var i,n,x;if(t){be(!0);try{const g=b.toFixed(2).replace(".",","),d=t.category||"Não informada",f=`Você é um especialista em copywriting para e-commerce brasileiro.
Gere uma descrição de produto persuasiva e completa para o Mercado Livre
com base nestas informações:

Nome: ${N}
Categoria: ${d}
Preço: R$ ${g}

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

Retorne APENAS a descrição, sem introdução, sem comentários.`,{data:j,error:z}=await I.functions.invoke("chat",{body:{mode:"product_description",messages:[{role:"user",content:f}]}});if(z)throw z;const xe=(j==null?void 0:j.response)||((x=(n=(i=j==null?void 0:j.choices)==null?void 0:i[0])==null?void 0:n.message)==null?void 0:x.content)||"";typeof xe=="string"&&xe.trim()?(W(xe.trim()),y.success("Descrição gerada")):y.error("Não foi possível gerar a descrição")}catch{y.error("Erro ao gerar descrição")}finally{be(!1)}}},Pe=()=>N.trim()?N.length>L?(y.error(`Máximo ${L} caracteres`),!1):b<=0?(y.error("Defina um preço válido"),!1):b<=E?(y.error("Preço deve ser maior que o custo"),!1):!T.ml&&!T.shopee&&!T.tiktok?(y.error("Selecione ao menos uma plataforma"),!1):T.ml&&!C?(y.error("Conecte sua conta do Mercado Livre"),!1):K?!0:(y.error("Produto sem estoque"),!1):(y.error("Preencha o título"),!1),Me=async()=>{if(!Pe()||!l)return;const i=ct();if(!i){y.error("Crie uma loja antes de publicar produtos");return}const n=dt(i.id),x=i.productLimit??30;if(n>=x){y.error(`Limite de ${x} produtos atingido nesta loja`);return}if(A.loading){y.info("Verificando seu plano...");return}if(!A.canPublishProducts){fe(!0);return}D(!0);try{const g=(()=>{try{const j=typeof(t==null?void 0:t.images)=="string"?JSON.parse(t.images):t==null?void 0:t.images;return Array.isArray(j)?j:[]}catch{return[]}})(),{data:d,error:f}=await I.functions.invoke("ml-publish",{body:{product:{id:t==null?void 0:t.id,external_id:t==null?void 0:t.external_id,cj_product_id:(t==null?void 0:t.external_id)??null,cj_product_url:Rt(t==null?void 0:t.external_id),cj_variant_id:qt(t==null?void 0:t.variants),title:N.trim(),price:b,cost_price:E,description:R||`${N} - Produto de alta qualidade com envio rápido.`,images:g,available_quantity:Math.min($,10),condition:"new"}}});if(f||d!=null&&d.error){y.error((d==null?void 0:d.error)||(f==null?void 0:f.message)||"Erro ao publicar"),D(!1);return}oe({permalink:d.permalink,item_id:d.item_id}),c(3),pt(i.id),y.success("Produto publicado com sucesso"),A.refreshUsage(),d.permalink&&window.open(d.permalink,"_blank","noopener,noreferrer")}catch(g){y.error((g==null?void 0:g.message)||"Erro inesperado")}finally{D(!1)}};if(!a&&!P||!t)return null;const Ne=N.length,ce=m===1?K&&C&&!!N.trim()&&b>E:!0,de=v?48:0,s=A.plan==="pro"&&A.productLimitReached,u=s?"Limite do Pro atingido":"Desbloqueie a operação completa",pe=s?"Você atingiu o limite de 30 produtos do plano Pro.":"O plano grátis é modo teste: você pode explorar o catálogo e conectar 1 marketplace, mas publicações reais exigem um plano operacional.",Z=s?"Upgrade Business":"Desbloquear operação completa",ee=s?"business":"pro",te=s?["Produtos ilimitados","Marketplaces ilimitados","Agentes IA ilimitados","Operação sem limites"]:["Publicação automática","Até 30 produtos publicados","Monitoramento básico 24h","Relatórios financeiros"];return st.createPortal(e.jsxs("div",{className:"fixed left-0 right-0 bottom-0 z-[60] flex justify-end",style:{top:de,height:`calc(100vh - ${de}px)`},children:[e.jsx("div",{className:`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-150 ${P?"opacity-100":"opacity-0"}`,onClick:M}),e.jsxs("div",{className:`relative flex w-full max-w-[1040px] h-full overflow-hidden bg-white shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out ${P?"translate-x-0":"translate-x-full"}`,children:[e.jsxs("div",{className:"flex flex-1 flex-col min-w-0",children:[e.jsxs("div",{className:"flex items-start justify-between px-8 pt-7 pb-5",children:[e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("div",{className:"flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50",children:e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:O,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"}),e.jsx("polyline",{points:"3.27 6.96 12 12.01 20.73 6.96"}),e.jsx("line",{x1:"12",y1:"22.08",x2:"12",y2:"12"})]})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-[15px] font-semibold text-[#0A0A0A] leading-tight",children:"Importar Produto"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-0.5",children:"Publique facilmente no Mercado Livre."})]})]}),e.jsx("button",{onClick:M,className:"flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors",children:e.jsx(Ee,{size:16})})]}),e.jsx("div",{className:"px-8 pb-6",children:e.jsx("div",{className:"flex items-center",children:qe.map((i,n)=>{const x=m===i.num,g=m>i.num;return e.jsxs("div",{className:"flex items-center flex-1 last:flex-initial",children:[e.jsxs("button",{onClick:()=>{g&&c(i.num)},className:"flex items-center gap-2.5 group",disabled:!g&&!x,children:[e.jsx("span",{className:`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${x?"text-white shadow-[0_0_0_4px_rgba(249,115,22,0.15)]":g?"bg-[#0A0A0A] text-white":"bg-gray-100 text-gray-400"}`,style:x?{background:O}:void 0,children:g?e.jsx(H,{size:12,strokeWidth:3}):i.num}),e.jsx("span",{className:`text-[13px] font-medium transition-colors ${x||g?"text-[#0A0A0A]":"text-gray-400"}`,children:i.label})]}),n<qe.length-1&&e.jsx("div",{className:"flex-1 mx-3 h-px bg-gray-200 relative overflow-hidden",children:e.jsx("div",{className:"absolute inset-y-0 left-0 bg-[#0A0A0A] transition-all duration-500 ease-out",style:{width:m>i.num?"100%":"0%"}})})]},i.num)})})}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-8",style:{scrollbarWidth:"thin",minHeight:320},children:[m===1&&e.jsxs("div",{className:"step-fade space-y-6 pb-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-[14px] font-semibold text-[#0A0A0A]",children:"Título e precificação"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-1",children:"Edite o título e defina seu preço de venda."})]}),C===!1&&e.jsxs("div",{className:"flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[13px] font-medium text-[#0A0A0A]",children:"Conecte sua conta"}),e.jsx("p",{className:"text-[11.5px] text-gray-500 mt-0.5",children:"É necessário para publicar anúncios"})]}),e.jsx("button",{onClick:X,className:"rounded-lg bg-[#0A0A0A] px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1a1a1a] transition-colors",children:"Conectar"})]}),!K&&e.jsxs("div",{className:"rounded-xl border border-red-100 bg-red-50/40 px-4 py-3",children:[e.jsx("p",{className:"text-[13px] font-medium text-red-600",children:"Produto sem estoque disponível"}),e.jsx("p",{className:"text-[11.5px] text-red-500/80 mt-0.5",children:"Não é possível continuar com este produto."})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600",children:"Título do anúncio"}),e.jsxs("button",{onClick:Se,disabled:Y,className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50",children:[Y?e.jsx(Ie,{size:11,className:"animate-spin"}):e.jsx(xt,{size:11}),Y?"Traduzindo":Ae?"Retraduzir":"Traduzir p/ PT-BR"]})]}),e.jsx("input",{value:N,onChange:i=>{i.target.value.length<=L&&k(i.target.value)},maxLength:L,className:"w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400",placeholder:"Digite o título"}),e.jsxs("p",{className:"text-[10.5px] text-gray-400 text-right mt-1.5",children:[Ne,"/",L]})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-[12px] font-medium text-gray-600",children:"Precificação"}),e.jsx("div",{className:"rounded-xl border border-gray-200 divide-y divide-gray-100",children:e.jsx(se,{label:"Custo do produto",value:G(U)})}),e.jsxs("div",{className:"rounded-xl border border-gray-200 p-4",children:[e.jsxs("div",{className:"flex items-center justify-between mb-3",children:[e.jsx("span",{className:"text-[12px] font-medium text-gray-600",children:"Multiplicador"}),e.jsxs("span",{className:"text-[13px] font-semibold text-[#0A0A0A]",children:[q.toFixed(1),"x"]})]}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:"range",min:"1.5",max:"5.0",step:"0.1",value:q,onChange:i=>{const n=Number(i.target.value);he(n),B(n)},className:"w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 slider",style:{background:`linear-gradient(to right, ${O} 0%, ${O} ${(q-1.5)/(5-1.5)*100}%, #e5e7eb ${(q-1.5)/(5-1.5)*100}%, #e5e7eb 100%)`}}),e.jsx("style",{children:`
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
                      `})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600 mb-2 block",children:"Preço de venda"}),e.jsxs("div",{className:"relative",children:[e.jsx("span",{className:"absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-gray-400",children:"R$"}),e.jsx("input",{type:"number",step:"0.01",min:"0",value:b||"",readOnly:!0,className:"w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors"})]})]}),e.jsxs("div",{className:"flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3",children:[e.jsx("span",{className:"text-[12px] text-gray-500",children:"Lucro por venda"}),e.jsxs("span",{className:`text-[13.5px] font-semibold ${V>0?"text-[#0A0A0A]":"text-red-500"}`,children:[G(V)," ",e.jsxs("span",{className:"text-[11px] font-medium text-gray-400 ml-1",children:["· ",Ce,"%"]})]})]})]})]},"s2"),m===2&&e.jsxs("div",{className:"step-fade space-y-6 pb-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-[14px] font-semibold text-[#0A0A0A]",children:"Revisar anúncio"}),e.jsx("p",{className:"text-[12.5px] text-gray-500 mt-1",children:"Escolha onde publicar e finalize a descrição."})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5 mb-2.5",children:[e.jsx(ut,{size:12,className:"text-gray-500"}),e.jsx("p",{className:"text-[12px] font-medium text-gray-600",children:"Publicar em"})]}),e.jsxs("div",{className:"grid grid-cols-3 gap-2.5",children:[e.jsx(De,{name:"Mercado Livre",status:C?"Conectado":"Desconectado",disabled:!C,selected:T.ml&&!!C,onToggle:()=>{C&&ne(i=>({...i,ml:!i.ml}))}}),e.jsx(De,{name:"Shopee",status:"Em breve",disabled:!0,selected:!1,onToggle:()=>{}}),e.jsx(De,{name:"TikTok Shop",status:"Em breve",disabled:!0,selected:!1,onToggle:()=>{}})]}),!C&&e.jsx("button",{onClick:X,className:"mt-2.5 text-[11.5px] font-medium text-[#0A0A0A] underline hover:no-underline",children:"Conectar Mercado Livre"})]}),e.jsxs("div",{className:"rounded-xl border border-gray-200 divide-y divide-gray-100",children:[e.jsx(se,{label:"Título",value:N}),e.jsx(se,{label:"Plataforma",value:"Mercado Livre"}),e.jsx(se,{label:"Preço",value:G(b)}),e.jsx(se,{label:"Estoque publicado",value:`${Math.min($,10)} un`}),e.jsx(se,{label:"Lucro",value:G(V),strong:!0})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("label",{className:"text-[12px] font-medium text-gray-600",children:"Descrição do anúncio"}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("button",{onClick:ze,disabled:J,className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50",children:[J?e.jsx(Ie,{size:11,className:"animate-spin"}):e.jsx(mt,{size:11}),J?"Gerando":"Gerar com IA"]}),e.jsxs("button",{onClick:()=>{if(!R.trim()){y.error("Crie uma descrição antes de fazer o vídeo");return}const i=le||"",n=d=>{if(!d)return"";if(d.match(/\.(png|jpg|jpeg)(\?|$)/i))return d;if(d.includes(".webp"))return d.replace(".webp",".jpg");const f=d.includes("?")?"&":"?";return`${d}${f}format=jpg`},x=n(i),g=(()=>{try{const d=typeof t.images=="string"?JSON.parse(t.images):t.images;return Array.isArray(d)?d.map(f=>n(f)).filter(Boolean):[x].filter(Boolean)}catch{return[x].filter(Boolean)}})();o(),h("/dashboard/criar-video",{state:{product_title:t.title,product_image:x,product_images:g,product_description:R,cost_price:t.cost_price,sale_price:t.suggested_price,profit:Math.round((t.suggested_price-t.cost_price)*100)/100}})},disabled:!R.trim(),className:"flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-30",children:[e.jsx(gt,{size:11}),"Criar vídeo"]})]})]}),e.jsx("textarea",{value:R,onChange:i=>W(i.target.value),placeholder:"Clique em 'Gerar com IA' ou escreva manualmente…",rows:5,className:"w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 resize-none"})]})]},"s3"),m===3&&F&&e.jsxs("div",{className:"step-fade flex flex-col items-center justify-center py-14 text-center",children:[e.jsx("div",{className:"flex h-14 w-14 items-center justify-center rounded-full mb-5",style:{background:O},children:e.jsx(H,{size:26,strokeWidth:3,className:"text-white"})}),e.jsx("h3",{className:"text-[16px] font-semibold text-[#0A0A0A]",children:"Anúncio publicado"}),e.jsxs("p",{className:"text-[12.5px] text-gray-500 mt-1.5 max-w-[320px]",children:["Seu produto já está no Mercado Livre. ID: ",e.jsx("span",{className:"font-medium text-[#0A0A0A]",children:F.item_id})]}),e.jsxs("a",{href:F.permalink,target:"_blank",rel:"noopener noreferrer",className:"btn-primary btn-primary--md mt-6",children:[e.jsx(ft,{size:13}),"Abrir no Mercado Livre"]})]},"s4")]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-gray-100 px-8 py-4 bg-white",children:[e.jsxs("p",{className:"text-[11.5px] text-gray-400",children:["Saiba mais sobre ",e.jsx("span",{className:"text-[#0A0A0A] underline cursor-pointer",children:"Importar Produto"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[m<4&&e.jsx("button",{onClick:M,className:"rounded-[100px] px-4 py-2 text-[12.5px] font-[400] text-[#737373] transition-all duration-[120ms] hover:text-[#0A0A0A]",children:"Cancelar"}),m>1&&m<4&&e.jsx("button",{onClick:()=>c(m-1),className:"rounded-[100px] border-[1.5px] border-[#E5E5E5] px-4 py-2 text-[12.5px] font-[400] text-[#0A0A0A] transition-all duration-[120ms] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]",children:"Voltar"}),m<2&&e.jsxs("button",{onClick:()=>{ce?c(m+1):y.error("Conecte a conta, confira o estoque, título e preço")},disabled:!ce,className:"btn-primary btn-primary--md",children:["Próximo",e.jsx(ht,{size:13})]}),m===2&&e.jsxs("button",{onClick:Me,disabled:S,className:"btn-primary btn-primary--md",children:[S&&e.jsx(Ie,{size:13,className:"animate-spin"}),S?"Publicando":"Publicar"]}),m===3&&e.jsx("button",{onClick:M,className:"btn-primary btn-primary--md",children:"Concluir"})]})]})]}),e.jsxs("div",{className:"w-[300px] shrink-0 border-l border-gray-100 bg-gray-50/40 flex flex-col",children:[e.jsx("div",{className:"flex items-center justify-between px-6 pt-7 pb-4",children:e.jsx("h3",{className:"text-[13px] font-semibold text-[#0A0A0A]",children:"Detalhes do produto"})}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-6 pb-6 space-y-5",style:{scrollbarWidth:"thin"},children:[e.jsxs("div",{className:"flex gap-3",children:[e.jsx("div",{className:"h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100",children:le?e.jsx("img",{src:le,alt:N,className:"h-full w-full object-cover"}):null}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-[12.5px] font-semibold text-[#0A0A0A] leading-snug line-clamp-2",children:N||t.title}),e.jsxs("p",{className:"text-[10.5px] text-gray-400 mt-1 truncate",children:["SKU: ",t.external_id||t.id.substring(0,10)]})]})]}),t.category&&e.jsx("div",{className:"flex gap-1.5 flex-wrap",children:e.jsx("span",{className:"rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[10.5px] font-medium text-gray-600 capitalize",children:t.category})}),e.jsx("div",{className:"h-px bg-gray-200"}),e.jsxs("div",{className:"space-y-3",children:[e.jsx(ue,{label:"Plataforma",value:e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"h-2 w-2 rounded-full bg-yellow-400"}),"Mercado Livre"]})}),e.jsx(ue,{label:"Preço",value:e.jsx("span",{className:"font-semibold text-[#0A0A0A]",children:G(b||U*2.5)})}),e.jsx(ue,{label:"Estoque",value:`${$} un`}),e.jsx(ue,{label:"Custo",value:G(U)}),m>=2&&e.jsx(ue,{label:"Lucro",value:e.jsx("span",{className:V>0?"text-[#0A0A0A] font-medium":"text-red-500",children:G(V)})})]}),e.jsx("div",{className:"h-px bg-gray-200"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10.5px] font-medium text-gray-400 uppercase tracking-wide mb-2",children:"Descrição"}),e.jsx("p",{className:"text-[12px] text-gray-600 leading-relaxed line-clamp-6",children:ye?"Traduzindo descrição para PT-BR...":R||"A descrição aparecerá aqui quando for gerada ou escrita."})]})]})]}),S&&e.jsx("div",{className:"absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[3px] animate-in fade-in duration-200",children:e.jsxs("div",{className:"flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] px-10 py-8",children:[e.jsxs("div",{className:"relative h-12 w-12",children:[e.jsx("div",{className:"absolute inset-0 rounded-full border-2 border-gray-100"}),e.jsx("div",{className:"absolute inset-0 rounded-full border-2 border-transparent animate-spin",style:{borderTopColor:O}})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-[13.5px] font-semibold text-[#0A0A0A]",children:"Aguarde um momento"}),e.jsx("p",{className:"text-[11.5px] text-gray-500 mt-0.5",children:"Publicando seu anúncio…"})]})]})})]}),e.jsx(Ge,{open:re,onClose:()=>fe(!1),title:u,message:pe,cta:Z,targetPlan:ee,benefits:te}),e.jsx("style",{children:`
        .step-fade {
          animation: stepIn 150ms ease both;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `})]}),document.body)},se=({label:a,value:o,strong:t})=>e.jsxs("div",{className:"flex items-center justify-between px-4 py-2.5",children:[e.jsx("span",{className:"text-[12px] text-gray-500",children:a}),e.jsx("span",{className:`text-[12.5px] text-right truncate max-w-[60%] ${t?"font-semibold text-[#0A0A0A]":"text-[#0A0A0A]"}`,children:o})]}),ue=({label:a,value:o})=>e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[11.5px] text-gray-500",children:a}),e.jsx("span",{className:"text-[12px] text-[#0A0A0A]",children:o})]}),De=({name:a,status:o,selected:t,disabled:l,onToggle:h})=>e.jsxs("button",{onClick:h,disabled:l,className:`relative rounded-xl border p-3 text-center transition-all ${t?"border-[#0A0A0A] bg-[#0A0A0A]/[0.02]":l?"border-gray-200 opacity-50 cursor-not-allowed":"border-gray-200 hover:border-gray-400"}`,children:[t&&e.jsx("span",{className:"absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A]",children:e.jsx(H,{size:9,strokeWidth:3,className:"text-white"})}),e.jsx("p",{className:`text-[12.5px] font-semibold ${t?"text-[#0A0A0A]":l?"text-gray-500":"text-[#0A0A0A]"}`,children:a}),e.jsx("p",{className:"text-[10.5px] text-gray-400 mt-0.5",children:o})]}),Re=[{id:"mercadolivre",name:"Mercado Livre",subtitle:"Integração disponível",section:"available"},{id:"shopee",name:"Shopee",subtitle:"Disponível em breve",section:"coming_soon"},{id:"amazon",name:"Amazon",subtitle:"Disponível em breve",section:"coming_soon"},{id:"shopify",name:"Shopify",subtitle:"Disponível em breve",section:"coming_soon"}],Ot=({on:a,onChange:o,disabled:t=!1})=>e.jsx("button",{onClick:o,disabled:t,title:t?"Disponível em breve":void 0,className:`relative h-6 w-11 rounded-full transition-colors ${t?"cursor-not-allowed bg-gray-200 opacity-60 dark:bg-zinc-800":a?"bg-green-500":"bg-gray-200 dark:bg-zinc-700"}`,children:e.jsx("span",{className:`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${a?"left-5":"left-0.5"}`})}),Be=({name:a})=>e.jsx("div",{className:"flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 dark:border-white/10 dark:bg-white",children:e.jsx(Dt,{platform:a,size:40})}),Ft=({open:a,onClose:o})=>{const{user:t}=Ve(),l=Te(),[h,A]=r.useState(!1),[v,m]=r.useState(!1),[c,N]=r.useState(!1);r.useEffect(()=>{!a||!t||(m(!0),I.from("user_integrations").select("access_token").eq("user_id",t.id).eq("platform","mercadolivre").maybeSingle().then(({data:p})=>A(!!(p!=null&&p.access_token))).finally(()=>m(!1)))},[a,t]);const k=async()=>{if(!t)return;if(!l.loading&&!h&&!l.canConnectMarketplace){N(!0);return}const{data:p,error:S}=await I.functions.invoke("ml-connect"),D=(p==null?void 0:p.authUrl)??(p==null?void 0:p.auth_url);if(S||!D){y.error("Não foi possível iniciar a conexão com o Mercado Livre");return}window.location.href=D},b=async()=>{if(!t)return;const{error:p}=await I.from("user_integrations").delete().eq("user_id",t.id).eq("platform","mercadolivre");if(p){y.error("Não foi possível desconectar o Mercado Livre");return}A(!1),l.refreshUsage(),y.success("Mercado Livre desconectado")};if(!a)return null;const _=Re.filter(p=>p.section==="available"),P=Re.filter(p=>p.section==="coming_soon"),w=l.plan==="pro"?"business":"pro",C=w==="business"?["Marketplaces ilimitados","Produtos ilimitados","Analytics premium","Processamento prioritário"]:["Até 2 marketplaces","Publicação automática","Monitoramento básico 24h","Suporte prioritário"];return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40",onClick:o}),e.jsxs("div",{className:"relative w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-start justify-between p-6 pb-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",children:e.jsx(bt,{size:20})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-base font-bold text-foreground",children:"Integração de Plataformas"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Conecte suas plataformas de venda."})]})]}),e.jsx("button",{onClick:o,className:"text-muted-foreground hover:text-foreground transition-colors",children:e.jsx(Ee,{size:18})})]}),e.jsxs("div",{className:"px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto",style:{scrollbarWidth:"none"},children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Disponível"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:_.map(p=>e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded-xl border border-border p-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(Be,{name:p.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:p.name}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:p.subtitle})]})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:`rounded-full px-2.5 py-1 text-[11px] font-semibold ${h?"bg-green-100 text-green-700":"bg-muted text-muted-foreground"}`,children:v?"Verificando...":h?"Conectado":"Desconectado"}),e.jsx("button",{onClick:h?b:k,disabled:v,className:"rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black",children:h?"Desconectar":"Conectar"})]})]},p.id))})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold text-foreground mb-3",children:"Em breve"}),e.jsx("div",{className:"grid grid-cols-1 gap-3",children:P.map(p=>e.jsxs("div",{title:"Disponível em breve",className:"flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-3",children:[e.jsx(Be,{name:p.name}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold text-foreground",children:p.name}),e.jsx("p",{className:"truncate text-[10px] text-muted-foreground",children:p.subtitle})]})]}),e.jsxs("div",{className:"flex shrink-0 items-center gap-2",children:[e.jsx("span",{className:"rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground",children:"Em breve"}),e.jsx(Ot,{on:!1,onChange:()=>{},disabled:!0})]})]},p.id))})]})]}),e.jsxs("div",{className:"flex items-center justify-between border-t border-border px-6 py-4",children:[e.jsxs("p",{className:"text-xs text-muted-foreground",children:["Saiba mais sobre"," ",e.jsx("a",{href:"#",className:"text-foreground underline underline-offset-2 hover:text-muted-foreground",children:"Plataformas"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:o,className:"text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors",children:"Cancelar"}),e.jsx("button",{onClick:o,className:"btn-primary btn-primary--md",children:"Concluir"})]})]})]}),e.jsx(Ge,{open:c,onClose:()=>N(!1),title:"Limite de marketplaces atingido",message:"Seu plano atual não permite conectar outro marketplace. Faça upgrade para liberar mais integrações.",cta:w==="business"?"Upgrade Business":"Desbloquear operação completa",targetPlan:w,benefits:C})]})},Wt=Lt,Ut=Tt,Ke=r.forwardRef(({className:a,...o},t)=>e.jsx(Ye,{ref:t,className:ge("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",a),...o}));Ke.displayName=Ye.displayName;const Xe=r.forwardRef(({className:a,children:o,...t},l)=>e.jsxs(Ut,{children:[e.jsx(Ke,{}),e.jsxs(He,{ref:l,className:ge("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",a),...t,children:[o,e.jsxs(Et,{className:"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",children:[e.jsx(Ee,{className:"h-4 w-4"}),e.jsx("span",{className:"sr-only",children:"Close"})]})]})]}));Xe.displayName=He.displayName;const Ze=({className:a,...o})=>e.jsx("div",{className:ge("flex flex-col space-y-1.5 text-center sm:text-left",a),...o});Ze.displayName="DialogHeader";const et=r.forwardRef(({className:a,...o},t)=>e.jsx(Je,{ref:t,className:ge("text-lg font-semibold leading-none tracking-tight",a),...o}));et.displayName=Je.displayName;const Vt=r.forwardRef(({className:a,...o},t)=>e.jsx(Qe,{ref:t,className:ge("text-sm text-muted-foreground",a),...o}));Vt.displayName=Qe.displayName;const Gt={price:.4,shipping:.3,stock:.2,rating:.1};function Ht(a,o,t=Gt){if(a.stock_status!=="available")return 0;const l=o.map(w=>w.cost_price+w.shipping_cost),h=Math.min(...l),A=Math.max(...l),v=a.cost_price+a.shipping_cost,m=A===h?100:(A-v)/(A-h)*100,c=o.map(w=>w.shipping_days),N=Math.min(...c),k=Math.max(...c),b=k===N?100:(k-a.shipping_days)/(k-N)*100,_=a.stock_status==="available"?100:0,P=(a.rating||0)*20;return Math.round(t.price*m+t.shipping*b+t.stock*_+t.rating*P)}function Jt(a){const o=a.filter(l=>l.stock_status==="available");if(o.length===0)return{best:null,ranked:[]};const t=o.map(l=>({...l,_score:Ht(l,o)}));return t.sort((l,h)=>(h._score??0)-(l._score??0)),{best:t[0],ranked:t}}function Yt(a){return Ue({queryKey:["supplier_products",a],enabled:!!a,queryFn:async()=>{const{data:o,error:t}=await I.from("supplier_products").select("*, supplier:suppliers(*)").eq("product_id",a);if(t)throw t;return(o||[]).map(l=>({...l,supplier:l.supplier}))}})}const Le=a=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a);function Qt({open:a,onClose:o,productId:t,productTitle:l}){const{data:h,isLoading:A}=Yt(t),{best:v,ranked:m}=Jt(h||[]);return e.jsx(Wt,{open:a,onOpenChange:c=>!c&&o(),children:e.jsxs(Xe,{className:"max-w-lg",children:[e.jsxs(Ze,{children:[e.jsx(et,{className:"text-base font-semibold",children:"Fornecedores disponíveis"}),e.jsx("p",{className:"text-xs text-muted-foreground line-clamp-1 mt-0.5",children:l})]}),A?e.jsx("div",{className:"space-y-3 py-4",children:[1,2].map(c=>e.jsx(me,{className:"h-20 w-full rounded-xl"},c))}):m.length===0?e.jsxs("div",{className:"flex flex-col items-center py-10 text-center",children:[e.jsx(yt,{size:32,className:"text-muted-foreground/40 mb-3"}),e.jsx("p",{className:"text-sm font-medium text-foreground",children:"Nenhum fornecedor disponível"}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:"Este produto ainda não possui fornecedores vinculados ou todos estão sem estoque."})]}):e.jsx("div",{className:"space-y-2.5 py-2",children:m.map((c,N)=>{var _;const k=(v==null?void 0:v.id)===c.id,b=c.cost_price+c.shipping_cost;return e.jsxs("div",{className:`relative rounded-xl border p-3.5 transition-colors ${k?"border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20":"border-border bg-background"}`,children:[k&&e.jsxs("span",{className:"absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white",children:[e.jsx(jt,{size:10})," Melhor opção"]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:((_=c.supplier)==null?void 0:_.name)||"Fornecedor"}),e.jsxs("p",{className:"text-[11px] text-muted-foreground mt-0.5",children:["Score: ",c._score??0,"/100"]})]}),e.jsxs("div",{className:"text-right",children:[e.jsx("p",{className:"text-sm font-semibold text-foreground",children:Le(b)}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:"custo total"})]})]}),e.jsxs("div",{className:"mt-2.5 grid grid-cols-4 gap-2",children:[e.jsx(ke,{icon:vt,label:"Custo",value:Le(c.cost_price)}),e.jsx(ke,{icon:Nt,label:"Frete",value:Le(c.shipping_cost)}),e.jsx(ke,{icon:we,label:"Prazo",value:`${c.shipping_days}d`}),e.jsx(ke,{icon:kt,label:"Nota",value:c.rating?`${c.rating}/5`:"—"})]})]},c.id)})})]})})}function ke({icon:a,label:o,value:t}){return e.jsxs("div",{className:"flex flex-col items-center rounded-lg bg-muted/50 p-1.5",children:[e.jsx(a,{size:12,className:"text-muted-foreground mb-0.5"}),e.jsx("p",{className:"text-[10px] text-muted-foreground",children:o}),e.jsx("p",{className:"text-[11px] font-semibold text-foreground",children:t})]})}function Kt(a,o){const t=new AbortController,l=window.setTimeout(()=>t.abort(),a);return o==null||o.addEventListener("abort",()=>t.abort(),{once:!0}),{signal:t.signal,clear:()=>window.clearTimeout(l)}}const Oe=[{key:"todos",label:"Todos"},{key:"beleza",label:"Beleza"},{key:"casa",label:"Casa"},{key:"eletronicos",label:"Eletrônicos"},{key:"moda",label:"Moda"},{key:"esporte",label:"Esporte"},{key:"pet",label:"Pet"},{key:"bebes",label:"Bebês"},{key:"organizacao",label:"Organização"}],Fe=[{key:"todos",label:"Todas as datas"},{key:"today",label:"Hoje"},{key:"7d",label:"Últimos 7 dias"},{key:"30d",label:"Últimos 30 dias"},{key:"90d",label:"Últimos 90 dias"}],We=[{key:"todos",label:"Status de pagamento"},{key:"priced",label:"Com preço"},{key:"missing_price",label:"Sem preço"},{key:"positive_margin",label:"Margem positiva"},{key:"out_of_stock",label:"Sem estoque"}],Xt=({p:a,index:o,onImport:t,onCompare:l,formatPrice:h,getImage:A})=>{const v=A(a.images),[m,c]=r.useState(o===2),[N,k]=r.useState(!1),b=!a.stock_quantity||a.stock_quantity<=0,_=Math.max(0,Number(a.suggested_price??0)-Number(a.cost_price??0)),P=Number(a.margin_percent??0)||(Number(a.cost_price)>0?_/Number(a.cost_price)*100:0),w=a.category?a.category.replace(/_/g," ").replace(/\b\w/g,S=>S.toUpperCase()):"Catálogo",C=Number(a.suggested_price??0)>0?Number(a.suggested_price):Number(a.cost_price??0),p=b?"Sem estoque":P>=35?"Especial":P>=20?"Alta margem":null;return r.useEffect(()=>{k(!1)},[v]),e.jsxs("article",{className:"catalog-product-card group",children:[e.jsxs("div",{className:"catalog-product-media",children:[p&&e.jsx("span",{className:`catalog-product-badge ${b?"is-danger":""}`,children:p}),e.jsx("button",{type:"button",className:`catalog-heart-button ${m?"is-active":""}`,onClick:()=>c(S=>!S),"aria-label":m?"Remover dos favoritos":"Adicionar aos favoritos",children:e.jsx(Mt,{size:22,strokeWidth:1.9,fill:m?"currentColor":"none"})}),v&&!N?e.jsx("img",{src:v,alt:a.title,className:"catalog-product-image",loading:"lazy",decoding:"async",onError:()=>k(!0)}):e.jsx("div",{className:"catalog-image-fallback",children:e.jsx(we,{size:44,strokeWidth:1.35})})]}),e.jsxs("div",{className:"catalog-product-body",children:[e.jsx("h3",{className:"catalog-product-title",children:a.title}),e.jsx("p",{className:"catalog-product-category",children:w}),e.jsxs("div",{className:"catalog-product-footer",children:[e.jsxs("div",{className:"catalog-price-block",children:[e.jsx("strong",{children:h(C)}),Number(a.cost_price??0)>0&&Number(a.cost_price)<C&&e.jsx("span",{children:h(Number(a.cost_price))})]}),e.jsxs("div",{className:"catalog-profit-chip",children:["Lucro ",h(_)]})]}),e.jsxs("div",{className:`catalog-product-actions ${o===2?"is-visible":""}`,children:[e.jsx("button",{onClick:t,disabled:b,className:"catalog-buy-button",children:b?"Indisponível":`Importar ${h(C)}`}),e.jsx("button",{onClick:l,className:"catalog-cart-button",title:"Ver fornecedores",children:e.jsx(It,{size:18,strokeWidth:1.9})})]})]})]})},ua=()=>{var Ne,ce,de;const[a,o]=r.useState("todos"),[t,l]=r.useState(1),[h,A]=r.useState(""),[v,m]=r.useState("todos"),[c,N]=r.useState("todos"),[k,b]=r.useState(!1),[_,P]=r.useState("popular"),[w,C]=r.useState(""),[p,S]=r.useState(""),[D,F]=r.useState(!1),[oe,re]=r.useState(!1),[fe,q]=r.useState(!1),[he,R]=r.useState(null),[W,J]=r.useState(!1),[be,Y]=r.useState(!1),[ie,ye]=r.useState(null),[je,Ae]=r.useState(""),Q=r.useRef(null),T=r.useRef(null),ne=r.useRef(null),ve=ot(),_e=Te(),U=12,E="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";r.useEffect(()=>{const s=u=>{Q.current&&!Q.current.contains(u.target)&&F(!1),T.current&&!T.current.contains(u.target)&&re(!1),ne.current&&!ne.current.contains(u.target)&&q(!1)};return document.addEventListener("mousedown",s),()=>document.removeEventListener("mousedown",s)},[]);const{data:B,isLoading:V,isError:Ce,refetch:le}=Ue({queryKey:["catalog",a,t,h],staleTime:60*1e3,retry:1,queryFn:async({signal:s})=>{const u=new URLSearchParams({page:String(t),limit:String(U)});a!=="todos"&&u.set("category",a),h&&u.set("search",h);const Z=`${nt}/functions/v1/catalog?${u}`,ee=Kt(8e3,s);try{const te=await fetch(Z,{headers:{Authorization:`Bearer ${E}`},signal:ee.signal});if(!te.ok)throw new Error("Failed to fetch catalog");return te.json()}finally{ee.clear()}}}),$=rt({mutationFn:async()=>{const{data:s,error:u}=await I.functions.invoke("cj-sync-request");if(u)throw new Error(u.message);if(s!=null&&s.error)throw new Error(s.error);return s},onSuccess:s=>{const u=s.synced??0;y.success(u>0?`${u} produtos sincronizados com sucesso!`:"Sincronização concluída (nenhum produto novo encontrado)."),ve.invalidateQueries({queryKey:["catalog"]}),ve.refetchQueries({queryKey:["catalog"]})},onError:s=>y.error(`Erro ao sincronizar: ${s.message}`)}),K=(B==null?void 0:B.products)||[],M=(B==null?void 0:B.totalPages)||1,X=r.useMemo(()=>{const s=h.trim().toLowerCase(),u=new Date,pe=w.trim()===""?Number.NEGATIVE_INFINITY:Number(w.replace(",",".")),Z=p.trim()===""?Number.POSITIVE_INFINITY:Number(p.replace(",",".")),ee=Number.isFinite(pe)?pe:Number.NEGATIVE_INFINITY,te=Number.isFinite(Z)?Z:Number.POSITIVE_INFINITY;return[...K.filter(n=>{const x=[n.title,n.category,n.source,n.supplier_name,n.external_id].filter(Boolean).join(" ").toLowerCase();if(s&&!x.includes(s))return!1;const g=Number(n.suggested_price??n.cost_price??0);if(g<ee||g>te)return!1;if(v!=="todos"){const d=n.created_at||n.updated_at;if(!d)return!1;const f=new Date(d);if(Number.isNaN(f.getTime()))return!1;if(v==="today"){if(f.toDateString()!==u.toDateString())return!1}else{const j=Number(v.replace("d","")),z=new Date(u);if(z.setDate(u.getDate()-j),f<z)return!1}}if(c!=="todos"){const d=Number(n.cost_price)>0&&Number(n.suggested_price)>0,f=Number(n.margin_percent)>0||Number(n.suggested_price)>Number(n.cost_price),j=!n.stock_quantity||n.stock_quantity<=0;if(c==="priced"&&!d||c==="missing_price"&&d||c==="positive_margin"&&!f||c==="out_of_stock"&&!j)return!1}return!(k&&(!n.stock_quantity||n.stock_quantity<=0||n.is_active===!1))})].sort((n,x)=>{const g=Number(n.suggested_price??n.cost_price??0),d=Number(x.suggested_price??x.cost_price??0),f=Math.max(0,Number(n.suggested_price??0)-Number(n.cost_price??0)),j=Math.max(0,Number(x.suggested_price??0)-Number(x.cost_price??0));if(_==="price_asc")return g-d;if(_==="price_desc")return d-g;if(_==="profit_desc")return j-f;if(_==="newest")return new Date(x.created_at||x.updated_at||0).getTime()-new Date(n.created_at||n.updated_at||0).getTime();const z=Number(n.stock_quantity??0)>0?1:0,xe=Number(x.stock_quantity??0)>0?1:0,tt=Number(n.margin_percent??0)||(Number(n.cost_price)>0?f/Number(n.cost_price)*100:0),at=Number(x.margin_percent??0)||(Number(x.cost_price)>0?j/Number(x.cost_price)*100:0);return xe-z||at-tt||j-f})},[K,h,v,c,k,w,p,_]),Se=s=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(s),ze=s=>{try{const u=typeof s=="string"?JSON.parse(s):s;return Array.isArray(u)&&u.length>0?u[0]:null}catch{return null}};(Ne=Oe.find(s=>s.key===a))==null||Ne.label;const Pe=((ce=Fe.find(s=>s.key===v))==null?void 0:ce.label)??"Todas as datas",Me=((de=We.find(s=>s.key===c))==null?void 0:de.label)??"Status de pagamento";return e.jsxs("div",{className:"catalog-page-shell",children:[e.jsxs("div",{className:"catalog-board",children:[e.jsxs("header",{className:"catalog-board-header",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"catalog-breadcrumb",children:[e.jsx("span",{children:"Main"}),e.jsx("span",{children:"/"}),e.jsx("strong",{children:"Catálogo"})]}),e.jsxs("div",{className:"catalog-title-row",children:[e.jsx("h1",{children:"Catálogo"}),e.jsxs("button",{type:"button",className:"catalog-filter-count",onClick:()=>q(s=>!s),"aria-label":"Filtros ativos",children:[e.jsx(wt,{size:19,strokeWidth:1.8}),e.jsx("span",{children:[a!=="todos",v!=="todos",c!=="todos",k,!!(w||p)].filter(Boolean).length||0})]})]})]}),e.jsxs("div",{className:"catalog-header-actions",children:[e.jsx("button",{type:"button",className:"catalog-view-button","aria-label":"Lista",children:e.jsx(At,{size:20,strokeWidth:1.8})}),e.jsx("button",{type:"button",className:"catalog-view-button is-active","aria-label":"Grade",children:e.jsx(_t,{size:20,strokeWidth:1.8})}),e.jsxs("label",{className:"catalog-sort-select",children:[e.jsxs("select",{value:_,onChange:s=>{P(s.target.value),l(1)},children:[e.jsx("option",{value:"popular",children:"Popular First"}),e.jsx("option",{value:"price_asc",children:"Menor preço"}),e.jsx("option",{value:"price_desc",children:"Maior preço"}),e.jsx("option",{value:"newest",children:"Mais recentes"})]}),e.jsx(ae,{size:17,strokeWidth:1.8})]}),e.jsxs("button",{type:"button",onClick:()=>$.mutate(),disabled:$.isPending,className:"catalog-utility-button",children:[e.jsx(Ct,{size:16,strokeWidth:1.8,className:$.isPending?"animate-spin":""}),$.isPending?"Sincronizando":"Sincronizar"]}),e.jsxs("button",{type:"button",onClick:()=>Y(!0),className:"catalog-utility-button",children:[e.jsx(St,{size:16,strokeWidth:1.8}),"Integrações"]})]})]}),e.jsxs("div",{className:"catalog-content-layout",children:[e.jsxs("aside",{className:"catalog-filter-panel",children:[e.jsxs("div",{className:"catalog-filter-search",children:[e.jsx(zt,{size:18,strokeWidth:1.8}),e.jsx("input",{value:h,onChange:s=>{A(s.target.value),l(1)},placeholder:"Buscar produto"})]}),e.jsxs("section",{className:"catalog-filter-section",ref:ne,children:[e.jsxs("button",{type:"button",className:"catalog-section-title",onClick:()=>q(s=>!s),children:[e.jsx("span",{children:"Category"}),e.jsx(ae,{size:16,strokeWidth:1.9,className:fe?"is-open":""})]}),e.jsx("div",{className:"catalog-checkbox-list",children:Oe.map(s=>{const u=a===s.key;return e.jsxs("button",{type:"button",className:"catalog-checkbox-row",onClick:()=>{o(s.key),l(1)},children:[e.jsx("span",{className:`catalog-checkbox-box ${u?"is-active":""}`,children:u&&e.jsx(H,{size:13,strokeWidth:2.8})}),e.jsx("span",{children:s.key==="todos"?"All":s.label})]},s.key)})})]}),e.jsxs("section",{className:"catalog-filter-section",children:[e.jsxs("div",{className:"catalog-section-title",children:[e.jsx("span",{children:"Price Range"}),e.jsx(ae,{size:16,strokeWidth:1.9})]}),e.jsxs("div",{className:"catalog-price-inputs",children:[e.jsx("input",{value:w,onChange:s=>{C(s.target.value),l(1)},placeholder:"R$ 5",inputMode:"decimal"}),e.jsx("span",{children:"-"}),e.jsx("input",{value:p,onChange:s=>{S(s.target.value),l(1)},placeholder:"R$ 1 000",inputMode:"decimal"})]}),e.jsxs("div",{className:"catalog-range-line",children:[e.jsx("span",{}),e.jsx("span",{})]})]}),e.jsxs("section",{className:"catalog-filter-section",ref:Q,children:[e.jsxs("button",{type:"button",className:"catalog-section-title",onClick:()=>F(s=>!s),children:[e.jsx("span",{children:"Data"}),e.jsx("small",{children:Pe}),e.jsx(ae,{size:16,strokeWidth:1.9,className:D?"is-open":""})]}),D&&e.jsx("div",{className:"catalog-option-stack",children:Fe.map(s=>e.jsxs("button",{type:"button",className:v===s.key?"is-active":"",onClick:()=>{m(s.key),l(1),F(!1)},children:[s.label,v===s.key&&e.jsx(H,{size:13,strokeWidth:2.6})]},s.key))})]}),e.jsxs("section",{className:"catalog-filter-section",ref:T,children:[e.jsxs("button",{type:"button",className:"catalog-section-title",onClick:()=>re(s=>!s),children:[e.jsx("span",{children:"Status"}),e.jsx("small",{children:Me}),e.jsx(ae,{size:16,strokeWidth:1.9,className:oe?"is-open":""})]}),oe&&e.jsx("div",{className:"catalog-option-stack",children:We.map(s=>e.jsxs("button",{type:"button",className:c===s.key?"is-active":"",onClick:()=>{N(s.key),l(1),re(!1)},children:[s.label,c===s.key&&e.jsx(H,{size:13,strokeWidth:2.6})]},s.key))})]}),e.jsx("section",{className:"catalog-filter-section",children:e.jsxs("div",{className:"catalog-section-title",children:[e.jsx("span",{children:"Brand"}),e.jsx($e,{size:16,strokeWidth:1.9})]})}),e.jsxs("section",{className:"catalog-filter-section",children:[e.jsxs("div",{className:"catalog-section-title",children:[e.jsx("span",{children:"Color"}),e.jsx(ae,{size:16,strokeWidth:1.9})]}),e.jsx("div",{className:"catalog-checkbox-list",children:["All","White","Blue","Black","Silver"].map(s=>{const u=s==="Blue";return e.jsxs("button",{type:"button",className:"catalog-checkbox-row",children:[e.jsx("span",{className:`catalog-checkbox-box ${u?"is-active":""}`,children:u&&e.jsx(H,{size:13,strokeWidth:2.8})}),e.jsx("span",{children:s})]},s)})})]}),e.jsxs("div",{className:"catalog-stock-row",children:[e.jsx("button",{type:"button",className:`catalog-stock-toggle ${k?"is-active":""}`,onClick:()=>{b(s=>!s),l(1)},"aria-pressed":k,children:e.jsx("span",{})}),e.jsx("span",{children:"Only in Stock"})]}),e.jsxs("div",{className:"catalog-filter-footer",children:[e.jsxs("button",{type:"button",className:"catalog-count-button",children:[X.length," items"]}),e.jsx("button",{type:"button",className:"catalog-clear-button",onClick:()=>{A(""),o("todos"),m("todos"),N("todos"),b(!1),C(""),S(""),l(1)},children:"Clear"})]})]}),e.jsx("main",{className:"catalog-results-area",children:V?e.jsx("div",{className:"catalog-products-grid",children:Array.from({length:6}).map((s,u)=>e.jsxs("div",{className:"catalog-skeleton-card",children:[e.jsx(me,{className:"h-[220px] w-full rounded-[18px]"}),e.jsx(me,{className:"h-5 w-4/5 rounded-md"}),e.jsx(me,{className:"h-4 w-2/5 rounded-md"}),e.jsx(me,{className:"h-5 w-1/3 rounded-md"})]},u))}):Ce?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(we,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Nao foi possivel carregar o catalogo"}),e.jsx("span",{children:"Verifique a conexao com o Supabase e tente novamente."}),e.jsx("button",{type:"button",onClick:()=>void le(),children:"Tentar novamente"})]}):X.length===0?e.jsxs("div",{className:"catalog-empty-state",children:[e.jsx(we,{size:46,strokeWidth:1.5}),e.jsx("strong",{children:"Nenhum produto encontrado"}),e.jsx("span",{children:'Clique em "Sincronizar" para popular o catálogo com produtos da CJ Dropshipping.'})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"catalog-products-grid",children:X.map((s,u)=>e.jsx(Xt,{p:s,index:u,onImport:()=>{R(s),J(!0)},onCompare:()=>{ye(s.id),Ae(s.title)},formatPrice:Se,getImage:ze},s.id))}),e.jsxs("div",{className:"catalog-show-more-row",children:[e.jsx("button",{type:"button",disabled:t>=M,onClick:()=>l(s=>Math.min(M,s+1)),children:t>=M?"Fim do catálogo":"Show More"}),M>1&&e.jsxs("div",{className:"catalog-page-stepper",children:[e.jsx("button",{type:"button",onClick:()=>l(s=>Math.max(1,s-1)),disabled:t<=1,"aria-label":"Página anterior",children:e.jsx(Pt,{size:15})}),e.jsxs("span",{children:[t," / ",M]}),e.jsx("button",{type:"button",onClick:()=>l(s=>Math.min(M,s+1)),disabled:t>=M,"aria-label":"Próxima página",children:e.jsx($e,{size:15})})]})]})]})})]})]}),e.jsx(Bt,{open:W,onClose:()=>{J(!1),_e.refreshUsage()},product:he}),e.jsx(Qt,{open:!!ie,onClose:()=>ye(null),productId:ie||"",productTitle:je}),e.jsx(Ft,{open:be,onClose:()=>Y(!1)}),e.jsx("style",{children:`
        .catalog-page-shell {
          min-height: 100vh;
          background: #eaf0ff;
          padding: 56px 28px 80px;
          color: #0f172a;
          font-family: "Inter", "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .catalog-board {
          width: min(100%, 1450px);
          margin: 0 auto;
          background: #ffffff;
          padding: 54px 64px 62px;
          border: 1px solid rgba(219, 228, 245, 0.72);
          box-shadow: 0 24px 70px rgba(90, 111, 155, 0.08);
        }

        .catalog-board-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 32px;
          margin-bottom: 36px;
        }

        .catalog-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #73819a;
          font-size: 14px;
          line-height: 1;
        }

        .catalog-breadcrumb strong {
          color: #111827;
          font-weight: 500;
        }

        .catalog-title-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .catalog-title-row h1 {
          margin: 0;
          color: #050505;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -0.035em;
          font-weight: 700;
        }

        .catalog-filter-count {
          position: relative;
          width: 34px;
          height: 34px;
          border: 0;
          background: transparent;
          color: #63748f;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-filter-count span {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #0b6fe8;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(11, 111, 232, 0.3);
        }

        .catalog-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 26px;
          flex-wrap: wrap;
        }

        .catalog-view-button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #6d7f98;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 0.18s ease;
        }

        .catalog-view-button.is-active,
        .catalog-view-button:hover {
          color: #0b6fe8;
          background: #f3f7ff;
        }

        .catalog-sort-select {
          height: 48px;
          min-width: 150px;
          border: 1px solid #d9e5f4;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px 0 16px;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 8px 24px rgba(90, 111, 155, 0.04);
        }

        .catalog-sort-select select {
          appearance: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          min-width: 0;
          cursor: pointer;
        }

        .catalog-utility-button {
          height: 44px;
          border: 1px solid #d9e5f4;
          border-radius: 8px;
          background: #ffffff;
          color: #3f4c61;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 600;
          transition: 0.18s ease;
        }

        .catalog-utility-button:hover:not(:disabled) {
          border-color: #0b6fe8;
          color: #0b6fe8;
        }

        .catalog-utility-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .catalog-content-layout {
          display: grid;
          grid-template-columns: 270px minmax(0, 1fr);
          gap: 38px;
          align-items: start;
        }

        .catalog-filter-panel {
          background: #ffffff;
          color: #050505;
        }

        .catalog-filter-search {
          position: relative;
          margin-bottom: 28px;
        }

        .catalog-filter-search svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #90a0b7;
        }

        .catalog-filter-search input {
          width: 100%;
          height: 46px;
          border: 1px solid #dce7f5;
          border-radius: 7px;
          background: #ffffff;
          color: #0f172a;
          outline: 0;
          padding: 0 14px 0 42px;
          font-size: 14px;
        }

        .catalog-filter-search input::placeholder {
          color: #8b9ab0;
        }

        .catalog-filter-section {
          padding: 0 0 26px;
          margin-bottom: 26px;
          border-bottom: 1px solid #dce7f5;
        }

        .catalog-filter-section:last-of-type {
          margin-bottom: 20px;
        }

        .catalog-section-title {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 0;
          margin: 0 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #050505;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.2;
          text-align: left;
        }

        .catalog-section-title small {
          margin-left: auto;
          max-width: 108px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #738197;
          font-size: 12px;
          font-weight: 500;
        }

        .catalog-section-title svg {
          color: #60708a;
          flex: 0 0 auto;
          transition: transform 0.16s ease;
        }

        .catalog-section-title svg.is-open {
          transform: rotate(180deg);
        }

        .catalog-checkbox-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .catalog-checkbox-row {
          min-height: 25px;
          width: 100%;
          border: 0;
          background: transparent;
          color: #050505;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0;
          font-size: 15px;
          line-height: 1.2;
          text-align: left;
          cursor: pointer;
        }

        .catalog-checkbox-box {
          width: 18px;
          height: 18px;
          border: 1px solid #cfe0f2;
          border-radius: 4px;
          background: #ffffff;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          transition: 0.16s ease;
        }

        .catalog-checkbox-box.is-active {
          background: #0b6fe8;
          border-color: #0b6fe8;
          box-shadow: 0 3px 8px rgba(11, 111, 232, 0.22);
        }

        .catalog-price-inputs {
          display: grid;
          grid-template-columns: 1fr 20px 1fr;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          color: #a1aec0;
        }

        .catalog-price-inputs input {
          height: 50px;
          width: 100%;
          border: 1px solid #d9e5f4;
          border-radius: 7px;
          background: #ffffff;
          color: #60708a;
          outline: 0;
          padding: 0 14px;
          font-size: 15px;
        }

        .catalog-price-inputs input::placeholder {
          color: #60708a;
        }

        .catalog-range-line {
          height: 2px;
          background: #cfe0f2;
          position: relative;
          margin: 14px 3px 0;
        }

        .catalog-range-line::before {
          content: "";
          position: absolute;
          left: 3%;
          right: 48%;
          top: 0;
          height: 2px;
          background: #0b6fe8;
        }

        .catalog-range-line span {
          position: absolute;
          top: 50%;
          width: 18px;
          height: 18px;
          border: 2px solid #0b6fe8;
          border-radius: 999px;
          background: #ffffff;
          transform: translate(-50%, -50%);
          box-shadow: 0 2px 6px rgba(11, 111, 232, 0.2);
        }

        .catalog-range-line span:first-child {
          left: 3%;
        }

        .catalog-range-line span:last-child {
          left: 50%;
        }

        .catalog-option-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: -6px;
        }

        .catalog-option-stack button {
          width: 100%;
          border: 0;
          border-radius: 8px;
          background: #f8faff;
          color: #3f4c61;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
        }

        .catalog-option-stack button.is-active {
          color: #0b6fe8;
          background: #edf5ff;
        }

        .catalog-stock-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          margin-top: 2px;
          color: #050505;
          font-size: 15px;
        }

        .catalog-stock-toggle {
          width: 38px;
          height: 20px;
          border: 0;
          border-radius: 999px;
          background: #d8e3f3;
          position: relative;
          transition: 0.16s ease;
        }

        .catalog-stock-toggle span {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);
          transition: 0.16s ease;
        }

        .catalog-stock-toggle.is-active {
          background: #0b6fe8;
        }

        .catalog-stock-toggle.is-active span {
          transform: translateX(18px);
        }

        .catalog-filter-footer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 112px;
          gap: 12px;
          margin-top: 20px;
        }

        .catalog-filter-footer button {
          height: 50px;
          border-radius: 7px;
          font-size: 15px;
          font-weight: 600;
        }

        .catalog-count-button {
          border: 0;
          background: #0b6fe8;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(11, 111, 232, 0.18);
        }

        .catalog-clear-button {
          border: 1px solid #d9e5f4;
          background: #ffffff;
          color: #111827;
        }

        .catalog-results-area {
          min-width: 0;
        }

        .catalog-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          align-items: stretch;
        }

        .catalog-skeleton-card {
          min-height: 394px;
          border: 1px solid rgba(232, 238, 249, 0.8);
          border-radius: 4px;
          background: #f8faff;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .catalog-empty-state {
          min-height: 320px;
          border: 1px dashed #cfe0f2;
          border-radius: 8px;
          background: #fbfdff;
          color: #66758c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          padding: 28px;
        }

        .catalog-empty-state strong {
          color: #111827;
          font-size: 20px;
        }

        .catalog-empty-state button {
          height: 42px;
          border: 1px solid #0b6fe8;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          padding: 0 16px;
          font-weight: 600;
        }

        .catalog-product-card {
          min-height: 394px;
          background: #f8faff;
          border: 1px solid rgba(232, 238, 249, 0.8);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          content-visibility: auto;
          contain-intrinsic-size: 430px;
        }

        .catalog-product-card:hover {
          transform: translateY(-2px);
          border-color: #dbe8f8;
          box-shadow: 0 18px 35px rgba(83, 105, 145, 0.09);
        }

        .catalog-product-media {
          position: relative;
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 28px 12px;
        }

        .catalog-product-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 2;
          min-height: 26px;
          padding: 3px 10px;
          border-radius: 6px;
          background: #df2f72;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          font-size: 16px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .catalog-product-badge.is-danger {
          background: #64748b;
        }

        .catalog-heart-button {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #637891;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 0.16s ease;
        }

        .catalog-heart-button:hover,
        .catalog-heart-button.is-active {
          color: #df2f72;
        }

        .catalog-product-image {
          max-width: 88%;
          max-height: 190px;
          width: auto;
          height: auto;
          object-fit: contain;
          transition: transform 0.28s ease;
          filter: drop-shadow(0 18px 18px rgba(52, 78, 112, 0.08));
        }

        .catalog-product-card:hover .catalog-product-image {
          transform: scale(1.035);
        }

        .catalog-image-fallback {
          width: 160px;
          height: 160px;
          border-radius: 18px;
          background: #eef4fb;
          color: #96a7be;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-product-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 18px 34px 28px;
        }

        .catalog-product-title {
          margin: 0;
          color: #050505;
          font-size: 17px;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.02em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .catalog-product-category {
          margin: 10px 0 0;
          color: #6e7d93;
          font-size: 15px;
          line-height: 1.2;
        }

        .catalog-product-footer {
          margin-top: 14px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          min-height: 25px;
        }

        .catalog-price-block {
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }

        .catalog-price-block strong {
          color: #050505;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }

        .catalog-price-block span {
          color: #738197;
          font-size: 16px;
          text-decoration: line-through;
          white-space: nowrap;
        }

        .catalog-profit-chip {
          display: none;
        }

        .catalog-product-actions {
          margin-top: 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 46px;
          gap: 12px;
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .catalog-product-card:hover .catalog-product-actions,
        .catalog-product-actions.is-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .catalog-buy-button {
          height: 46px;
          border: 0;
          border-radius: 6px;
          background: #0b6fe8;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          transition: 0.16s ease;
        }

        .catalog-buy-button:hover:not(:disabled) {
          background: #075dcc;
        }

        .catalog-buy-button:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        .catalog-cart-button {
          height: 46px;
          border: 1px solid #0b6fe8;
          border-radius: 6px;
          background: #ffffff;
          color: #0b6fe8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.16s ease;
        }

        .catalog-cart-button:hover {
          background: #eff6ff;
        }

        .catalog-show-more-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 38px;
          flex-wrap: wrap;
        }

        .catalog-show-more-row > button {
          min-width: 178px;
          height: 48px;
          border: 1px solid #0b6fe8;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          transition: 0.16s ease;
        }

        .catalog-show-more-row > button:hover:not(:disabled) {
          background: #0b6fe8;
          color: #ffffff;
        }

        .catalog-show-more-row > button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .catalog-page-stepper {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #60708a;
          font-size: 13px;
        }

        .catalog-page-stepper button {
          width: 34px;
          height: 34px;
          border: 1px solid #d9e5f4;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-page-stepper button:disabled {
          opacity: 0.45;
          color: #94a3b8;
        }

        @media (max-width: 1400px) {
          .catalog-board {
            padding: 44px 42px;
          }

          .catalog-content-layout {
            grid-template-columns: 250px minmax(0, 1fr);
            gap: 30px;
          }

          .catalog-product-body {
            padding-left: 26px;
            padding-right: 26px;
          }
        }

        @media (max-width: 1180px) {
          .catalog-board-header {
            flex-direction: column;
          }

          .catalog-header-actions {
            padding-top: 0;
            justify-content: flex-start;
          }

          .catalog-content-layout {
            grid-template-columns: 1fr;
          }

          .catalog-filter-panel {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 24px;
          }

          .catalog-filter-section {
            margin-bottom: 0;
          }

          .catalog-filter-search,
          .catalog-filter-footer,
          .catalog-stock-row {
            grid-column: 1 / -1;
          }

          .catalog-products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .catalog-page-shell {
            padding: 18px 12px 44px;
          }

          .catalog-board {
            padding: 28px 18px;
          }

          .catalog-title-row h1 {
            font-size: 28px;
          }

          .catalog-filter-panel {
            display: block;
          }

          .catalog-products-grid {
            grid-template-columns: 1fr;
          }

          .catalog-header-actions {
            gap: 8px;
          }

          .catalog-utility-button span {
            display: none;
          }

          .catalog-sort-select {
            min-width: 142px;
          }
        }
      `})]})};export{ua as default};
