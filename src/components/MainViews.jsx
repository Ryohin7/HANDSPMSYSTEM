import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { formatTime, formatDate, getDaysDiff, getScheduleEmoji, sendNotification, getDepartmentLabel, addLog } from '../lib/utils';
import { CalendarClock, ArrowRight, Timer, FolderKanban, CheckCircle2, CalendarDays, Trash2, Clock, Grid, List, Plus, UserCircle, MessageSquare, Send, Megaphone, Edit, Undo2 } from 'lucide-react';
import { StatusBadge, UrgencyBadge, MobileRequestCard, Modal } from './UI';

// --- Dashboard View ---
export const DashboardView = ({ projects, users, myCount, isAdmin, schedules, logs, openScheduleModal, deleteSchedule, onBroadcast, setBroadcastMsg, broadcastMsg }) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const currentSchedule = schedules.find(s => { const start = new Date(s.startDate); const end = new Date(s.endDate); return today >= start && today <= end; });
  const nextSchedule = schedules.filter(s => new Date(s.startDate) > today).sort((a,b) => new Date(a.startDate) - new Date(b.startDate))[0];
  const activeScheduleName = currentSchedule ? currentSchedule.name : (nextSchedule ? nextSchedule.name : '');
  const scheduleEmoji = getScheduleEmoji(activeScheduleName);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-br from-[#0a2e18] to-[#14522d] rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden ring-1 ring-white/10 group">
            <div className="relative z-10 flex-1 text-white">
                <div className="flex items-center gap-2 mb-3 text-white/80 text-xs font-bold uppercase tracking-widest"><CalendarClock size={16} />HANDS 活動檔期</div>
                {currentSchedule ? (
                    <div>
                        <h2 className="text-4xl font-extrabold mb-2 tracking-tight drop-shadow-md text-white">{currentSchedule.name}</h2>
                        <p className="text-white/90 font-mono mb-6 text-sm flex items-center gap-2"><span className="bg-white/20 px-2 py-0.5 rounded">{currentSchedule.startDate}</span><ArrowRight size={12} className="text-white"/><span className="bg-white/20 px-2 py-0.5 rounded">{currentSchedule.endDate}</span></p>
                        <div className="inline-flex items-center gap-2 bg-white text-[#007130] px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-black/10 animate-pulse"><Timer size={18} />活動倒數 {getDaysDiff(currentSchedule.endDate)} 天</div>
                    </div>
                ) : (<div><h2 className="text-3xl font-bold mb-2 text-white/60">目前無進行中檔期</h2>{nextSchedule ? (<div className="mt-4 bg-white/10 rounded-2xl p-4 border border-white/20 inline-block backdrop-blur-sm"><p className="text-white font-bold flex items-center gap-2 text-sm mb-1"><ArrowRight size={16} className="text-white" />下檔預告：{nextSchedule.name}</p><p className="text-white font-bold text-lg">距離開檔還有 {getDaysDiff(nextSchedule.startDate)} 天</p></div>) : (<p className="text-white/50 text-sm mt-1 italic">尚無規劃未來檔期</p>)}</div>)}
            </div>
            <div className="absolute -right-8 -bottom-10 text-[10rem] opacity-20 rotate-12 select-none pointer-events-none filter drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6">{scheduleEmoji}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl shadow-sm border border-gray-100 transition-all hover:shadow-lg bg-theme-light">
                <div className="flex justify-between items-start"><div><p className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">總專案數</p><h3 className="text-4xl font-black text-gray-800">{projects.length}</h3></div><div className="p-4 rounded-2xl bg-gray-50 text-theme"><FolderKanban size={28} /></div></div>
            </div>
            <div className="p-6 rounded-3xl shadow-sm border border-gray-100 transition-all hover:shadow-lg bg-gradient-to-br from-[#007130] to-[#005a26]">
                <div className="flex justify-between items-start"><div><p className="text-xs font-bold uppercase tracking-wider mb-2 text-emerald-100/60">指派給我</p><h3 className="text-4xl font-black text-white">{myCount}</h3></div><div className="p-4 rounded-2xl bg-white/20 backdrop-blur-md text-white"><CheckCircle2 size={28} /></div></div>
            </div>
        </div>

        {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2.5"><CalendarDays size={20} className="text-theme"/>活動檔期列表</h3><button onClick={openScheduleModal} className="text-xs bg-theme text-white px-4 py-2 rounded-xl font-bold hover:bg-[#005a26] transition-colors shadow-sm shadow-theme/20">管理檔期</button></div>
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-8 py-4">名稱</th><th className="px-8 py-4">區間</th><th className="px-8 py-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100">{schedules.length === 0 ? <tr><td colSpan="3" className="px-8 py-12 text-center text-gray-400">無資料</td></tr> : schedules.map(s => (<tr key={s.id} className="hover:bg-gray-50 transition-colors"><td className="px-8 py-4 font-bold text-gray-700">{s.name}</td><td className="px-8 py-4 font-mono text-gray-500">{s.startDate} ~ {s.endDate}</td><td className="px-8 py-4 text-right"><button onClick={() => deleteSchedule(s.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
            </div>
            <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col p-6 relative overflow-hidden group"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><Megaphone size={20} /></div><h3 className="font-bold text-gray-800">系統公告推播</h3></div><textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none h-24 mb-3" placeholder="輸入公告內容..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} /><button onClick={() => { onBroadcast(broadcastMsg); setBroadcastMsg(''); }} disabled={!broadcastMsg.trim()} className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"><Send size={16} /> 發送全員通知</button></div>
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[280px]"><div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2.5"><Clock size={20} className="text-gray-400"/>系統日誌 (異常)</h3></div><div className="overflow-y-auto flex-1 p-0 custom-scrollbar"><table className="w-full text-sm"><tbody className="divide-y divide-gray-100">{logs.slice(0, 10).map(l => (<tr key={l.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-3.5"><div className="flex justify-between text-xs mb-1.5 font-bold text-gray-700"><span>{l.userName}</span><span className="text-gray-400 font-medium font-mono">{formatTime(l.timestamp)}</span></div><p className={`text-xs truncate leading-relaxed ${(l.action.includes('異常') || l.action.includes('錯誤') || l.action.includes('失敗')) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>[{l.action}] {l.details}</p></td></tr>))}</tbody></table></div></div>
            </div>
        </div>
        )}
    </div>
  );
};

// --- Projects View ---
export const ProjectsView = ({ projects, users, currentUser, isAdmin, onAdd, onSelect, onDelete, notifications }) => {
  const [viewMode, setViewMode] = useState('grid');
  const activeStatuses = ['unassigned', 'active', 'transferred', 'pending'];
  const completedStatuses = ['completed', 'closed', 'approved', 'rejected'];
  const myActiveProjects = projects.filter(p => (p.assignedToEmployeeId === currentUser.employeeId || p.createdBy === currentUser.employeeId) && activeStatuses.includes(p.status));
  const otherActiveProjects = projects.filter(p => p.assignedToEmployeeId !== currentUser.employeeId && p.createdBy !== currentUser.employeeId && activeStatuses.includes(p.status));
  const completedProjects = projects.filter(p => completedStatuses.includes(p.status));

  const ProjectListSection = ({ list, title, isSimple = false }) => (
    <div className="mb-10 animate-fade-in">
      <h3 className="text-lg font-bold text-gray-700 mb-5 flex items-center gap-3 pl-1 border-l-4 border-theme">{title} <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-mono">{list.length}</span></h3>
      {list.length === 0 ? <div className="p-10 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">目前沒有相關專案</div> : 
       viewMode === 'grid' || isSimple ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {list.map(p => {
            const hasUnread = notifications.some(n => !n.read && n.linkProjectId === p.id);
            return (
            <div key={p.id} onClick={() => onSelect(p)} className={`bg-white rounded-2xl shadow-sm border cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group flex flex-col relative ${p.assignedToEmployeeId === currentUser.employeeId && !isSimple ? 'border-theme/30 ring-2 ring-theme/5' : 'border-gray-200'} ${isSimple ? 'opacity-80 hover:opacity-100' : ''}`}>
              {hasUnread && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm z-10 animate-pulse"></span>}
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4"><div className="flex flex-wrap gap-2"><StatusBadge status={p.status} />{!isSimple && <UrgencyBadge level={p.urgency} />}</div>{(isAdmin || p.createdBy === currentUser.employeeId) && <button onClick={(e)=>{e.stopPropagation(); onDelete(p.id, p.title);}} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>}</div>
                <h3 className={`font-bold text-gray-800 truncate mb-2 text-lg group-hover:text-theme transition-colors ${isSimple ? 'line-through decoration-gray-300 text-gray-500' : ''}`}>{p.title}</h3>
                {!isSimple && <p className="text-gray-500 text-sm line-clamp-2 h-10 mb-5 leading-relaxed">{p.description}</p>}
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-auto"><UserCircle size={16} className="text-gray-400"/><span className="font-bold truncate">{p.assignedToName}</span></div>
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left whitespace-nowrap text-sm"><thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-6 py-4">專案名稱</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4">負責人</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{list.map(p => (<tr key={p.id} onClick={() => onSelect(p)} className="hover:bg-gray-50 cursor-pointer transition-colors"><td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">{p.assignedToEmployeeId === currentUser.employeeId && <CheckCircle2 size={18} className="text-theme"/>}{p.title}{notifications.some(n => !n.read && n.linkProjectId === p.id) && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}</td><td className="px-6 py-4"><StatusBadge status={p.status}/></td><td className="px-6 py-4 text-gray-600 font-medium">{p.assignedToName}</td><td className="px-6 py-4 text-right">{(isAdmin || p.createdBy === currentUser.employeeId) && <button onClick={(e)=>{e.stopPropagation(); onDelete(p.id, p.title);}} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18}/></button>}</td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100"><h2 className="text-2xl font-bold text-gray-800 pl-3 border-l-[6px] border-theme">專案列表</h2><div className="flex gap-3"><div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50">{['grid', 'list'].map(m => <button key={m} onClick={()=>setViewMode(m)} className={`p-2.5 rounded-lg transition-all ${viewMode===m?'bg-white text-theme shadow-sm ring-1 ring-black/5':'text-gray-400 hover:text-gray-600'}`}>{m==='grid'?<Grid size={20}/>:<List size={20}/>}</button>)}</div><button onClick={onAdd} className="flex items-center gap-2 bg-theme text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={20}/>新增專案</button></div></div>
      <ProjectListSection list={myActiveProjects} title="我的專案 (進行中)" />
      <div className="border-t border-gray-200 my-8 opacity-50"></div>
      <ProjectListSection list={otherActiveProjects} title="其他專案 (進行中)" isSimple={true} />
      <div className="border-t border-gray-200 my-8 opacity-50"></div>
      <ProjectListSection list={completedProjects} title="已結束的專案" isSimple={true} />
    </div>
  );
};

export const ProjectDetailsModal = ({ project, onClose, users, currentUser, isAdmin }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!project) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [project]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments]);

  const handleAddSystemComment = async (text) => await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), { text, type: 'system', createdAt: serverTimestamp() });

  const updateProject = async (updates, message) => {
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id), updates);
          if (message) await handleAddSystemComment(message);
          if (updates.assignedToEmployeeId && updates.assignedToEmployeeId !== project.assignedToEmployeeId) {
              const assignedUser = users.find(u => u.employeeId === updates.assignedToEmployeeId);
              if (assignedUser) await sendNotification(assignedUser.uid, 'assignment', `${currentUser.displayName} 將專案「${project.title}」指派給了您`, project.id);
          }
           if (updates.status && project.createdBy !== currentUser.employeeId) {
            const creator = users.find(u => u.employeeId === project.createdBy);
            if (creator) await sendNotification(creator.uid, 'system', `您的專案「${project.title}」狀態已更新為：${updates.status}`, project.id);
        }
      } catch (e) { console.error(e); }
  };

  const handleSendComment = async (e) => {
      e.preventDefault();
      if (!newComment.trim()) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), { text: newComment, userId: currentUser.employeeId, userName: currentUser.displayName, type: 'user', createdAt: serverTimestamp() });
      const targets = [];
      if (project.assignedToEmployeeId && project.assignedToEmployeeId !== currentUser.employeeId) targets.push(users.find(u => u.employeeId === project.assignedToEmployeeId));
      if (project.createdBy && project.createdBy !== currentUser.employeeId) targets.push(users.find(u => u.employeeId === project.createdBy));
      [...new Set(targets.filter(Boolean))].forEach(async (u) => await sendNotification(u.uid, 'comment', `${currentUser.displayName} 在專案「${project.title}」發表了留言`, project.id));
      setNewComment('');
  };

  return (
    <Modal isOpen={!!project} onClose={onClose} title="專案詳情" maxWidth="max-w-5xl">
       <div className="flex flex-col lg:flex-row gap-8 lg:h-[650px] overflow-hidden">
         <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
           <div className="flex justify-between items-start">
             <div><div className="flex gap-2 mb-3"><StatusBadge status={project.status}/><UrgencyBadge level={project.urgency}/></div><h2 className="text-3xl font-extrabold mb-1 text-gray-800 leading-tight">{project.title}</h2></div>
             <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 flex items-center gap-1"><UserCircle size={14}/>建立者: {project.creatorName}</div>
           </div>
           <div className="bg-white border border-gray-100 p-6 rounded-2xl min-h-[120px] whitespace-pre-wrap text-gray-600 shadow-sm leading-relaxed text-sm">{project.description}</div>
           <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100 space-y-5">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider"><Edit size={16}/> 專案管理面板</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">狀態</label><select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all" value={project.status} onChange={(e)=>updateProject({status:e.target.value}, `將狀態更改為: ${e.target.options[e.target.selectedIndex].text}`)}><option value="active">進行中</option><option value="transferred">轉交給他人</option><option value="completed">已完成</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">緊急度</label><select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all" value={project.urgency} onChange={(e)=>updateProject({urgency:e.target.value}, `將緊急度更改為: ${e.target.options[e.target.selectedIndex].text}`)}><option value="normal">正常</option><option value="urgent">緊急</option><option value="very_urgent">非常緊急</option></select></div>
              </div>
              <div><label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">指派負責人</label><select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all" value={project.assignedToEmployeeId || ''} onChange={(e) => { const newId = e.target.value; const newUser = users.find(u => u.employeeId === newId); const newName = newUser ? newUser.displayName : '未指派'; updateProject({ assignedToEmployeeId: newId, assignedToName: newName }, `將負責人更改為: ${newName}`); }}><option value="">未指派</option>{users.map(u => (<option key={u.id} value={u.employeeId}>{u.displayName} ({getDepartmentLabel(u.department)})</option>))}</select></div>
           </div>
         </div>
         <div className="w-full lg:w-[400px] bg-gray-50 border border-gray-200 rounded-2xl flex flex-col overflow-hidden h-[400px] lg:h-auto shadow-inner mt-4 lg:mt-0">
            <div className="p-4 bg-white border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2"><MessageSquare size={18}/> 專案討論 ({comments.length})</div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {comments.map(c => (c.type === 'system' ? (<div key={c.id} className="flex items-center gap-3 my-3 opacity-80"><div className="h-px bg-gray-200 flex-1"></div><span className="text-[10px] text-gray-500 font-medium bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm">{c.text} • {formatTime(c.createdAt)}</span><div className="h-px bg-gray-200 flex-1"></div></div>) : (<div key={c.id} className="flex gap-3 items-start group"><div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 shadow-sm mt-1">{c.userName?.[0]}</div><div className="flex-1 min-w-0"><div className="flex justify-between items-baseline mb-1"><span className="text-xs font-bold text-gray-700">{c.userName}</span><span className="text-[10px] text-gray-400 font-mono">{formatTime(c.createdAt)}</span></div><div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 text-sm text-gray-800 shadow-sm break-words leading-relaxed group-hover:shadow-md transition-shadow">{c.text}</div></div></div>)))}<div ref={commentsEndRef}></div>
            </div>
            <div className="p-4 bg-white border-t border-gray-200"><form onSubmit={handleSendComment} className="relative"><input className="w-full border border-gray-300 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-theme focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-all" placeholder="輸入留言..." value={newComment} onChange={(e) => setNewComment(e.target.value)} /><button type="submit" disabled={!newComment.trim()} className="absolute right-2 top-2 p-1.5 text-theme disabled:text-gray-300 hover:bg-theme-light rounded-lg transition-colors"><Send size={18}/></button></form></div>
         </div>
       </div>
    </Modal>
  );
};

// --- Request Panels (Member, Point, Voucher) ---
export const MemberChangePanel = ({ requests, isAdmin, currentUser, onProcess, onDelete }) => (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 animate-fade-in">
        <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b"><tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">申請人</th><th className="px-6 py-4">卡號</th><th className="px-6 py-4">內容</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y">{requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-mono text-gray-500">{formatDate(r.createdAt)}</td><td className="px-6 py-4 font-bold">{r.requesterName}</td><td className="px-6 py-4 font-mono">{r.cardId}</td><td className="px-6 py-4 max-w-xs truncate">{r.changeType}: {r.note}</td><td className="px-6 py-4"><StatusBadge status={r.status}/></td>
                    <td className="px-6 py-4 text-right">
                        {isAdmin && r.status === 'pending' && <button onClick={() => onProcess(r, 'approved')} className="text-theme font-bold hover:bg-theme-light px-3 py-1.5 rounded-lg text-xs border border-theme/20 mr-2">已處理</button>}
                        {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1.5"><Undo2 size={16}/></button>}
                    </td></tr>
                ))}</tbody>
            </table>
        </div>
        <div className="md:hidden space-y-3">{requests.map(r => (
            <MobileRequestCard key={r.id} title={r.changeType} status={r.status} meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                actions={<>{isAdmin && r.status === 'pending' && <button onClick={() => onProcess(r, 'approved')} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">已處理</button>}
                {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}</>}>
                <div className="flex justify-between mb-1"><span className="text-gray-400">卡號</span><span className="font-mono font-bold text-gray-800">{r.cardId}</span></div><div className="text-right text-gray-800">{r.note}</div>
            </MobileRequestCard>
        ))}</div>
    </div>
);

export const PointRequestPanel = ({ requests, isAdmin, currentUser, onProcess, onDelete }) => (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 animate-fade-in">
        <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b"><tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">申請人</th><th className="px-6 py-4">會員</th><th className="px-6 py-4">點數</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y">{requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-mono text-gray-500">{formatDate(r.createdAt)}</td><td className="px-6 py-4 font-bold">{r.requesterName}</td><td className="px-6 py-4 font-mono">{r.memberIdentifier}</td><td className="px-6 py-4 font-bold text-theme">{r.points}</td><td className="px-6 py-4"><StatusBadge status={r.status}/></td>
                    <td className="px-6 py-4 text-right">
                        {isAdmin && r.status === 'pending' && <button onClick={() => onProcess(r, 'approved')} className="text-theme font-bold hover:bg-theme-light px-3 py-1.5 rounded-lg text-xs border border-theme/20 mr-2">核准</button>}
                        {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1.5"><Undo2 size={16}/></button>}
                    </td></tr>
                ))}</tbody>
            </table>
        </div>
        <div className="md:hidden space-y-3">{requests.map(r => (
            <MobileRequestCard key={r.id} title={`${r.points} 點`} status={r.status} meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                actions={<>{isAdmin && r.status === 'pending' && <button onClick={() => onProcess(r, 'approved')} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">核准</button>}
                {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}</>}>
                <div className="flex justify-between"><span className="text-gray-400">會員帳號</span><span className="font-mono font-bold text-gray-800">{r.memberIdentifier}</span></div>
            </MobileRequestCard>
        ))}</div>
    </div>
);

export const VoucherPanel = ({ requests, pool, isAdmin, isManager, currentUser, onProcess, onDelete, onAddCodes }) => (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold border-l-4 border-theme pl-3">電子券申請</h2>
            {isAdmin && <button onClick={onAddCodes} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold">庫存 ({pool.filter(v=>!v.isUsed).length})</button>}
        </div>
        <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b"><tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">申請人</th><th className="px-6 py-4">原因</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4">券號</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y">{requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-mono text-gray-500">{formatDate(r.createdAt)}</td><td className="px-6 py-4 font-bold">{r.requesterName}</td><td className="px-6 py-4">{r.reason}</td><td className="px-6 py-4"><StatusBadge status={r.status}/></td><td className="px-6 py-4 font-mono font-bold text-theme">{r.assignedCode||'-'}</td>
                    <td className="px-6 py-4 text-right">
                        {(isManager || isAdmin) && r.status==='pending' && (
                            <div className="flex justify-end gap-2">
                                <button onClick={() => onProcess(r, 'approved')} className="text-white bg-theme hover:bg-[#005a26] px-3 py-1.5 rounded-lg text-xs font-bold">核准</button>
                                <button onClick={() => onProcess(r, 'rejected')} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200">駁回</button>
                            </div>
                        )}
                        {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1.5"><Undo2 size={16}/></button>}
                    </td></tr>
                ))}</tbody>
            </table>
        </div>
        <div className="md:hidden space-y-3">{requests.map(r => (
            <MobileRequestCard key={r.id} title={r.reason} status={r.status} meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                actions={<>{(isManager||isAdmin) && r.status === 'pending' && <div className="flex gap-2 w-full"><button onClick={() => onProcess(r, 'approved')} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">核准</button><button onClick={() => onProcess(r, 'rejected')} className="flex-1 bg-red-50 text-red-600 border border-red-100 py-2 rounded-lg text-sm font-bold">駁回</button></div>}
                {r.requesterId === currentUser.employeeId && r.status === 'pending' && <button onClick={() => onDelete(r.id)} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}</>}>
                <div className="flex justify-between"><span className="text-gray-400">配發券號</span><span className="font-mono font-bold text-theme text-lg">{r.assignedCode || '待分配'}</span></div>
            </MobileRequestCard>
        ))}</div>
    </div>
);
