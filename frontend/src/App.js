import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = "http://127.0.0.1:8000";
const SCORE_COLOR = { "5": "#22c55e", "4": "#86efac", "3": "#fbbf24", "2": "#f97316", "1": "#ef4444" };
const STAFF = ["Ahmet", "Fatma", "Mehmet", "Ayşe", "Yönetici"];

function fmt(d) { return new Date(d).toLocaleString("tr-TR"); }
function fmtShort(d) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); }
const TR_DAYS = { "Sun":"Paz", "Mon":"Pzt", "Tue":"Sal", "Wed":"Çar", "Thu":"Per", "Fri":"Cum", "Sat":"Cmt" };
function trDay(d) { return TR_DAYS[d] || d; }

function exportCSV(data, filename) {
  const rows = [["ID","Misafir","Oda","Puan","Yorum","Durum","Atanan","Tarih"],
    ...data.map(c => [c.id, c.guest?.name||"", c.guest?.room||"", c.score, (c.notes||"").replace(/,/g,";"), c.status, c.assigned_to||"", fmt(c.created_at)])];
  const blob = new Blob(["\uFEFF" + rows.map(r=>r.join(",")).join("\n")], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename+"_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1.1rem 1.25rem", flex:1, minWidth:120, borderTop:`3px solid ${color}` }}>
      <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", fontFamily:"monospace", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:300, color:"#111", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#9ca3af", marginTop:5 }}>{sub}</div>}
    </div>
  );
}

// ── Note Modal ─────────────────────────────────────────────
function NoteModal({ complaint, onClose, onSave }) {
  const [note, setNote]       = useState(complaint.notes || "");
  const [assigned, setAssigned] = useState(complaint.assigned_to || "");
  const [status, setStatus]   = useState(complaint.status);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:14, padding:"1.75rem", width:460, maxWidth:"95vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontWeight:600, fontSize:15 }}>Şikayet Detayı</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>{complaint.guest?.name} · Oda {complaint.guest?.room} · {complaint.score}★ · {fmt(complaint.created_at)}</div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", fontSize:18, cursor:"pointer", color:"#9ca3af", lineHeight:1 }}>×</button>
        </div>
        <label style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace", textTransform:"uppercase" }}>Not</label>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={4}
          style={{ width:"100%", marginTop:6, marginBottom:14, padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, fontFamily:"inherit", resize:"vertical", outline:"none" }}
          placeholder="Şikayet hakkında not ekle..." />
        <div style={{ display:"flex", gap:12, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace", textTransform:"uppercase" }}>Atanan Personel</label>
            <select value={assigned} onChange={e=>setAssigned(e.target.value)}
              style={{ width:"100%", marginTop:6, padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, outline:"none" }}>
              <option value="">Seç...</option>
              {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace", textTransform:"uppercase" }}>Durum</label>
            <select value={status} onChange={e=>setStatus(e.target.value)}
              style={{ width:"100%", marginTop:6, padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, outline:"none" }}>
              <option value="new">Yeni</option>
              <option value="in_progress">İşlemde</option>
              <option value="resolved">Çözüldü</option>
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 16px", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff", fontSize:13, cursor:"pointer" }}>İptal</button>
          <button onClick={()=>onSave({note,assigned,status})}
            style={{ padding:"8px 16px", border:"none", borderRadius:8, background:"#6366f1", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:500 }}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

// ── Complaint Row ──────────────────────────────────────────
function ComplaintRow({ c, onOpen }) {
  const sc = { new:"#ef4444", in_progress:"#f59e0b", resolved:"#22c55e" };
  const sl = { new:"Yeni", in_progress:"İşlemde", resolved:"Çözüldü" };
  return (
    <div onClick={()=>onOpen(c)} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 1.25rem", borderBottom:"1px solid #f3f4f6", cursor:"pointer", transition:"background 0.1s" }}
      onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
      <div style={{ width:34, height:34, borderRadius:8, flexShrink:0, background:(SCORE_COLOR[c.score]||"#ccc")+"20", color:SCORE_COLOR[c.score]||"#ccc", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, fontFamily:"monospace" }}>{c.score}★</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, color:"#111" }}>{c.guest?.name||"—"} · Oda {c.guest?.room||"—"}</div>
        <div style={{ fontSize:12, color:"#6b7280", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.notes||"Yorum bekleniyor..."}</div>
        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2, fontFamily:"monospace" }}>{fmt(c.created_at)}{c.assigned_to?` · ${c.assigned_to}`:""}</div>
      </div>
      <span style={{ fontSize:11, fontFamily:"monospace", padding:"3px 10px", borderRadius:10, background:(sc[c.status]||"#ccc")+"20", color:sc[c.status]||"#ccc", flexShrink:0 }}>{sl[c.status]||c.status}</span>
    </div>
  );
}

// ── Queue Item ─────────────────────────────────────────────
function QueueItem({ item }) {
  const initials = (item.guest?.name||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  const score = item.score;
  const bgColor = score>=4?"#dcfce7":score>=1?"#fef2f2":item.status==="sent"?"#eef2ff":"#fef9c3";
  const txColor = score>=4?"#16a34a":score>=1?"#ef4444":item.status==="sent"?"#6366f1":"#ca8a04";
  const label   = score?""+score+"★":item.status==="sent"?"Gönderildi":"Kuyrukta";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 1.25rem", borderBottom:"1px solid #f3f4f6" }}>
      <div style={{ width:30, height:30, borderRadius:"50%", background:"#eef2ff", color:"#6366f1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, flexShrink:0 }}>{initials}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.guest?.name||"—"}</div>
        <div style={{ fontSize:10, color:"#9ca3af", fontFamily:"monospace" }}>Oda {item.guest?.room_number||"—"}</div>
      </div>
      <span style={{ fontSize:10, fontFamily:"monospace", padding:"2px 7px", borderRadius:8, background:bgColor, color:txColor, flexShrink:0 }}>{label}</span>
    </div>
  );
}

// ── Happy Row ──────────────────────────────────────────────
function HappyRow({ item }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 1.25rem", borderBottom:"1px solid #f3f4f6" }}>
      <div style={{ width:34, height:34, borderRadius:8, flexShrink:0, background:"#dcfce7", color:"#16a34a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, fontFamily:"monospace" }}>{item.score}★</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, color:"#111" }}>{item.guest?.name||"—"} · Oda {item.guest?.room_number||"—"}</div>
        <div style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{item.guest?.phone||""}</div>
      </div>
      <span style={{ fontSize:11, fontFamily:"monospace", padding:"3px 10px", borderRadius:10, background:"#dcfce7", color:"#16a34a", flexShrink:0 }}>Google/TA gönderildi ✓</span>
    </div>
  );
}

// ── Ana App ────────────────────────────────────────────────
export default function App() {
  const [stats,setStats]           = useState(null);
  const [ratings,setRatings]       = useState([]);
  const [weekly,setWeekly]         = useState([]);
  const [complaints,setComplaints] = useState([]);
  const [queue,setQueue]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const [search,setSearch]         = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [scoreFilter,setScoreFilter]   = useState("all");
  const [dateFrom,setDateFrom]     = useState("");
  const [dateTo,setDateTo]         = useState("");
  const [selected,setSelected]     = useState(null);
  const [tab,setTab]               = useState("dashboard");
  const [showAllQueue,setShowAllQueue] = useState(false);
  const [lastUpdate,setLastUpdate] = useState(new Date());

  const fetchAll = async () => {
    try {
      const [s,r,w,c,q] = await Promise.all([
        axios.get(`${API}/api/dashboard/stats`),
        axios.get(`${API}/api/dashboard/rating-distribution`),
        axios.get(`${API}/api/dashboard/weekly`),
        axios.get(`${API}/api/dashboard/complaints?limit=200`),
        axios.get(`${API}/api/dashboard/queue`),
      ]);
      setStats(s.data);
      setRatings(Object.entries(r.data).map(([k,v])=>({star:k+"★",count:v,fill:SCORE_COLOR[k]})).reverse());
      setWeekly(w.data.map(d=>({...d, day: TR_DAYS[d.day]||d.day, label:"Gönderim"})));
      setComplaints(c.data);
      setQueue(q.data);
      setLastUpdate(new Date());
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  useEffect(()=>{fetchAll();const t=setInterval(fetchAll,30000);return()=>clearInterval(t);},[]);

  const saveComplaint = async ({note,assigned,status}) => {
    await axios.patch(`${API}/api/dashboard/complaints/${selected.id}`,{notes:note,assigned_to:assigned,status});
    setSelected(null); fetchAll();
  };

  const happyGuests = queue.filter(i=>i.score>=4);
  const openCount   = stats?.open_complaints??0;

  const filtered = complaints.filter(c => {
    const q = search.toLowerCase();
    const name  = (c.guest?.name||"").toLowerCase();
    const room  = (c.guest?.room||"");
    const notes = (c.notes||"").toLowerCase();
    return (!q||name.includes(q)||room.includes(q)||notes.includes(q))
      && (statusFilter==="all"||c.status===statusFilter)
      && (scoreFilter==="all"||String(c.score)===scoreFilter)
      && (!dateFrom||new Date(c.created_at)>=new Date(dateFrom))
      && (!dateTo||new Date(c.created_at)<=new Date(dateTo+"T23:59:59"));
  });

  const queueShown = showAllQueue ? queue : queue.slice(0,6);

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#9ca3af"}}>Yükleniyor...</div>;

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:"#f9fafb",minHeight:"100vh"}}>

      {/* Topbar */}
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"0 1.75rem",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"#6366f1",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏨</div>
          <span style={{fontWeight:600,fontSize:14}}>AS Otel Çeşme</span>
          <span style={{fontSize:12,color:"#9ca3af",fontFamily:"monospace",marginLeft:2}}>Anket Paneli</span>
        </div>
        <div style={{display:"flex",gap:2}}>
          {[
            {id:"dashboard",label:"Dashboard"},
            {id:"şikayetler",label:"Şikayetler",badge:openCount>0?openCount:null,badgeColor:"#ef4444"},
            {id:"memnunlar",label:"Memnunlar",badge:happyGuests.length>0?happyGuests.length:null,badgeColor:"#22c55e"},
            {id:"misafirler",label:"Misafirler"},
          ].map(({id,label,badge,badgeColor})=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{padding:"5px 14px",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",background:tab===id?"#eef2ff":"transparent",color:tab===id?"#6366f1":"#6b7280",fontWeight:tab===id?500:400,display:"flex",alignItems:"center",gap:5}}>
              {label}
              {badge && <span style={{background:badgeColor,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontFamily:"monospace"}}>{badge}</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 0 3px #bbf7d0"}}></div>
          <span style={{fontSize:11,color:"#22c55e",fontFamily:"monospace"}}>CANLI</span>
          <span style={{fontSize:11,color:"#d1d5db",fontFamily:"monospace",marginLeft:4}}>{fmtShort(lastUpdate)}</span>
        </div>
      </div>

      {/* ── DASHBOARD ── */}
      {tab==="dashboard" && (
        <div style={{padding:"1.5rem 1.75rem",display:"flex",flexDirection:"column",gap:"1.25rem"}}>

          {/* Stats */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <StatCard label="Bu Ay Gönderilen" value={stats?.sent_this_month??0} color="#6366f1" sub={`%${stats?.reply_rate??0} yanıt oranı`} />
            <StatCard label="Ortalama Puan"    value={`${stats?.avg_score??0}★`} color="#f59e0b" sub={`${stats?.reply_count??0} değerlendirme`} />
            <StatCard label="Açık Şikayet"     value={openCount} color="#ef4444" sub={openCount>0?"Yanıt bekliyor":"Harika! 🎉"} />
            <StatCard label="Memnun Misafir"   value={happyGuests.length} color="#22c55e" sub="Google/TA linki gönderildi" />
          </div>

          {/* Ana grid: sol(grafik+şikayet) | sağ(checkoutlar) */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:"1.25rem",alignItems:"start"}}>

            {/* Sol kolon */}
            <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>

              {/* Grafik satırı */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
                {/* Haftalık */}
                <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",fontSize:13,fontWeight:500}}>Haftalık Gönderim</div>
                  <div style={{padding:"1rem"}}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={weekly} barSize={28}>
                        <XAxis dataKey="day" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis hide/>
                        <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:"1px solid #e5e7eb"}} cursor={{fill:"#f3f4f6"}} formatter={(value)=>[value+" gönderim","Adet"]}/>
                        <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Puan dağılımı */}
                <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",fontSize:13,fontWeight:500}}>Puan Dağılımı</div>
                  <div style={{padding:"1.1rem 1.25rem"}}>
                    {ratings.map(r=>(
                      <div key={r.star} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <span style={{fontSize:11,fontFamily:"monospace",color:"#9ca3af",width:22,textAlign:"right"}}>{r.star}</span>
                        <div style={{flex:1,height:8,background:"#f3f4f6",borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min((r.count/Math.max(stats?.reply_count||1,1))*100,100)}%`,background:r.fill,borderRadius:4,transition:"width 0.5s"}}></div>
                        </div>
                        <span style={{fontSize:12,fontFamily:"monospace",color:"#6b7280",width:20,textAlign:"right"}}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Son şikayetler */}
              <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:500}}>Son Şikayetler</span>
                  <button onClick={()=>setTab("şikayetler")} style={{fontSize:11,color:"#6366f1",fontFamily:"monospace",background:"none",border:"none",cursor:"pointer"}}>tümünü gör →</button>
                </div>
                {complaints.filter(c=>c.status!=="resolved").slice(0,5).length===0
                  ?<div style={{padding:"2rem",textAlign:"center",color:"#9ca3af",fontSize:13}}>Açık şikayet yok 🎉</div>
                  :complaints.filter(c=>c.status!=="resolved").slice(0,5).map(c=><ComplaintRow key={c.id} c={c} onOpen={setSelected}/>)
                }
              </div>
            </div>

            {/* Sağ kolon: Check-outlar */}
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:500}}>Bugünkü Check-outlar</span>
                <span style={{fontSize:11,fontFamily:"monospace",color:"#9ca3af"}}>{queue.length} kişi</span>
              </div>
              {queue.length===0
                ?<div style={{padding:"2rem",textAlign:"center",color:"#9ca3af",fontSize:13}}>Henüz check-out yok</div>
                :<>
                  {queueShown.map(item=><QueueItem key={item.survey_id} item={item}/>)}
                  {queue.length>6 && (
                    <button onClick={()=>setShowAllQueue(!showAllQueue)}
                      style={{width:"100%",padding:"10px",border:"none",borderTop:"1px solid #f3f4f6",background:"#fafafa",fontSize:12,color:"#6366f1",cursor:"pointer",fontFamily:"monospace"}}>
                      {showAllQueue ? "▲ Daha az göster" : `▼ Tümünü gör (${queue.length-6} daha)`}
                    </button>
                  )}
                </>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── ŞİKAYETLER ── */}
      {tab==="şikayetler" && (
        <div style={{padding:"1.5rem 1.75rem",display:"flex",flexDirection:"column",gap:"1.25rem"}}>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"1rem 1.25rem"}}>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Misafir adı, oda, yorum ara..."
                style={{flex:1,minWidth:200,padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none"}}/>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
                style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none"}}>
                <option value="all">Tüm Durumlar</option>
                <option value="new">Yeni</option>
                <option value="in_progress">İşlemde</option>
                <option value="resolved">Çözüldü</option>
              </select>
              <select value={scoreFilter} onChange={e=>setScoreFilter(e.target.value)}
                style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none"}}>
                <option value="all">Tüm Puanlar</option>
                <option value="1">1★</option><option value="2">2★</option><option value="3">3★</option>
              </select>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none"}}/>
              <span style={{fontSize:12,color:"#9ca3af"}}>—</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none"}}/>
              <button onClick={()=>exportCSV(filtered,"sikayetler")}
                style={{padding:"7px 14px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,cursor:"pointer",background:"#fff",fontFamily:"monospace"}}>CSV ↓</button>
            </div>
            <div style={{marginTop:8,fontSize:11,color:"#9ca3af",fontFamily:"monospace"}}>{filtered.length} şikayet</div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            {filtered.length===0
              ?<div style={{padding:"3rem",textAlign:"center",color:"#9ca3af",fontSize:13}}>Şikayet bulunamadı 🎉</div>
              :filtered.map(c=><ComplaintRow key={c.id} c={c} onOpen={setSelected}/>)
            }
          </div>
        </div>
      )}

      {/* ── MEMNUNLAR ── */}
      {tab==="memnunlar" && (
        <div style={{padding:"1.5rem 1.75rem",display:"flex",flexDirection:"column",gap:"1.25rem"}}>
          <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:12,padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🎉</span>
            <div>
              <div style={{fontSize:14,fontWeight:500,color:"#15803d"}}>Memnun Misafirler</div>
              <div style={{fontSize:12,color:"#16a34a"}}>4-5 yıldız veren misafirlere Google Maps ve Tripadvisor linki otomatik gönderildi.</div>
            </div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:13,fontWeight:500}}>Bugün Memnun Olanlar</span>
              <span style={{fontSize:11,fontFamily:"monospace",color:"#16a34a"}}>{happyGuests.length} misafir</span>
            </div>
            {happyGuests.length===0
              ?<div style={{padding:"3rem",textAlign:"center",color:"#9ca3af",fontSize:13}}>Henüz 4-5 yıldız veren yok</div>
              :happyGuests.map(item=><HappyRow key={item.survey_id} item={item}/>)
            }
          </div>
        </div>
      )}

      {/* ── MİSAFİRLER ── */}
      {tab==="misafirler" && (
        <div style={{padding:"1.5rem 1.75rem"}}>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"1rem 1.25rem",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:500}}>Tüm Check-outlar</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ara..."
                style={{padding:"6px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,outline:"none",width:200}}/>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f9fafb"}}>
                  {["Misafir","Oda","Telefon","Puan","Durum","Saat"].map(h=>(
                    <th key={h} style={{padding:"8px 1rem",textAlign:"left",fontSize:11,color:"#9ca3af",fontFamily:"monospace",textTransform:"uppercase",borderBottom:"1px solid #f3f4f6"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.filter(item=>!search||(item.guest?.name||"").toLowerCase().includes(search.toLowerCase())).map(item=>(
                  <tr key={item.survey_id} style={{borderBottom:"1px solid #f9fafb"}}>
                    <td style={{padding:"10px 1rem",fontWeight:500}}>{item.guest?.name||"—"}</td>
                    <td style={{padding:"10px 1rem",fontFamily:"monospace",color:"#6b7280"}}>{item.guest?.room_number||"—"}</td>
                    <td style={{padding:"10px 1rem",fontFamily:"monospace",color:"#6b7280",fontSize:12}}>{item.guest?.phone||"—"}</td>
                    <td style={{padding:"10px 1rem"}}>
                      {item.score?<span style={{color:SCORE_COLOR[item.score]}}>{item.score}★</span>:<span style={{color:"#d1d5db"}}>—</span>}
                    </td>
                    <td style={{padding:"10px 1rem"}}>
                      <span style={{fontSize:11,fontFamily:"monospace",padding:"2px 8px",borderRadius:8,
                        background:item.score>=4?"#dcfce7":item.score>=1?"#fef2f2":item.status==="sent"?"#eef2ff":"#fef9c3",
                        color:item.score>=4?"#16a34a":item.score>=1?"#ef4444":item.status==="sent"?"#6366f1":"#ca8a04"}}>
                        {item.score>=4?"Memnun":item.score>=1?"Şikayet":item.status==="sent"?"Gönderildi":"Kuyrukta"}
                      </span>
                    </td>
                    <td style={{padding:"10px 1rem",fontSize:12,color:"#9ca3af",fontFamily:"monospace"}}>{item.guest?.checkout_at?fmtShort(item.guest.checkout_at):"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <NoteModal complaint={selected} onClose={()=>setSelected(null)} onSave={saveComplaint}/>}
    </div>
  );
}

