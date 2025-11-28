import React, { useState, useEffect, useMemo } from 'react';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, addDoc, setDoc, deleteDoc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth, appId } from './lib/firebase';
import { useSystemData } from './hooks/useSystemData';
import { sendNotification, notifyGroup, addLog, APP_VERSION, DEPARTMENTS, getDepartmentLabel, VOUCHER_REASONS, MEMBER_CHANGE_TYPES, THEME_COLOR } from './lib/utils';
import { AlertCircle, CheckCircle2, Plus, Edit, Trash2 } from 'lucide-react';

import AuthView from './components/AuthView';
import Sidebar from './components/Sidebar';
import { Modal, ConfirmModal } from './components/UI';
import { DashboardView, ProjectsView, ProjectDetailsModal, MemberChangePanel, PointRequestPanel, VoucherPanel } from './components/MainViews';

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  const { projects, users, logs, schedules, pointRequests, voucherRequests, voucherPool, memberChangeRequests, notifications } = useSystemData(authUser, userProfile);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [modals, setModals] = useState({ project: false, schedule: false, point: false, voucher: false, user: false, inventory: false, memberChange: false, changelog: false });
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const isManagerOrAdmin = useMemo(() => userProfile?.role === 'admin' || userProfile?.role === 'manager', [userProfile]);
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (toast.show) { const t = setTimeout(() => setToast(p => ({ ...p, show: false })), 3000); return () => clearTimeout(t); }
  }, [toast.show]);

  useEffect(() => {
    const init = async () => {
      try { 
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) { console.warn("Auth fallback"); try { await signInAnonymously(auth); } catch(ae) {} }
    };
    init();
    return onAuthStateChanged(auth, (u) => { setAuthUser(u); if(!u) setUserProfile(null); });
  }, []);

  useEffect(() => {
      if (authUser && !authUser.isAnonymous) getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', authUser.uid)).then(s => s.exists() && setUserProfile(s.data()));
  }, [authUser]);

  const toggleModal = (key, val = true) => setModals(prev => ({ ...prev, [key]: val }));
  const requestConfirm = (title, message, onConfirm) => setConfirmDialog({ isOpen: true, title, message, onConfirm });
  const handleToast = (message, type='success') => setToast({ show: true, message, type });

  // --- Handlers ---
  const handleGenericAdd = async (coll, data, msg) => {
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', coll), { ...data, createdAt: serverTimestamp() }); handleToast(msg); return true; } 
      catch (e) { handleToast('操作失敗', 'error'); return false; }
  };

  const handleBroadcast = async (msg) => {
      await notifyGroup(users, () => true, 'system', `【公告】${msg}`);
      await addLog(userProfile, '系統廣播', msg);
      handleToast('公告已發送');
  };

  const handleProcessRequest = async (type, request, action) => {
      const isApprove = action === 'approved';
      const updates = { status: action, approvedBy: userProfile.displayName, completedAt: serverTimestamp() };
      
      if (type === 'voucher' && isApprove) {
          const code = voucherPool.find(v => !v.isUsed);
          if (!code) return handleToast('無庫存', 'error');
          updates.assignedCode = code.code;
          const batch = writeBatch(db);
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', request.id), updates);
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_pool', code.id), { isUsed: true, assignedToRequestId: request.id });
          await batch.commit();
      } else {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `${type}_requests`, request.id), updates);
      }
      
      const statusText = isApprove ? '已核准' : '已駁回';
      const detail = type === 'voucher' && isApprove ? `，券號：${updates.assignedCode}` : '';
      await sendNotification(request.requesterId, 'system', `您的${type === 'voucher' ? '電子券' : type === 'point' ? '補點' : '會員異動'}申請${statusText}${detail}`);
      handleToast(`已${statusText}`);
  };

  if (!userProfile) return <AuthView onLoginSuccess={setUserProfile} onToast={handleToast} usersCount={users.length} />;

  const myProjectCount = projects.filter(p => p.assignedToEmployeeId === userProfile.employeeId).length;

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap'); body { font-family: 'Noto Sans TC', sans-serif; } .bg-theme { background-color: ${THEME_COLOR}; } .text-theme { color: ${THEME_COLOR}; } .bg-theme-light { background-color: rgba(0, 113, 48, 0.08); } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 20px; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }`}</style>

      {isMobileMenu && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsMobileMenu(false)} />}
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} />
      
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={userProfile} notifications={notifications} markAsRead={markNotificationAsRead} onNotificationClick={(id)=>setSelectedProject(projects.find(p=>p.id===id))} isMobile={isMobileMenu} onCloseMobile={()=>setIsMobileMenu(false)} onLogout={async()=>{await signOut(auth); setUserProfile(null);}} onShowChangelog={()=>toggleModal('changelog')} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="lg:hidden bg-white border-b p-4 flex justify-between items-center z-10 shadow-sm sticky top-0">
          <div className="flex items-center gap-2"><div className="bg-theme text-white p-1.5 rounded-lg"><FolderKanban size={18} /></div><h1 className="font-bold text-gray-800"> HANDS PM</h1></div>
          <button onClick={() => setIsMobileMenu(true)} className="text-gray-600 p-1 bg-gray-100 rounded"><Menu size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView projects={projects} users={users} myCount={myProjectCount} isAdmin={isAdmin} schedules={schedules} logs={logs} openScheduleModal={()=>toggleModal('schedule')} deleteSchedule={(id)=>requestConfirm('刪除', '確定刪除？', async()=>{await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', id));handleToast('已刪除');})} onBroadcast={handleBroadcast} setBroadcastMsg={setBroadcastMsg} broadcastMsg={broadcastMsg} />}
            
            {activeTab === 'projects' && (
                <div className="space-y-8">
                    <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold border-l-4 border-theme pl-3">專案列表</h2>
                        <button onClick={()=>{setFormData({title:'', description:'', urgency:'normal', assignedTo:''}); toggleModal('project');}} className="flex items-center gap-2 bg-theme text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={20}/>新增專案</button>
                    </div>
                    <ProjectsView projects={projects} users={users} currentUser={userProfile} isAdmin={isAdmin} onSelect={setSelectedProject} onDelete={(id, t)=>requestConfirm('刪除', `確定刪除 ${t}？`, async()=>{await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));handleToast('已刪除');})} notifications={notifications} />
                </div>
            )}

            {activeTab === 'member_changes' && (
                <div>
                    <div className="flex justify-between mb-6 items-center"><h2 className="text-xl font-bold border-l-4 border-theme pl-3">會員資料異動</h2><button onClick={()=>{setFormData({cardId:'', changeType: MEMBER_CHANGE_TYPES[0], note:''}); toggleModal('memberChange');}} className="bg-theme text-white px-4 py-2.5 rounded-xl font-bold text-sm flex gap-2"><Plus size={18}/>新增</button></div>
                    <MemberChangePanel requests={memberChangeRequests} isAdmin={isAdmin} currentUser={userProfile} onProcess={(r,a)=>handleProcessRequest('member_change', r, a)} onDelete={(id)=>requestConfirm('撤銷','確定撤銷？',async()=>{await deleteDoc(doc(db,'artifacts',appId,'public','data','member_change_requests',id));handleToast('已撤銷');})} />
                </div>
            )}

            {activeTab === 'point_requests' && (
                <div>
                    <div className="flex justify-between mb-6 items-center"><h2 className="text-xl font-bold border-l-4 border-theme pl-3">點數補點申請</h2><button onClick={()=>{setFormData({memberIdentifier:'', points:''}); toggleModal('point');}} className="bg-theme text-white px-4 py-2.5 rounded-xl font-bold text-sm flex gap-2"><Plus size={18}/>申請</button></div>
                    <PointRequestPanel requests={pointRequests} isAdmin={isAdmin} currentUser={userProfile} onProcess={(r,a)=>handleProcessRequest('point', r, a)} onDelete={(id)=>requestConfirm('撤銷','確定撤銷？',async()=>{await deleteDoc(doc(db,'artifacts',appId,'public','data','point_requests',id));handleToast('已撤銷');})} />
                </div>
            )}

            {activeTab === 'voucher_requests' && (
                <div>
                    <div className="flex justify-between mb-6 items-center"><h2 className="text-xl font-bold border-l-4 border-theme pl-3">電子券申請</h2><div className="flex gap-2">{isAdmin && <button onClick={()=>toggleModal('inventory')} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-bold text-sm">庫存</button>}<button onClick={()=>{setFormData({reason:VOUCHER_REASONS[0]}); toggleModal('voucher');}} className="bg-theme text-white px-4 py-2.5 rounded-xl font-bold text-sm flex gap-2"><Plus size={18}/>申請</button></div></div>
                    <VoucherPanel requests={voucherRequests} pool={voucherPool} isAdmin={isAdmin} isManager={isManagerOrAdmin} currentUser={userProfile} onProcess={(r,a)=>handleProcessRequest('voucher', r, a)} onDelete={(id)=>requestConfirm('撤銷','確定撤銷？',async()=>{await deleteDoc(doc(db,'artifacts',appId,'public','data','voucher_requests',id));handleToast('已撤銷');})} onAddCodes={()=>toggleModal('inventory')} />
                </div>
            )}

            {activeTab === 'users' && isAdmin && (
               <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
                 <div className="flex justify-between mb-6 items-center"><h2 className="text-xl font-bold border-l-4 border-theme pl-3">用戶管理</h2><button onClick={()=>{setEditingUser(null); setFormData({displayName:'', employeeId:'', department:'企劃', role:'user', email:'', password: ''}); toggleModal('user');}} className="bg-theme text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"><Plus size={18}/>新增</button></div>
                 <div className="overflow-hidden rounded-2xl border border-gray-100"><table className="w-full text-sm text-left"><thead className="bg-gray-50/50 text-gray-500 font-bold border-b"><tr><th className="px-6 py-4">姓名</th><th className="px-6 py-4">編號</th><th className="px-6 py-4">部門</th><th className="px-6 py-4">角色</th><th className="px-6 py-4 text-right">操作</th></tr></thead><tbody className="divide-y">{users.map(u=><tr key={u.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold flex gap-2"><div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">{u.displayName[0]}</div>{u.displayName}</td><td className="px-6 py-4 font-mono">{u.employeeId}</td><td className="px-6 py-4">{getDepartmentLabel(u.department)}</td><td className="px-6 py-4">{u.role}</td><td className="px-6 py-4 text-right"><button onClick={()=>{setEditingUser(u); setFormData(u); toggleModal('user');}} className="p-2 text-gray-400 hover:text-theme"><Edit size={18}/></button><button onClick={()=>requestConfirm('刪除','確定刪除？',async()=>{await deleteDoc(doc(db,'artifacts',appId,'public','data','users_metadata',u.id));handleToast('已刪除');})} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18}/></button></td></tr>)}</tbody></table></div>
               </div>
            )}
          </div>
        </div>

        {/* --- Modals --- */}
        <Modal isOpen={modals.project} onClose={()=>toggleModal('project', false)} title="新增專案">
          <div className="space-y-4">
             <input className="w-full border rounded-xl p-3 outline-none focus:ring-2 ring-theme/50" placeholder="專案名稱" value={formData.title||''} onChange={e=>setFormData({...formData, title:e.target.value})} />
             <textarea className="w-full border rounded-xl p-3 outline-none focus:ring-2 ring-theme/50 h-32" placeholder="描述..." value={formData.description||''} onChange={e=>setFormData({...formData, description:e.target.value})} />
             <div className="grid grid-cols-2 gap-4">
               <select className="border rounded-xl p-3 outline-none" value={formData.assignedTo||''} onChange={e=>setFormData({...formData, assignedTo:e.target.value})}><option value="">指派給...</option>{users.map(u=><option key={u.id} value={u.employeeId}>{u.displayName}</option>)}</select>
               <select className="border rounded-xl p-3 outline-none" value={formData.urgency||'normal'} onChange={e=>setFormData({...formData, urgency:e.target.value})}><option value="normal">正常</option><option value="urgent">緊急</option><option value="very_urgent">非常緊急</option></select>
             </div>
             <button onClick={async()=>{
               if(!formData.assignedTo) return handleToast('請選擇負責人', 'error');
               const assignee = users.find(u=>u.employeeId===formData.assignedTo);
               const newProjectData = { ...formData, assignedToEmployeeId: formData.assignedTo, status:'active', assignedToName: assignee?.displayName||'未指派', createdBy:userProfile.employeeId, creatorName:userProfile.displayName };
               const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), { ...newProjectData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
               if(assignee) await sendNotification(assignee.uid, 'assignment', `${userProfile.displayName} 指派了新專案「${formData.title}」給您`, ref.id);
               handleToast('專案已建立'); toggleModal('project', false);
             }} className="w-full bg-theme text-white font-bold py-3 rounded-xl hover:bg-[#005a26] transition">建立專案</button>
          </div>
        </Modal>

        <Modal isOpen={modals.schedule} onClose={()=>toggleModal('schedule', false)} title="新增檔期">
          <div className="space-y-4">
             <input className="w-full border rounded-xl p-3 outline-none" placeholder="檔期名稱" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} />
             <div className="grid grid-cols-2 gap-4"><input type="date" className="border rounded-xl p-3" value={formData.startDate||''} onChange={e=>setFormData({...formData, startDate:e.target.value})} /><input type="date" className="border rounded-xl p-3" value={formData.endDate||''} onChange={e=>setFormData({...formData, endDate:e.target.value})} /></div>
             <button onClick={async()=>{ await handleGenericAdd('schedules', formData, '檔期已新增'); toggleModal('schedule', false); }} className="w-full bg-theme text-white font-bold py-3 rounded-xl hover:bg-[#005a26] transition">新增</button>
          </div>
        </Modal>

        <Modal isOpen={modals.memberChange} onClose={()=>toggleModal('memberChange', false)} title="會員資料異動">
           <div className="space-y-4">
             <input className="w-full border rounded-xl p-3 outline-none" placeholder="卡號" value={formData.cardId||''} onChange={e=>setFormData({...formData, cardId:e.target.value})} />
             <select className="w-full border rounded-xl p-3 outline-none" value={formData.changeType||''} onChange={e=>setFormData({...formData, changeType:e.target.value})}>{MEMBER_CHANGE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
             <textarea className="w-full border rounded-xl p-3 outline-none h-24" placeholder="備註..." value={formData.note||''} onChange={e=>setFormData({...formData, note:e.target.value})} />
             <button onClick={async()=>{ if(!formData.cardId) return handleToast('請輸入卡號','error'); await handleGenericAdd('member_change_requests', {...formData, requesterId:userProfile.employeeId, requesterName:userProfile.displayName, status:'pending'}, '已提交'); await notifyGroup(users, u=>u.role==='admin', 'system', `${userProfile.displayName} 提交了會員異動`); toggleModal('memberChange', false); }} className="w-full bg-theme text-white font-bold py-3 rounded-xl transition">提交</button>
           </div>
        </Modal>

        <Modal isOpen={modals.point} onClose={()=>toggleModal('point', false)} title="補點申請">
           <div className="space-y-4">
             <input className="w-full border rounded-xl p-3 outline-none" placeholder="會員帳號" value={formData.memberIdentifier||''} onChange={e=>setFormData({...formData, memberIdentifier:e.target.value})} />
             <input type="number" className="w-full border rounded-xl p-3 outline-none" placeholder="點數" value={formData.points||''} onChange={e=>setFormData({...formData, points:e.target.value})} />
             <button onClick={async()=>{ await handleGenericAdd('point_requests', {...formData, requesterId:userProfile.employeeId, requesterName:userProfile.displayName, status:'pending'}, '已提交'); await notifyGroup(users, u=>u.role==='admin', 'system', `${userProfile.displayName} 提交了補點申請`); toggleModal('point', false); }} className="w-full bg-theme text-white font-bold py-3 rounded-xl transition">提交</button>
           </div>
        </Modal>

        <Modal isOpen={modals.voucher} onClose={()=>toggleModal('voucher', false)} title="電子券申請">
           <div className="space-y-4">
             <select className="w-full border rounded-xl p-3 outline-none" value={formData.reason||''} onChange={e=>setFormData({...formData, reason:e.target.value})}>{VOUCHER_REASONS.map(r=><option key={r} value={r}>{r}</option>)}</select>
             <button onClick={async()=>{ await handleGenericAdd('voucher_requests', {reason:formData.reason, requesterId:userProfile.employeeId, requesterName:userProfile.displayName, department:userProfile.department, status:'pending'}, '已申請'); await notifyGroup(users, u=>u.role==='manager'||u.role==='admin', 'system', `${userProfile.displayName} 提交了電子券申請`); toggleModal('voucher', false); }} className="w-full bg-theme text-white font-bold py-3 rounded-xl transition">提交</button>
           </div>
        </Modal>

        <Modal isOpen={modals.inventory} onClose={()=>toggleModal('inventory', false)} title="庫存管理">
          <div className="space-y-4">
            <div className="flex gap-2"><input className="flex-1 border rounded-xl p-3 outline-none" placeholder="新增券號 (逗號分隔)" value={formData.codes||''} onChange={e=>setFormData({...formData, codes:e.target.value})} /><button onClick={async()=>{
                const codes = (formData.codes||'').split(',').map(c=>c.trim()).filter(c=>c);
                const exist = new Set(voucherPool.map(v=>v.code));
                const unique = codes.filter(c=>!exist.has(c));
                if(unique.length){ const b=writeBatch(db); unique.forEach(c=>b.set(doc(collection(db,'artifacts',appId,'public','data','voucher_pool')),{code:c,isUsed:false,createdAt:serverTimestamp()})); await b.commit(); handleToast(`新增 ${unique.length} 筆`); setFormData({...formData, codes:''}); }
            }} className="bg-theme text-white px-4 rounded-xl font-bold">新增</button></div>
            <div className="max-h-60 overflow-y-auto border rounded-xl custom-scrollbar"><table className="w-full text-left text-sm"><tbody className="divide-y">{voucherPool.map(v=><tr key={v.id}><td className="p-3 font-mono">{v.code}</td><td className="p-3 text-right">{v.isUsed?<span className="text-red-500 bg-red-50 px-2 rounded font-bold text-xs">已用</span>:<span className="text-emerald-600 bg-emerald-50 px-2 rounded font-bold text-xs">可用</span>}</td></tr>)}</tbody></table></div>
          </div>
        </Modal>

        <Modal isOpen={modals.user} onClose={()=>toggleModal('user', false)} title={editingUser?"編輯用戶":"新增用戶"}>
           <div className="space-y-4">
              <input className="w-full border rounded-xl p-3 outline-none" placeholder="姓名" value={formData.displayName||''} onChange={e=>setFormData({...formData, displayName:e.target.value})} />
              <input className={`w-full border rounded-xl p-3 outline-none ${editingUser?'bg-gray-100':''}`} placeholder="編號" readOnly={!!editingUser} value={formData.employeeId||''} onChange={e=>setFormData({...formData, employeeId:e.target.value})} />
              <input className="w-full border rounded-xl p-3 outline-none" type="password" placeholder={editingUser ? "重設密碼 (選填)" : "密碼 (6-12位)"} value={formData.password||''} onChange={e=>setFormData({...formData, password:e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="border rounded-xl p-3 outline-none" value={formData.department||''} onChange={e=>setFormData({...formData, department:e.target.value})}>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
                <select className="border rounded-xl p-3 outline-none" value={formData.role||'user'} onChange={e=>setFormData({...formData, role:e.target.value})}><option value="user">一般</option><option value="manager">主管</option><option value="admin">管理員</option></select>
              </div>
              <button onClick={async()=>{
                if(formData.password && (formData.password.length<6||formData.password.length>12)) return handleToast('密碼長度需 6-12','error');
                if(editingUser) { const up={...formData}; if(!up.password) delete up.password; await updateDoc(doc(db,'artifacts',appId,'public','data','users_metadata',editingUser.id),up); handleToast('已更新'); }
                else { if(!formData.password) return handleToast('請設定密碼','error'); const uid='user_'+Date.now(); await setDoc(doc(db,'artifacts',appId,'public','data','users_metadata',uid),{...formData, uid, isOnline:false}); handleToast('已建立'); }
                toggleModal('user', false);
              }} className="w-full bg-theme text-white font-bold py-3 rounded-xl transition">儲存</button>
           </div>
        </Modal>

        <Modal isOpen={modals.changelog} onClose={()=>toggleModal('changelog', false)} title="系統版本更新紀錄">
            <div className="space-y-6 pl-2">{CHANGELOGS.map((l,i)=><div key={i} className="relative pl-6 border-l-2 border-gray-100"><div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-[3px] border-theme"></div><div className="flex gap-2 mb-2"><span className="font-bold text-lg">{l.version}</span><span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{l.date}</span></div><ul className="list-disc ml-4 text-sm text-gray-600">{l.content.map((c,j)=><li key={j}>{c}</li>)}</ul></div>)}</div>
        </Modal>
        
        {selectedProject && <ProjectDetailsModal project={selectedProject} onClose={()=>setSelectedProject(null)} users={users} currentUser={userProfile} isAdmin={isAdmin} />}
        {toast.show && <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-2xl shadow-xl z-[10000] animate-fade-in flex items-center gap-3 font-bold ${toast.type==='error'?'bg-red-500':'bg-emerald-600'}`}>{toast.type==='error'?<AlertCircle size={24}/>:<CheckCircle2 size={24}/>}{toast.message}</div>}
      </main>
    </div>
  );
}
