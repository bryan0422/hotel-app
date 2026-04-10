import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://beueakugyzzvniiugmql.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldWVha3VneXp6dm5paXVnbXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODc4NDAsImV4cCI6MjA5MTM2Mzg0MH0.LHyYOQLbm__jwOOsLLmpA6S1L985Ky5kXz3eGqdjANg";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PALETTE = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ec4899","#8b5cf6"];

function ds(d){ return d.toISOString().split("T")[0]; }
function addD(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtTime(t){
  if(!t) return "";
  const [h,m]=t.split(":");
  const hr=parseInt(h);
  return `${hr>12?hr-12:hr===0?12:hr}:${m} ${hr>=12?"pm":"am"}`;
}

export default function App(){
  const today = new Date();
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const [tab,setTab]=useState("cal");
  const [rooms,setRooms]=useState([]);
  const [roomTypes,setRoomTypes]=useState([]);
  const [reservations,setRes]=useState([]);
  const [blocks,setBlocks]=useState([]);
  const [guests,setGuests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selDay,setSelDay]=useState(null);
  const [ciTime,setCiTime]=useState("14:00");
  const [coDate,setCoDate]=useState("");
  const [coTime,setCoTime]=useState("12:00");
  const [avail,setAvail]=useState(null);
  const [searched,setSearched]=useState(false);
  const [rModal,setRModal]=useState(false);
  const [selRoom,setSelRoom]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [detModal,setDetModal]=useState(null);
  const [blkModal,setBlkModal]=useState(false);
  const [blkForm,setBlkForm]=useState({});

  const load = useCallback(async()=>{
    setLoading(true);
    const [r,rt,res,bl,g] = await Promise.all([
      sb.from("rooms").select("*,room_types(*)").order("room_number"),
      sb.from("room_types").select("*").order("name"),
      sb.from("reservations").select("*,guests(*),rooms(room_number)").neq("status","cancelled"),
      sb.from("room_blocks").select("*"),
      sb.from("guests").select("*").order("full_name"),
    ]);
    setRooms(r.data||[]); setRoomTypes(rt.data||[]); setRes(res.data||[]);
    setBlocks(bl.data||[]); setGuests(g.data||[]); setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  const todayStr = ds(today);
  const firstDay = new Date(yr,mo,1).getDay();
  const dim = new Date(yr,mo+1,0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:dim},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const rows = cells.length/7;

  function resForDay(d){
    const s=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return reservations.filter(r=>r.check_in<=s&&r.check_out>s&&r.status!=="cancelled");
  }
  function blkForDay(d){
    const s=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return blocks.filter(b=>b.start_date<=s&&b.end_date>=s);
  }
  function clr(id){ const i=roomTypes.findIndex(rt=>rt.id===id); return PALETTE[Math.max(0,i)%PALETTE.length]; }

  function clickDay(d){
    if(!d) return;
    const s=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    setSelDay(s); setCiTime("14:00");
    setCoDate(ds(addD(new Date(s+"T00:00:00"),1))); setCoTime("12:00");
    setAvail(null); setSearched(false);
  }

  function search(){
    if(!selDay||!coDate) return;
    const ci=`${selDay}T${ciTime}`, co=`${coDate}T${coTime}`;
    const occ=new Set();
    reservations.forEach(r=>{
      if(r.status==="cancelled") return;
      const ri=r.check_in_datetime||r.check_in+"T14:00";
      const ro=r.check_out_datetime||r.check_out+"T12:00";
      if(ri<co&&ro>ci) occ.add(r.room_id);
    });
    blocks.forEach(b=>{ if(b.start_date+"T00:00"<=co&&b.end_date+"T23:59">=ci) occ.add(b.room_id); });
    setAvail(rooms.filter(r=>r.status==="available"&&!occ.has(r.id)));
    setSearched(true);
  }

  function openRes(room){
    setSelRoom(room);
    setForm({room_id:room.id,check_in:selDay,check_in_time:ciTime,check_out:coDate,check_out_time:coTime,adults:1,children:0,source:"direct"});
    setRModal(true);
  }

  async function saveRes(){
    setSaving(true);
    try{
      let gid=form.guest_id;
      if(!gid&&form.gname){
        const{data:g,error:ge}=await sb.from("guests").insert({full_name:form.gname,phone:form.gphone||null,email:form.gemail||null}).select().single();
        if(ge) throw ge; gid=g.id;
      }
      if(!gid) throw new Error("Ingresa el nombre del huésped");
      const{error}=await sb.from("reservations").insert({
        room_id:form.room_id,guest_id:gid,check_in:form.check_in,check_out:form.check_out,
        check_in_datetime:`${form.check_in}T${form.check_in_time||"14:00"}`,
        check_out_datetime:`${form.check_out}T${form.check_out_time||"12:00"}`,
        status:"confirmed",adults:parseInt(form.adults)||1,children:parseInt(form.children)||0,
        total_price:parseFloat(form.total_price)||null,notes:form.notes||null,source:form.source||"direct",
      });
      if(error) throw error;
      setRModal(false); setForm({}); search(); load();
    }catch(e){ alert(e.message); }
    setSaving(false);
  }

  async function saveBlk(){
    setSaving(true);
    try{
      if(!blkForm.room_id) throw new Error("Selecciona habitación");
      const{error}=await sb.from("room_blocks").insert({room_id:blkForm.room_id,start_date:blkForm.start_date,end_date:blkForm.end_date,reason:blkForm.reason||"maintenance",notes:blkForm.notes||null});
      if(error) throw error; setBlkModal(false); setBlkForm({}); load();
    }catch(e){ alert(e.message); }
    setSaving(false);
  }

  async function cancelRes(id){ if(!confirm("¿Cancelar?")) return; await sb.from("reservations").update({status:"cancelled"}).eq("id",id); setDetModal(null); load(); }
  async function doCI(id){ await sb.from("reservations").update({status:"checked_in"}).eq("id",id); setDetModal(null); load(); }
  async function doCO(id){ await sb.from("reservations").update({status:"checked_out"}).eq("id",id); setDetModal(null); load(); }

  const totalR=rooms.filter(r=>r.status!=="inactive").length;
  const occToday=rooms.filter(r=>reservations.some(res=>res.room_id===r.id&&res.check_in<=todayStr&&res.check_out>todayStr&&res.status!=="cancelled")).length;
  const revenue=reservations.filter(r=>{const d=new Date(r.check_in+"T00:00:00");return d.getFullYear()===yr&&d.getMonth()===mo&&r.status!=="cancelled";}).reduce((s,r)=>s+(parseFloat(r.total_price)||0),0);
  const activeRes=reservations.filter(r=>r.status!=="cancelled"&&r.status!=="checked_out");
  const rate=totalR?Math.round(occToday/totalR*100):0;

  const inp = {width:"100%",padding:"8px 10px",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:8,color:"#0f172a",fontSize:12,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",boxSizing:"border-box"};
  const lbl = {fontSize:9,fontWeight:700,color:"#64748b",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1};
  const timeOpts = Array.from({length:48},(_,i)=>{const h=Math.floor(i/2),m=i%2===0?"00":"30";return `${String(h).padStart(2,"0")}:${m}`;});

  if(loading) return(
    <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>🏨</div>
        <div style={{color:"#334155",fontSize:11,letterSpacing:3,textTransform:"uppercase"}}>Cargando HotelDesk</div>
      </div>
    </div>
  );

  return(
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{height:100%;width:100%;overflow:hidden;}
      body{font-family:'Plus Jakarta Sans',sans-serif;}
      #root{position:fixed;top:0;left:0;right:0;bottom:0;}
      ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
      select option{background:#fff;color:#0f172a;}
    `}</style>

    {/* ROOT: fixed full screen */}
    <div style={{position:"fixed",inset:0,display:"flex",background:"#0f172a",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>

      {/* SIDEBAR */}
      <div style={{width:196,flexShrink:0,display:"flex",flexDirection:"column",padding:"0 0 16px",overflow:"hidden"}}>
        <div style={{padding:"20px 16px 16px",borderBottom:"1px solid #1e293b",marginBottom:8}}>
          <div style={{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:"-.5px"}}>🏨 <span style={{color:"#38bdf8"}}>Hotel</span>Desk</div>
          <div style={{fontSize:9,color:"#334155",textTransform:"uppercase",letterSpacing:2,marginTop:3}}>Admin Panel</div>
        </div>

        <div style={{flex:1,padding:"4px 8px"}}>
          {[["cal","📅","Calendario"],["rooms","🛏","Habitaciones"],["res","📋","Reservaciones"]].map(([k,ic,lb])=>(
            <div key={k} onClick={()=>setTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:tab===k?700:500,color:tab===k?"#38bdf8":"#475569",background:tab===k?"rgba(56,189,248,.1)":"transparent",marginBottom:2,transition:"all .15s"}}>
              <span style={{fontSize:14}}>{ic}</span>{lb}
            </div>
          ))}
        </div>

        <div style={{padding:"0 8px",display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {[
            [`${rate}%`,"Ocupación",rate>=80?"#ef4444":rate>=50?"#f59e0b":"#10b981"],
            [`${totalR-occToday}`,"Disponibles","#10b981"],
            [`$${revenue>=1000?(revenue/1000).toFixed(0)+"k":revenue}`,"Ingresos","#6366f1"],
          ].map(([v,l,c])=>(
            <div key={l} style={{background:"#1e293b",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{l}</div>
              <div style={{fontSize:15,fontWeight:800,color:c,letterSpacing:"-.5px"}}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{padding:"0 8px"}}>
          <button onClick={()=>{setBlkModal(true);setBlkForm({});}} style={{width:"100%",padding:"9px",background:"#ef444418",color:"#f87171",border:"1px solid #ef444433",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            🔒 Bloquear fechas
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,background:"#f1f5f9",display:"flex",flexDirection:"column",overflow:"hidden",borderRadius:"16px 0 0 16px"}}>

        {/* Topbar */}
        <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",background:"#fff",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{fontSize:14,fontWeight:800,color:"#0f172a",letterSpacing:"-.5px"}}>
            {tab==="cal"?"Calendario de disponibilidad":tab==="rooms"?"Habitaciones":"Reservaciones"}
          </div>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>
            {today.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
        </div>

        {/* CALENDAR TAB */}
        {tab==="cal"&&(
          <div style={{flex:1,display:"flex",overflow:"hidden",padding:"12px",gap:"12px",minHeight:0}}>

            {/* Calendar */}
            <div style={{flex:"0 0 56%",background:"#fff",borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
              {/* Cal header */}
              <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);}} style={{width:26,height:26,borderRadius:7,border:"1px solid #e2e8f0",background:"transparent",cursor:"pointer",fontSize:13,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
                  <button onClick={()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);}} style={{width:26,height:26,borderRadius:7,border:"1px solid #e2e8f0",background:"transparent",cursor:"pointer",fontSize:13,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
                  <span style={{fontSize:14,fontWeight:800,color:"#0f172a",letterSpacing:"-.5px"}}>{MONTHS[mo]} {yr}</span>
                </div>
                <button onClick={()=>{setYr(today.getFullYear());setMo(today.getMonth());}} style={{padding:"4px 11px",borderRadius:7,border:"1px solid #e2e8f0",background:"transparent",cursor:"pointer",fontSize:11,fontWeight:700,color:"#64748b",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Hoy</button>
              </div>

              {/* Day headers */}
              <div style={{flexShrink:0,display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#fafafa",borderBottom:"1px solid #f1f5f9"}}>
                {DAYS.map(d=><div key={d} style={{padding:"6px 0",textAlign:"center",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.8}}>{d}</div>)}
              </div>

              {/* Grid - fills remaining height */}
              <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridTemplateRows:`repeat(${rows},1fr)`,overflow:"hidden"}}>
                {cells.map((day,i)=>{
                  const s=day?`${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`:null;
                  const ist=s===todayStr, issel=s===selDay;
                  const dr=day?resForDay(day):[], db=day?blkForDay(day):[];
                  const tot=dr.length+db.length;
                  return(
                    <div key={i} onClick={()=>clickDay(day)}
                      style={{padding:"4px 5px",borderRight:"1px solid #f8fafc",borderBottom:"1px solid #f8fafc",cursor:day?"pointer":"default",background:issel?"#eff6ff":ist?"#fffbeb":!day?"#fafafa":"#fff",overflow:"hidden",transition:"background .1s"}}>
                      {day&&<>
                        <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:ist?800:500,background:ist?"#0f172a":"transparent",color:ist?"#fff":issel?"#6366f1":"#374151",marginBottom:2}}>{day}</div>
                        {dr.slice(0,1).map(r=>{
                          const rm=rooms.find(rm=>rm.id===r.room_id);
                          const c=clr(rm?.room_type_id);
                          return <div key={r.id} onClick={e=>{e.stopPropagation();setDetModal(r);}}
                            style={{fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:3,marginBottom:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",background:c+"18",color:c}}>
                            #{rm?.room_number} {r.guests?.full_name?.split(" ")[0]}
                          </div>;
                        })}
                        {db.slice(0,Math.max(0,1-dr.length)).map(b=>{
                          const rm=rooms.find(rm=>rm.id===b.room_id);
                          return <div key={b.id} style={{fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:3,background:"#fee2e218",color:"#ef4444"}}>🔒#{rm?.room_number}</div>;
                        })}
                        {tot>1&&<div style={{fontSize:9,color:"#94a3b8"}}>+{tot-1}</div>}
                      </>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:10,overflow:"hidden",minWidth:0,minHeight:0}}>

              {/* Search card */}
              <div style={{flexShrink:0,background:"#fff",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#0f172a",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                  🔍 Buscar disponibilidad
                  {selDay&&<span style={{marginLeft:"auto",fontSize:10,color:"#6366f1",fontWeight:700,background:"#6366f110",padding:"3px 10px",borderRadius:20}}>
                    {new Date(selDay+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"})}
                  </span>}
                </div>

                {!selDay?(
                  <div style={{textAlign:"center",padding:"20px 0",color:"#94a3b8"}}>
                    <div style={{fontSize:24,marginBottom:6}}>👈</div>
                    <div style={{fontSize:12}}>Selecciona un día en el calendario</div>
                  </div>
                ):(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      <div>
                        <label style={lbl}>📅 Entrada</label>
                        <div style={{...inp,background:"#6366f108",border:"1.5px solid #6366f133",color:"#6366f1",fontWeight:700,fontSize:12,padding:"8px 10px",borderRadius:8}}>
                          {new Date(selDay+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>🕐 Hora entrada</label>
                        <select value={ciTime} onChange={e=>setCiTime(e.target.value)} style={{...inp}}>
                          {timeOpts.map(t=><option key={t} value={t}>{fmtTime(t)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>📅 Salida</label>
                        <input type="date" value={coDate} onChange={e=>setCoDate(e.target.value)} style={{...inp}}/>
                      </div>
                      <div>
                        <label style={lbl}>🕐 Hora salida</label>
                        <select value={coTime} onChange={e=>setCoTime(e.target.value)} style={{...inp}}>
                          {timeOpts.map(t=><option key={t} value={t}>{fmtTime(t)}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={search} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:.3}}>
                      Buscar habitaciones →
                    </button>
                  </>
                )}
              </div>

              {/* Results */}
              {searched&&(
                <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",gap:8,minHeight:0,paddingBottom:4}}>
                  {avail?.length===0?(
                    <div style={{background:"#fff",borderRadius:12,padding:"20px 16px",textAlign:"center",color:"#94a3b8"}}>
                      <div style={{fontSize:24,marginBottom:6}}>😔</div>
                      <div style={{fontSize:12,fontWeight:600}}>Sin habitaciones disponibles</div>
                      <div style={{fontSize:11,marginTop:3}}>Prueba otro horario</div>
                    </div>
                  ):avail?.map(room=>{
                    const c=clr(room.room_type_id);
                    return(
                      <div key={room.id} onClick={()=>openRes(room)}
                        style={{background:"#fff",borderRadius:10,padding:"11px 13px",cursor:"pointer",border:`1.5px solid ${c}22`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0,transition:"all .2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=c;e.currentTarget.style.background=c+"08";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=c+"22";e.currentTarget.style.background="#fff";}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:34,height:34,borderRadius:8,background:c+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:c,flexShrink:0}}>#{room.room_number}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:"#0f172a"}}>{room.room_types?.name||"Sin tipo"}</div>
                            <div style={{fontSize:10,color:"#94a3b8"}}>{room.floor?`Piso ${room.floor} · `:""}{room.room_types?.capacity||2} personas</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:800,color:c}}>${parseFloat(room.room_types?.base_price||0).toLocaleString("es-MX")}</div>
                          <div style={{fontSize:9,color:"#94a3b8"}}>por noche</div>
                        </div>
                      </div>
                    );
                  })}
                  {avail&&avail.length>0&&<div style={{fontSize:10,color:"#94a3b8",textAlign:"center",flexShrink:0}}>✓ {avail.length} disponible{avail.length!==1?"s":""}</div>}
                </div>
              )}

              {/* Placeholder when not searched */}
              {!searched&&selDay&&(
                <div style={{flex:1,background:"#fff",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:"#94a3b8"}}>
                  <div style={{fontSize:28}}>🛏</div>
                  <div style={{fontSize:12,fontWeight:600}}>Presiona "Buscar habitaciones"</div>
                  <div style={{fontSize:11}}>para ver disponibilidad</div>
                </div>
              )}

              {!selDay&&(
                <div style={{flex:1,background:"#fff",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"#94a3b8"}}>
                  <div style={{fontSize:36}}>📅</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#64748b"}}>Selecciona un día</div>
                  <div style={{fontSize:11,textAlign:"center",maxWidth:180}}>Haz clic en cualquier día del calendario para buscar disponibilidad</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROOMS TAB */}
        {tab==="rooms"&&(
          <div style={{flex:1,overflow:"auto",padding:12}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
              {rooms.map(room=>{
                const c=clr(room.room_type_id);
                const tr=reservations.find(r=>r.room_id===room.id&&r.check_in<=todayStr&&r.check_out>todayStr&&r.status!=="cancelled");
                const occ=!!tr;
                return(
                  <div key={room.id} style={{background:"#fff",borderRadius:12,padding:"14px",border:`1.5px solid ${c}22`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:800}}>#{room.room_number}</div>
                        <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{room.room_types?.name||"Sin tipo"}</div>
                      </div>
                      <div style={{background:occ?"#fee2e2":"#dcfce7",color:occ?"#dc2626":"#16a34a",padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:700}}>
                        {occ?(tr.status==="checked_in"?"Ocupada":"Reservada"):"Libre"}
                      </div>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:c}}>${parseFloat(room.room_types?.base_price||0).toLocaleString("es-MX")}<span style={{fontSize:10,fontWeight:400,color:"#94a3b8"}}>/noche</span></div>
                    {tr&&<div style={{fontSize:10,color:"#64748b",padding:"5px 7px",background:"#f8fafc",borderRadius:6,marginTop:6}}>👤 {tr.guests?.full_name}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {tab==="res"&&(
          <div style={{flex:1,overflow:"auto",padding:12}}>
            {activeRes.length===0&&<div style={{textAlign:"center",padding:50,color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:10}}>📋</div>Sin reservaciones activas</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activeRes.sort((a,b)=>a.check_in.localeCompare(b.check_in)).map(r=>{
                const c=r.status==="confirmed"?"#6366f1":"#10b981";
                return(
                  <div key={r.id} style={{background:"#fff",borderRadius:10,padding:"12px 14px",border:`1.5px solid ${c}22`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{r.guests?.full_name||"Huésped"}</div>
                      <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Hab. #{r.rooms?.room_number} · {r.check_in} → {r.check_out}{r.total_price?` · $${parseFloat(r.total_price).toLocaleString("es-MX")}`:""}</div>
                      <span style={{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:c+"15",color:c}}>{r.status==="confirmed"?"Confirmada":"En hotel"}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {r.status==="confirmed"&&<button onClick={()=>doCI(r.id)} style={{padding:"6px 12px",background:"#dcfce7",color:"#16a34a",border:"none",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Check-in</button>}
                      {r.status==="checked_in"&&<button onClick={()=>doCO(r.id)} style={{padding:"6px 12px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Check-out</button>}
                      <button onClick={()=>cancelRes(r.id)} style={{padding:"6px 10px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* MODAL: Reservation */}
    {rModal&&selRoom&&(
      <div onClick={e=>e.target===e.currentTarget&&setRModal(false)}
        style={{position:"fixed",inset:0,background:"rgba(15,23,42,.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
        <div style={{background:"#fff",borderRadius:18,padding:"24px",width:"100%",maxWidth:400,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 32px 80px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:5}}>Nueva reservación</div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:16,padding:"9px 12px",background:"#f8fafc",borderRadius:8,lineHeight:1.7}}>
            🛏 #{selRoom.room_number} · {selRoom.room_types?.name}<br/>
            📅 {selDay} {fmtTime(form.check_in_time)} → {coDate} {fmtTime(form.check_out_time)}<br/>
            💰 ${parseFloat(selRoom.room_types?.base_price||0).toLocaleString("es-MX")}/noche
          </div>
          <label style={lbl}>Huésped existente</label>
          <select value={form.guest_id||""} onChange={e=>setForm(f=>({...f,guest_id:e.target.value,gname:""}))} style={{...inp}}>
            <option value="">Nuevo huésped...</option>
            {guests.map(g=><option key={g.id} value={g.id}>{g.full_name}</option>)}
          </select>
          {!form.guest_id&&<>
            <label style={{...lbl,marginTop:12}}>Nombre completo</label>
            <input placeholder="Ej: María García" value={form.gname||""} onChange={e=>setForm(f=>({...f,gname:e.target.value}))} style={{...inp}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
              <div><label style={lbl}>Teléfono</label><input placeholder="+52..." value={form.gphone||""} onChange={e=>setForm(f=>({...f,gphone:e.target.value}))} style={{...inp}}/></div>
              <div><label style={lbl}>Email</label><input type="email" value={form.gemail||""} onChange={e=>setForm(f=>({...f,gemail:e.target.value}))} style={{...inp}}/></div>
            </div>
          </>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <div><label style={lbl}>Hora check-in</label>
              <select value={form.check_in_time||"14:00"} onChange={e=>setForm(f=>({...f,check_in_time:e.target.value}))} style={{...inp}}>
                {timeOpts.map(t=><option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Hora check-out</label>
              <select value={form.check_out_time||"12:00"} onChange={e=>setForm(f=>({...f,check_out_time:e.target.value}))} style={{...inp}}>
                {timeOpts.map(t=><option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Adultos</label><input type="number" min={1} value={form.adults||1} onChange={e=>setForm(f=>({...f,adults:e.target.value}))} style={{...inp}}/></div>
            <div><label style={lbl}>Niños</label><input type="number" min={0} value={form.children||0} onChange={e=>setForm(f=>({...f,children:e.target.value}))} style={{...inp}}/></div>
            <div><label style={lbl}>Precio total ($)</label><input type="number" value={form.total_price||""} onChange={e=>setForm(f=>({...f,total_price:e.target.value}))} style={{...inp}}/></div>
            <div><label style={lbl}>Origen</label>
              <select value={form.source||"direct"} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{...inp}}>
                <option value="direct">Directo</option><option value="booking">Booking</option><option value="airbnb">Airbnb</option><option value="expedia">Expedia</option><option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:18}}>
            <button onClick={saveRes} disabled={saving} style={{flex:1,padding:"10px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              {saving?"Guardando...":"✓ Confirmar"}
            </button>
            <button onClick={()=>setRModal(false)} style={{padding:"10px 16px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL: Detail */}
    {detModal&&(
      <div onClick={e=>e.target===e.currentTarget&&setDetModal(null)}
        style={{position:"fixed",inset:0,background:"rgba(15,23,42,.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
        <div style={{background:"#fff",borderRadius:18,padding:"24px",width:"100%",maxWidth:380,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 32px 80px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:12}}>Reservación</div>
          <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:detModal.status==="confirmed"?"#6366f115":"#10b98115",color:detModal.status==="confirmed"?"#6366f1":"#10b981",marginBottom:14}}>
            {detModal.status==="confirmed"?"Confirmada":"En hotel"}
          </span>
          {[["Huésped",detModal.guests?.full_name],["Teléfono",detModal.guests?.phone],["Hab.",`#${detModal.rooms?.room_number}`],["Check-in",detModal.check_in+(detModal.check_in_datetime?" · "+new Date(detModal.check_in_datetime).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):"")],["Check-out",detModal.check_out+(detModal.check_out_datetime?" · "+new Date(detModal.check_out_datetime).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):"")],["Total",detModal.total_price?`$${parseFloat(detModal.total_price).toLocaleString("es-MX")}`:"—"]].filter(([,v])=>v).map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #f8fafc"}}>
              <span style={{fontSize:10,color:"#94a3b8",minWidth:70}}>{k}</span>
              <span style={{fontSize:12,color:"#0f172a",fontWeight:600}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:18,flexWrap:"wrap"}}>
            {detModal.status==="confirmed"&&<button onClick={()=>doCI(detModal.id)} style={{padding:"8px 14px",background:"#dcfce7",color:"#16a34a",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Check-in</button>}
            {detModal.status==="checked_in"&&<button onClick={()=>doCO(detModal.id)} style={{padding:"8px 14px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Check-out</button>}
            <button onClick={()=>cancelRes(detModal.id)} style={{padding:"8px 14px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancelar res.</button>
            <button onClick={()=>setDetModal(null)} style={{padding:"8px 12px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cerrar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL: Block */}
    {blkModal&&(
      <div onClick={e=>e.target===e.currentTarget&&setBlkModal(false)}
        style={{position:"fixed",inset:0,background:"rgba(15,23,42,.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}>
        <div style={{background:"#fff",borderRadius:18,padding:"24px",width:"100%",maxWidth:360,boxShadow:"0 32px 80px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>🔒 Bloquear fechas</div>
          <label style={lbl}>Habitación</label>
          <select value={blkForm.room_id||""} onChange={e=>setBlkForm(f=>({...f,room_id:e.target.value}))} style={{...inp}}>
            <option value="">Seleccionar...</option>
            {rooms.map(r=><option key={r.id} value={r.id}>#{r.room_number} — {r.room_types?.name||"Sin tipo"}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <div><label style={lbl}>Inicio</label><input type="date" value={blkForm.start_date||""} onChange={e=>setBlkForm(f=>({...f,start_date:e.target.value}))} style={{...inp}}/></div>
            <div><label style={lbl}>Fin</label><input type="date" value={blkForm.end_date||""} onChange={e=>setBlkForm(f=>({...f,end_date:e.target.value}))} style={{...inp}}/></div>
          </div>
          <label style={{...lbl,marginTop:12}}>Motivo</label>
          <select value={blkForm.reason||"maintenance"} onChange={e=>setBlkForm(f=>({...f,reason:e.target.value}))} style={{...inp}}>
            <option value="maintenance">Mantenimiento</option><option value="cleaning">Limpieza</option><option value="owner_use">Uso del propietario</option><option value="other">Otro</option>
          </select>
          <div style={{display:"flex",gap:8,marginTop:18}}>
            <button onClick={saveBlk} disabled={saving} style={{flex:1,padding:"10px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              {saving?"Guardando...":"Bloquear"}
            </button>
            <button onClick={()=>setBlkModal(false)} style={{padding:"10px 16px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}