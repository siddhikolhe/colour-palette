import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return { r, g, b, str: `${r}, ${g}, ${b}` };
}
function hexToHsl(hex) {
  let {r,g,b} = hexToRgb(hex); r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
  }
  return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}
function lum(hex) {
  const {r,g,b}=hexToRgb(hex);
  const lin=(c)=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}
function contrast(a,b){const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);}
function wcag(ratio){
  if(ratio>=7)return{level:"AAA",col:"#16a34a"};
  if(ratio>=4.5)return{level:"AA",col:"#2563eb"};
  if(ratio>=3)return{level:"AA Large",col:"#d97706"};
  return{level:"Fail",col:"#dc2626"};
}
function bright(hex){return lum(hex)>0.179?"#1a1a1a":"#ffffff";}
function shades(h,n=20){
  return Array.from({length:n},(_,i)=>{
    const l=96-(i*(86/(n-1))); const s=12+(i*(68/(n-1)));
    return hslToHex(Math.round(h),Math.round(s),Math.round(l));
  });
}
function encodeUrl(palette,mood){
  return `${window.location.origin}${window.location.pathname}?p=${btoa(JSON.stringify({p:palette,m:mood}))}`;
}
function decodeUrl(){
  const raw=new URLSearchParams(window.location.search).get("p");
  if(!raw)return null; try{return JSON.parse(atob(raw));}catch{return null;}
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MOODS=[
  {label:"Calm",emoji:"🌊",h:200},{label:"Energetic",emoji:"⚡",h:20},
  {label:"Earthy",emoji:"🌿",h:35},{label:"Mystic",emoji:"🔮",h:270},
  {label:"Fresh",emoji:"🌱",h:140},{label:"Warm",emoji:"🌅",h:15},
  {label:"Ocean",emoji:"🐋",h:210},{label:"Rose",emoji:"🌸",h:340},
  {label:"Gold",emoji:"✨",h:45},{label:"Slate",emoji:"🪨",h:222},
];
const COUNTS=[10,15,20,25];

// ─── Theme ────────────────────────────────────────────────────────────────────
const T=(d)=>({
  bg:d?"#111113":"#f7f6f2", surface:d?"#18181b":"#ffffff",
  surface2:d?"#222226":"#f0efe9", border:d?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)",
  text:d?"#e8e2d5":"#1a1a1a", muted:d?"#52525b":"#a1a1aa",
  subtle:d?"#27272a":"#e4e4e7",
});

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;1,300&family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{margin:0;font-family:'DM Mono',monospace;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:2px;}
input,button{font-family:'DM Mono',monospace;}
input:focus{outline:none;}
button{cursor:pointer;border:none;background:none;}
.strip{display:flex;gap:3px;overflow-x:auto;padding-bottom:4px;}
.strip::-webkit-scrollbar{height:2px;}
`;

// ─── Btn ──────────────────────────────────────────────────────────────────────
function Btn({children,active,onClick,dark,sm}){
  const t=T(dark);
  return(
    <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}} onClick={onClick} style={{
      padding:sm?"5px 12px":"8px 18px", fontSize:"9px", letterSpacing:"0.18em",
      textTransform:"uppercase", background:active?t.text:t.surface,
      color:active?t.bg:t.muted, border:`1px solid ${active?t.text:t.border}`,
      borderRadius:"2px", transition:"all 0.2s",
    }}>{children}</motion.button>
  );
}

function Hr({dark,v}){
  const t=T(dark);
  return <div style={v?{width:"1px",height:"20px",background:t.border,margin:"0 4px"}:{height:"1px",background:t.border}} />;
}

// ─── SwatchCard ───────────────────────────────────────────────────────────────
function SwatchCard({color,index,locked,onCopy,onLock,onFav,isFav,copied,dark,contrastBg}){
  const [hov,setHov]=useState(false);
  const txt=bright(color);
  const ratio=contrastBg?contrast(color,contrastBg):null;
  const w=ratio?wcag(ratio):null;
  return(
    <motion.div
      layout
      initial={{opacity:0,y:20,scale:0.93}} animate={{opacity:1,y:0,scale:1}}
      transition={{duration:0.32,delay:index*0.016,ease:[0.16,1,0.3,1]}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>onCopy(color)}
      style={{
        flex:1, minWidth:"52px", minHeight:"210px", background:color,
        borderRadius:"3px", position:"relative", cursor:"pointer",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"10px 8px",
        boxShadow:hov?"0 14px 40px rgba(0,0,0,0.18)":"0 2px 6px rgba(0,0,0,0.06)",
        transform:locked?"none":hov?"translateY(-10px)":"none",
        transition:"box-shadow 0.3s, transform 0.25s",
        border:locked?`2px solid ${txt}`:"2px solid transparent",
      }}
    >
      <AnimatePresence>
        {hov&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{display:"flex",justifyContent:"space-between",position:"relative",zIndex:2}}
            onClick={e=>e.stopPropagation()}
          >
            <button onClick={()=>onFav(color)} style={{
              background:"rgba(0,0,0,0.2)",borderRadius:"50%",width:"22px",height:"22px",
              fontSize:"11px",display:"flex",alignItems:"center",justifyContent:"center",
              color:isFav?"#ff6b6b":txt,
            }}>{isFav?"♥":"♡"}</button>
            <button onClick={()=>onLock(index)} style={{
              background:"rgba(0,0,0,0.2)",borderRadius:"50%",width:"22px",height:"22px",
              fontSize:"10px",display:"flex",alignItems:"center",justifyContent:"center",color:txt,
            }}>{locked?"🔒":"🔓"}</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {copied===color&&(
          <motion.div initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
            style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
              justifyContent:"center",background:"rgba(0,0,0,0.22)",borderRadius:"3px",
              fontSize:"22px",color:"#fff"}}
          >✓</motion.div>
        )}
      </AnimatePresence>
      <div>
        {w&&(
          <div style={{display:"inline-block",padding:"2px 6px",borderRadius:"2px",
            background:"rgba(0,0,0,0.28)",marginBottom:"4px"}}>
            <span style={{fontSize:"8px",letterSpacing:"0.1em",color:"#fff"}}>{w.level} {ratio.toFixed(1)}:1</span>
          </div>
        )}
        <div style={{fontSize:"9px",letterSpacing:"0.06em",color:txt,opacity:0.72}}>{color.toUpperCase()}</div>
      </div>
    </motion.div>
  );
}

// ─── ContrastPanel ────────────────────────────────────────────────────────────
function ContrastPanel({palette,dark}){
  const t=T(dark);
  const [bg,setBg]=useState(palette[palette.length-1]||"#ffffff");
  const [fg,setFg]=useState(palette[0]||"#000000");
  const r=contrast(fg,bg); const w=wcag(r);
  return(
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:"6px",padding:"24px",marginTop:"20px"}}>
      <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"18px"}}>CONTRAST CHECKER — WCAG</div>
      <div style={{background:bg,borderRadius:"4px",padding:"20px 24px",marginBottom:"18px",border:`1px solid ${t.border}`}}>
        <div style={{fontFamily:"'Cormorant',serif",fontSize:"28px",color:fg,marginBottom:"6px"}}>The quick brown fox</div>
        <div style={{fontSize:"11px",color:fg,opacity:0.8,letterSpacing:"0.05em"}}>Body text at regular weight — 16px</div>
      </div>
      <div style={{display:"flex",gap:"16px",alignItems:"center",flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:"9px",letterSpacing:"0.2em",color:t.muted,marginBottom:"6px"}}>BACKGROUND</div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {palette.slice(-8).map((c,i)=>(
              <div key={i} onClick={()=>setBg(c)} style={{width:"28px",height:"28px",background:c,borderRadius:"3px",cursor:"pointer",
                border:bg===c?`2px solid ${t.text}`:"2px solid transparent",transition:"border 0.15s"}} />
            ))}
          </div>
        </div>
        <Hr dark={dark} v />
        <div>
          <div style={{fontSize:"9px",letterSpacing:"0.2em",color:t.muted,marginBottom:"6px"}}>FOREGROUND</div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {palette.slice(0,8).map((c,i)=>(
              <div key={i} onClick={()=>setFg(c)} style={{width:"28px",height:"28px",background:c,borderRadius:"3px",cursor:"pointer",
                border:fg===c?`2px solid ${t.text}`:"2px solid transparent",transition:"border 0.15s"}} />
            ))}
          </div>
        </div>
        <Hr dark={dark} v />
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Cormorant',serif",fontSize:"40px",color:w.col,lineHeight:1}}>{r.toFixed(2)}</div>
          <div style={{fontSize:"9px",letterSpacing:"0.15em",color:t.muted,marginTop:"2px"}}>:1 ratio</div>
          <div style={{marginTop:"6px",padding:"3px 10px",borderRadius:"2px",background:w.col+"18",
            fontSize:"9px",letterSpacing:"0.15em",color:w.col}}>{w.level}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── ExportModal ──────────────────────────────────────────────────────────────
function ExportModal({palette,mood,onClose,dark}){
  const t=T(dark);
  const [fmt,setFmt]=useState("css");
  const [cp,setCp]=useState(false);
  const [sh,setSh]=useState(false);
  const name=mood?.label?.toLowerCase()||"color";
  const fmts={
    css:`:root {\n${palette.map((h,i)=>`  --${name}-${(i+1)*50}: ${h};`).join("\n")}\n}`,
    hex:palette.map((h,i)=>`${(i+1)*50}: ${h}`).join("\n"),
    rgb:palette.map((h,i)=>`${(i+1)*50}: rgb(${hexToRgb(h).str})`).join("\n"),
    tailwind:`'${name}': {\n${palette.map((h,i)=>`  '${(i+1)*50}': '${h}',`).join("\n")}\n}`,
    scss:palette.map((h,i)=>`$${name}-${(i+1)*50}: ${h};`).join("\n"),
    gradient:`background: linear-gradient(135deg, ${palette.join(", ")});`,
  };
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",
        justifyContent:"center",zIndex:1000,backdropFilter:"blur(8px)"}}>
      <motion.div initial={{scale:0.9,y:24}} animate={{scale:1,y:0}} exit={{scale:0.9}} onClick={e=>e.stopPropagation()}
        transition={{ease:[0.16,1,0.3,1],duration:0.4}}
        style={{background:t.surface,borderRadius:"10px",padding:"36px",width:"560px",maxWidth:"92vw",
          boxShadow:"0 40px 100px rgba(0,0,0,0.22)",border:`1px solid ${t.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"22px"}}>
          <div style={{fontFamily:"'Cormorant',serif",fontSize:"24px",fontStyle:"italic",color:t.text}}>Export Palette</div>
          <button onClick={onClose} style={{color:t.muted,fontSize:"22px"}}>×</button>
        </div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"14px"}}>
          {Object.keys(fmts).map(f=><Btn key={f} active={fmt===f} onClick={()=>setFmt(f)} dark={dark} sm>{f}</Btn>)}
        </div>
        <pre style={{background:t.surface2,padding:"18px",borderRadius:"4px",fontSize:"11px",
          fontFamily:"'DM Mono',monospace",lineHeight:1.8,color:t.text,maxHeight:"180px",
          overflow:"auto",border:`1px solid ${t.border}`}}>{fmts[fmt]}</pre>
        <div style={{height:"34px",borderRadius:"4px",overflow:"hidden",margin:"16px 0",
          background:`linear-gradient(to right, ${palette.join(", ")})`}} />
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>{navigator.clipboard.writeText(fmts[fmt]);setCp(true);setTimeout(()=>setCp(false),2000);}}
            style={{flex:1,padding:"12px",background:cp?"#16a34a":t.text,color:t.bg,borderRadius:"3px",
              fontSize:"9px",letterSpacing:"0.22em",textTransform:"uppercase",transition:"background 0.3s"}}>
            {cp?"✓ Copied!":"Copy Code"}
          </button>
          <button onClick={()=>{navigator.clipboard.writeText(encodeUrl(palette,mood?.label));setSh(true);setTimeout(()=>setSh(false),2500);}}
            style={{flex:1,padding:"12px",background:sh?"#2563eb":t.surface2,color:sh?"#fff":t.text,
              border:`1px solid ${t.border}`,borderRadius:"3px",fontSize:"9px",
              letterSpacing:"0.22em",textTransform:"uppercase",transition:"all 0.3s"}}>
            {sh?"✓ Link Copied!":"↗ Share URL"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────
function StatsPanel({saved,favs,hist,dark}){
  const t=T(dark);
  const total=saved.reduce((a,p)=>a+p.colors.length,0);
  const moodMap=saved.reduce((acc,p)=>{acc[p.name]=(acc[p.name]||0)+1;return acc;},{});
  const top=Object.entries(moodMap).sort((a,b)=>b[1]-a[1])[0];
  const stats=[
    {label:"Palettes",value:saved.length},{label:"Total Shades",value:total},
    {label:"Favorited",value:favs.length},{label:"Copied",value:hist.length},
  ];
  return(
    <div style={{marginBottom:"32px"}}>
      <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"14px"}}>YOUR STATS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"8px"}}>
        {stats.map((s,i)=>(
          <motion.div key={s.label} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
            style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:"6px",padding:"18px 16px"}}>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:"32px",color:t.text,lineHeight:1,marginBottom:"5px"}}>{s.value}</div>
            <div style={{fontSize:"9px",letterSpacing:"0.15em",color:t.muted,textTransform:"uppercase"}}>{s.label}</div>
          </motion.div>
        ))}
      </div>
      {top&&(
        <div style={{padding:"12px 16px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:"6px",
          fontSize:"10px",color:t.muted,letterSpacing:"0.1em"}}>
          Most used: <span style={{color:t.text}}>{MOODS.find(m=>m.label===top[0])?.emoji} {top[0]}</span>
          <span style={{color:t.muted}}> · {top[1]} palette{top[1]>1?"s":""}</span>
        </div>
      )}
    </div>
  );
}

// ─── FavWall ──────────────────────────────────────────────────────────────────
function FavWall({favs,onCopy,onRemove,copied,dark}){
  const t=T(dark);
  if(favs.length===0)return(
    <div style={{textAlign:"center",padding:"60px 0",color:t.muted,fontSize:"10px",letterSpacing:"0.18em"}}>
      NO FAVORITES YET — HOVER A SWATCH AND CLICK ♡
    </div>
  );
  return(
    <div>
      <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"16px"}}>FAVORITE COLORS — {favs.length}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"12px"}}>
        {favs.map((color,i)=>(
          <motion.div key={color+i} initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}}
            transition={{delay:i*0.03}} style={{position:"relative"}}>
            <motion.div whileHover={{scale:1.1,y:-4}} onClick={()=>onCopy(color)} title={color}
              style={{width:"56px",height:"56px",borderRadius:"8px",background:color,cursor:"pointer",
                boxShadow:copied===color?`0 0 0 3px ${t.text}`:"0 4px 14px rgba(0,0,0,0.12)",
                transition:"box-shadow 0.2s",position:"relative",overflow:"hidden",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              <AnimatePresence>
                {copied===color&&(
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.25)",
                      display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"18px"}}>✓</motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <div style={{fontSize:"8px",textAlign:"center",marginTop:"4px",color:t.muted,letterSpacing:"0.04em"}}>
              {color.toUpperCase()}
            </div>
            <button onClick={()=>onRemove(color)}
              style={{position:"absolute",top:"-5px",right:"-5px",width:"16px",height:"16px",
                borderRadius:"50%",background:t.text,color:t.bg,fontSize:"9px",
                display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ColorPalette() {
  const [dark,setDark]=useState(false);
  const [tab,setTab]=useState("generate");
  const [mood,setMood]=useState(null);
  const [palette,setPalette]=useState([]);
  const [locked,setLocked]=useState([]);
  const [count,setCount]=useState(20);
  const [view,setView]=useState("strip");
  const [copied,setCopied]=useState(null);
  const [saved,setSaved]=useState([]);
  const [favs,setFavs]=useState([]);
  const [hist,setHist]=useState([]);
  const [showExport,setShowExport]=useState(false);
  const [showContrast,setShowContrast]=useState(false);
  const [custom,setCustom]=useState("#4a90d9");
  const [saveOk,setSaveOk]=useState(false);
  const [search,setSearch]=useState("");

  const t=T(dark);

  useEffect(()=>{
    const shared=decodeUrl();
    if(shared?.p){setPalette(shared.p);setMood({label:shared.m||"Shared",emoji:"🔗"});setLocked(new Array(shared.p.length).fill(false));}
  },[]);

  const gen=useCallback((m,cnt)=>{
    const n=cnt??count;
    const next=shades(m.h,n);
    if(palette.length===n){
      setPalette(next.map((c,i)=>locked[i]?palette[i]:c));
    } else {
      setPalette(next); setLocked(new Array(n).fill(false));
    }
    setMood(m);
  },[count,palette,locked]);

  const genCustom=()=>{
    const {h}=hexToHsl(custom);
    setPalette(shades(h,count));
    setMood({label:"Custom",emoji:"🎨",h});
    setLocked(new Array(count).fill(false));
  };

  const copy=(hex)=>{
    navigator.clipboard.writeText(hex);
    setCopied(hex); setHist(p=>[{hex,t:new Date()},...p].slice(0,30));
    setTimeout(()=>setCopied(null),1200);
  };

  const toggleLock=(i)=>setLocked(p=>{const n=[...p];n[i]=!n[i];return n;});
  const toggleFav=(hex)=>setFavs(p=>p.includes(hex)?p.filter(c=>c!==hex):[...p,hex]);
  const removeFav=(hex)=>setFavs(p=>p.filter(c=>c!==hex));

  const save=()=>{
    if(!palette.length)return;
    setSaved(p=>[{name:mood?.label||"Custom",emoji:mood?.emoji||"🎨",colors:palette,createdAt:new Date().toISOString()},...p]);
    setSaveOk(true); setTimeout(()=>setSaveOk(false),2000);
  };

  const filtered=search?palette.filter(c=>c.toLowerCase().includes(search.toLowerCase())):palette;

  return(
    <div style={{minHeight:"100vh",width:"100%",background:t.bg,color:t.text,transition:"background 0.4s,color 0.4s"}}>
      <style>{CSS}</style>

      <AnimatePresence>
        {showExport&&<ExportModal palette={palette} mood={mood} onClose={()=>setShowExport(false)} dark={dark}/>}
      </AnimatePresence>

      {/* Header */}
      <motion.header initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}}
        transition={{duration:0.6,ease:[0.16,1,0.3,1]}}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 40px",borderBottom:`1px solid ${t.border}`,background:t.bg,
          position:"sticky",top:0,zIndex:50,flexWrap:"wrap",gap:"10px",backdropFilter:"blur(12px)"}}>

        <div style={{display:"flex",alignItems:"baseline",gap:"12px"}}>
          <div style={{fontFamily:"'Cormorant',serif",fontSize:"26px",fontStyle:"italic",color:t.text,lineHeight:1}}>Chroma</div>
          {mood&&palette.length>0&&(
            <motion.div initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
              style={{fontSize:"9px",letterSpacing:"0.22em",color:t.muted,textTransform:"uppercase"}}>
              {mood.emoji} {mood.label} · {palette.length} shades
            </motion.div>
          )}
        </div>

        <div style={{display:"flex",gap:"4px",alignItems:"center",flexWrap:"wrap"}}>
          {["generate","dashboard","favorites"].map(tb=>(
            <Btn key={tb} active={tab===tb} onClick={()=>setTab(tb)} dark={dark} sm>
              {tb}{tb==="favorites"&&favs.length>0?` (${favs.length})`:""}
            </Btn>
          ))}
          <Hr dark={dark} v/>
          {tab==="generate"&&palette.length>0&&(
            <>
              {[{v:"strip",i:"▬"},{v:"grid",i:"⊞"}].map(({v,i})=>(
                <button key={v} onClick={()=>setView(v)} style={{
                  background:view===v?t.subtle:"transparent",color:view===v?t.text:t.muted,
                  border:`1px solid ${t.border}`,padding:"5px 10px",fontSize:"13px",
                  borderRadius:"2px",transition:"all 0.2s"}}>
                  {i}
                </button>
              ))}
              <Hr dark={dark} v/>
            </>
          )}
          <motion.button whileHover={{scale:1.08}} whileTap={{scale:0.94}} onClick={()=>setDark(d=>!d)}
            style={{width:"32px",height:"32px",borderRadius:"50%",background:t.subtle,
              border:`1px solid ${t.border}`,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:"14px",color:t.text,transition:"all 0.3s"}}>
            {dark?"☀":"◑"}
          </motion.button>
        </div>
      </motion.header>

      {/* Body */}
      <div style={{padding:"32px 40px 80px",maxWidth:"1600px",margin:"0 auto"}}>
        <AnimatePresence mode="wait">

          {/* GENERATE */}
          {tab==="generate"&&(
            <motion.div key="gen" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}>
              <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.5}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                  marginBottom:"24px",flexWrap:"wrap",gap:"20px"}}>

                <div>
                  <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"10px"}}>MOOD</div>
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"12px"}}>
                    {MOODS.map(m=>(
                      <Btn key={m.label} active={mood?.label===m.label} onClick={()=>gen(m)} dark={dark} sm>
                        {m.emoji} {m.label}
                      </Btn>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                    <div style={{fontSize:"9px",letterSpacing:"0.22em",color:t.muted}}>CUSTOM</div>
                    <input type="color" value={custom} onChange={e=>setCustom(e.target.value)}
                      style={{width:"32px",height:"32px",border:`1px solid ${t.border}`,borderRadius:"3px",
                        cursor:"pointer",padding:"2px",background:t.surface}} />
                    <div style={{padding:"4px 10px",background:custom,borderRadius:"2px",
                      fontSize:"9px",color:bright(custom),letterSpacing:"0.1em"}}>
                      {custom.toUpperCase()}
                    </div>
                    <Btn active={mood?.label==="Custom"} onClick={genCustom} dark={dark} sm>🎨 Generate</Btn>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"10px"}}>SHADES</div>
                  <div style={{display:"flex",gap:"5px"}}>
                    {COUNTS.map(c=>(
                      <Btn key={c} active={count===c} dark={dark} sm
                        onClick={()=>{setCount(c);if(mood&&mood.label!=="Custom")gen(mood,c);}}>
                        {c}
                      </Btn>
                    ))}
                  </div>
                </div>
              </motion.div>

              <Hr dark={dark}/>

              <AnimatePresence mode="wait">
                {palette.length>0?(
                  <motion.div key={view} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{marginTop:"20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
                      <input placeholder="Filter by hex…" value={search} onChange={e=>setSearch(e.target.value)}
                        style={{border:`1px solid ${t.border}`,borderRadius:"2px",padding:"6px 14px",
                          fontSize:"11px",background:t.surface,color:t.text,width:"180px"}} />
                      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                        {locked.some(Boolean)&&(
                          <span style={{fontSize:"9px",color:t.muted,letterSpacing:"0.1em"}}>
                            {locked.filter(Boolean).length} locked
                          </span>
                        )}
                        <Btn active={showContrast} onClick={()=>setShowContrast(v=>!v)} dark={dark} sm>◑ Contrast</Btn>
                      </div>
                    </div>

                    {view==="strip"&&(
                      <div className="strip" style={{marginBottom:"16px"}}>
                        {filtered.map((color,i)=>(
                          <SwatchCard key={color+i} color={color} index={i}
                            locked={locked[palette.indexOf(color)]}
                            onCopy={copy} onLock={toggleLock}
                            onFav={toggleFav} isFav={favs.includes(color)}
                            copied={copied} dark={dark}
                            contrastBg={showContrast?"#ffffff":null}/>
                        ))}
                      </div>
                    )}

                    {view==="grid"&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"16px"}}>
                        {filtered.map((color,i)=>(
                          <motion.div key={color+i}
                            initial={{opacity:0,scale:0.88}} animate={{opacity:1,scale:1}}
                            transition={{delay:i*0.02}} whileHover={{scale:1.1}}
                            onClick={()=>copy(color)} title={color}
                            style={{width:"72px",height:"72px",borderRadius:"6px",background:color,
                              cursor:"pointer",boxShadow:copied===color?`0 0 0 3px ${t.text}`:"0 2px 8px rgba(0,0,0,0.1)",
                              transition:"box-shadow 0.2s",display:"flex",alignItems:"flex-end",
                              justifyContent:"center",paddingBottom:"7px",position:"relative",overflow:"hidden"}}>
                            <AnimatePresence>
                              {copied===color&&(
                                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                                  style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.22)",
                                    display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"18px"}}>✓</motion.div>
                              )}
                            </AnimatePresence>
                            <span style={{fontSize:"7px",color:bright(color),opacity:0.7,letterSpacing:"0.06em"}}>
                              {color.slice(1).toUpperCase()}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.15}}
                      style={{height:"40px",borderRadius:"4px",marginBottom:"16px",
                        background:`linear-gradient(to right, ${palette.join(", ")})`,
                        boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}} />

                    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
                      style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
                      <Btn onClick={()=>mood?.label==="Custom"?genCustom():gen(mood)} dark={dark} sm>↻ Regenerate</Btn>
                      <Btn onClick={save} active={saveOk} dark={dark} sm>{saveOk?"✓ Saved":"♡ Save"}</Btn>
                      <Btn onClick={()=>setShowExport(true)} dark={dark} sm>↗ Export</Btn>
                      <div style={{flex:1}}/>
                      <span style={{fontSize:"9px",color:t.muted,letterSpacing:"0.1em"}}>
                        Hover to lock / favorite · click to copy
                      </span>
                    </motion.div>

                    <AnimatePresence>
                      {showContrast&&<ContrastPanel palette={palette} dark={dark}/>}
                    </AnimatePresence>
                  </motion.div>
                ):(
                  <motion.div initial={{opacity:0}} animate={{opacity:1}}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",
                      justifyContent:"center",height:"52vh",gap:"16px"}}>
                    <div style={{fontSize:"80px",opacity:0.06}}>◈</div>
                    <div style={{fontSize:"10px",letterSpacing:"0.3em",color:t.muted}}>SELECT A MOOD OR PICK A CUSTOM COLOR</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* DASHBOARD */}
          {tab==="dashboard"&&(
            <motion.div key="dash" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}>
              <StatsPanel saved={saved} favs={favs} hist={hist} dark={dark}/>

              {hist.length>0&&(
                <div style={{marginBottom:"32px"}}>
                  <div style={{fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"14px"}}>RECENTLY COPIED</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {hist.slice(0,20).map((item,i)=>(
                      <motion.div key={item.hex+i} initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}}
                        transition={{delay:i*0.02}} whileHover={{scale:1.15,y:-3}}
                        onClick={()=>copy(item.hex)} title={item.hex}
                        style={{width:"36px",height:"36px",borderRadius:"4px",background:item.hex,
                          cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}} />
                    ))}
                  </div>
                </div>
              )}

              <Hr dark={dark}/>
              <div style={{marginTop:"24px",fontSize:"9px",letterSpacing:"0.28em",color:t.muted,marginBottom:"14px"}}>
                SAVED PALETTES — {saved.length}
              </div>

              {saved.length===0?(
                <div style={{textAlign:"center",padding:"60px 0",color:t.muted,fontSize:"10px",letterSpacing:"0.18em"}}>
                  NO SAVED PALETTES YET
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {saved.map((entry,i)=>(
                    <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                      style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:"6px",padding:"20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
                        <span style={{fontSize:"10px",letterSpacing:"0.15em",color:t.text,textTransform:"uppercase"}}>
                          {entry.emoji} {entry.name} · {entry.colors.length} shades
                        </span>
                        <span style={{fontSize:"9px",color:t.muted}}>{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{height:"34px",borderRadius:"3px",marginBottom:"10px",
                        background:`linear-gradient(to right, ${entry.colors.join(", ")})`}} />
                      <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                        {entry.colors.map((c,j)=>(
                          <motion.div key={j} whileHover={{scale:1.35}} onClick={()=>copy(c)} title={c}
                            style={{width:"20px",height:"20px",borderRadius:"50%",background:c,cursor:"pointer",
                              border:`2px solid ${t.bg}`,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* FAVORITES */}
          {tab==="favorites"&&(
            <motion.div key="favs" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}>
              <FavWall favs={favs} onCopy={copy} onRemove={removeFav} copied={copied} dark={dark}/>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
