import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  setDoc, serverTimestamp, writeBatch, query, orderBy, getDoc, getDocs
} from 'firebase/firestore';
import { 
  LayoutDashboard, FolderKanban, Users, Plus, Trash2, Activity, Shield, Clock,
  Menu, X, MessageSquare, UserCircle, Hash, Mail, CalendarClock, Send, LogIn,
  CheckCircle2, AlertCircle, Grid, List, Edit, ArrowRight, Briefcase, Bell,
  CalendarDays, Zap, AlertTriangle, Flame, Gift, CheckSquare, Ticket, UserCheck, BriefcaseBusiness,
  Lock, KeyRound, Timer, UserCog, LogOut, FileText, Info, Archive, Undo2, ArrowRightLeft, UserPlus, ChevronRight, BellRing, Megaphone, Database, Eraser
} from 'lucide-react';

// ==========================================
// --- Module: Configuration & Constants ---
// ==========================================

const APP_VERSION = '2.5.0'; // 修正：只顯示數字版本號
const THEME_COLOR = '#007130';
const DEPARTMENTS = ['企劃', '設計', '採購', '營業', '資訊', '營運'];
const VOUCHER_REASONS = ['活動結束退換貨補券', '客訴或個案','其他'];
const MEMBER_CHANGE_TYPES = ['變更手機號碼', '變更生日', '刪除會員','其他'];
const DEPARTMENT_ICONS = { '企劃': '📝', '設計': '🎨', '採購': '🛍️', '營業': '🏪', '資訊': '💻', '營運': '⚙️' };

const CHANGELOGS = [
    { version: '2.5.0', date: '2025-06-11', content: ['新增管理員「系統維護」功能：可清除日誌與通知', '儀表板新增「公告發布」面板', '通知中心介面優化', 'Log 視窗新增資料庫狀態監控'] },
    { version: '2.4.0', date: '2025-06-10', content: ['系統模組化架構重構', '通知中心介面優化 (移除異動標籤)', '新增儀表板公告發布功能', '新增資料庫狀態監控面板'] },
    { version: '2.3.0', date: '2025-06-09', content: ['介面與效能優化', '簡化版本號顯示'] },
];

// Firebase Init
const firebaseConfig = {
  apiKey: "AIzaSyC6AOjDsuIbSjTMVqvVDTCu8gO_FTz9jrM",
  authDomain: "handspmsystem.firebaseapp.com",
  projectId: "handspmsystem",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==========================================
// --- Module: Utils & Helpers ---
// ==========================================

const formatTime = (ts) => !ts ? '剛剛' : new Date(ts.toDate?.() || ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDate = (ts) => !ts ? '...' : new Date(ts.toDate?.() || ts).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
const getDepartmentLabel = (dept) => `${DEPARTMENT_ICONS[dept] || '🏢'} ${dept}`;
const getDaysDiff = (target) => Math.ceil((new Date(new Date(target).setHours(0,0,0,0)) - new Date(new Date().setHours(0,0,0,0))) / (86400000));
const getScheduleEmoji = (n) => {
    if (!n) return '📅';
    if (n.includes('春')||n.includes('年')) return '🧧'; if (n.includes('母')) return '🌹'; if (n.includes('父')) return '👔';
    if (n.includes('聖誕')) return '🎄'; if (n.includes('夏')) return '☀️'; if (n.includes('購')) return '🛍️'; return '📅';
};

const sendNotification = async (targetUid, type, message, linkId = null) => {
    if (!targetUid) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), { targetUserId: targetUid, type, message, linkProjectId: linkId, read: false, createdAt: serverTimestamp() }); } catch (e) { console.error(e); }
};
const notifyGroup = async (users, roleFilter, type, message) => {
    users.filter(roleFilter).forEach(u => sendNotification(u.uid, type, message));
};
const addLog = async (u, action, details) => {
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), { action, details, userId: u?.uid||'sys', userName: u?.displayName||'System', timestamp: serverTimestamp() }); } catch(e) {}
};

// ==========================================
// --- Module: Custom Hooks ---
// ==========================================

const useSystemData = (authUser, userProfile) => {
  const [data, setData] = useState({ projects: [], users: [], logs: [], notifications: [], schedules: [], announcements: [], pointRequests: [], voucherRequests: [], voucherPool: [], memberChangeRequests: [] });
  
  useEffect(() => {
    if (!authUser) return;
    const isPrivileged = userProfile?.role === 'admin' || userProfile?.role === 'manager';
    const personalFilter = (d) => isPrivileged ? true : d.requesterId === userProfile?.employeeId;

    const definitions = [
      { key: 'users', path: 'users_metadata' },
      { key: 'projects', path: 'projects', sort: 'updatedAt' },
      { key: 'logs', path: 'logs', sort: 'timestamp' },
      { key: 'schedules', path: 'schedules', sort: 'startDate', isDate: true },
      { key: 'announcements', path: 'announcements', sort: 'createdAt' },
      { key: 'voucherPool', path: 'voucher_pool' },
      { key: 'notifications', path: 'notifications', sort: 'createdAt', filter: (d) => userProfile && d.targetUserId === userProfile.uid },
      { key: 'pointRequests', path: 'point_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'voucherRequests', path: 'voucher_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'memberChangeRequests', path: 'member_change_requests', sort: 'createdAt', filter: personalFilter },
    ];

    const unsubs = definitions.map(({ key, path, sort, isDate, filter }) => 
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', path), (snap) => {
        // Web Push Logic
        if (key === 'notifications') {
            snap.docChanges().forEach((c) => {
                if (c.type === 'added') {
                    const d = c.doc.data();
                    const isRecent = (Date.now() - (d.createdAt?.toMillis?.() || Date.now())) < 10000;
                    if (userProfile && d.targetUserId === userProfile.uid && isRecent && Notification.permission === 'granted') {
                        try { new Notification('Hands PM', { body: d.message, icon: '/vite.svg', tag: c.doc.id }); } catch(e){}
                    }
                }
            });
        }
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (filter) items = items.filter(filter);
        if (sort) items.sort((a, b) => { const vA = a[sort], vB = b[sort]; return isDate ? new Date(vA)-new Date(vB) : (vB?.toMillis?.()||0)-(vA?.toMillis?.()||0); });
        setData(p => ({ ...p, [key]: items }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [authUser, userProfile]);
  return data;
};

// ==========================================
// --- Module: UI Components ---
// ==========================================

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] border border-white/20`}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm shrink-0 rounded-t-3xl">
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors rounded-full p-1.5"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 transform transition-all scale-100">
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0"><AlertTriangle size={20} /></div><h3 className="text-lg font-bold text-gray-800">{title}</h3></div>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed pl-1">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm">取消</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-md shadow-red-200 transition-all text-sm flex items-center gap-2"><Trash2 size={16} /> 確認執行</button>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = { active: ['bg-green-50 text-[#007130]', '進行中'], transferred: ['bg-blue-50 text-blue-600', '轉交給他人'], completed: ['bg-gray-100 text-gray-500', '已完成'], unassigned: ['bg-slate-100 text-slate-600', '待分配'], pending: ['bg-orange-50 text-orange-600', '待核准'], closed: ['bg-gray-100 text-gray-500', '已結案'], approved: ['bg-theme-light text-theme', '已核准'], rejected: ['bg-red-50 text-red-600', '已駁回'] };
  const [cls, label] = map[status] || map.unassigned;
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border border-black/5 ${cls} whitespace-nowrap`}>{label}</span>;
};

const UrgencyBadge = ({ level }) => {
  if (!level || level === 'normal') return null;
  const isVery = level === 'very_urgent';
  return <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm border whitespace-nowrap ${isVery ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>{isVery ? <Flame size={10} fill="currentColor"/> : <Zap size={10} fill="currentColor"/>}{isVery ? '非常緊急' : '緊急'}</span>;
};

const MobileRequestCard = ({ title, status, meta, actions, children }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex justify-between items-start"><div><h4 className="font-bold text-gray-800 text-lg mb-1">{title}</h4><div className="text-xs text-gray-400 font-mono">{meta}</div></div><StatusBadge status={status} /></div>
        <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 border border-gray-50/50">{children}</div>
        {actions && <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-1">{actions}</div>}
    </div>
);

// ==========================================
// --- Module: Views (Components) ---
// ==========================================

const AuthView = ({ onLoginSuccess, onToast, usersCount }) => {
    const [mode, setMode] = useState('login');
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerData, setRegisterData] = useState({ name: '', employeeId: '', email: '', department: '企劃', password: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        const cleanId = loginId.trim(); const cleanPwd = loginPassword.trim();
        if(!cleanId || !cleanPwd) return onToast('請輸入完整帳號密碼', 'error');
        try {
            const uc = await signInWithEmailAndPassword(auth, `${cleanId}@hands.com`, cleanPwd);
            const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', uc.user.uid));
            if (snap.exists()) {
                const userData = snap.data();
                await updateDoc(snap.ref, { lastActive: serverTimestamp(), isOnline: true });
                onLoginSuccess(userData);
                onToast('登入成功');
            } else { onToast('找不到員工資料', 'error'); }
        } catch (e) { console.error(e); onToast('帳號或密碼錯誤 (或未註冊)', 'error'); await addLog(null, '登入失敗', `ID: ${cleanId}`); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const cleanId = registerData.employeeId.trim();
        const cleanPwd = registerData.password.trim();
        const cleanName = registerData.name.trim();
        if(cleanPwd.length < 6 || cleanPwd.length > 12) return onToast('密碼需 6~12 碼', 'error');
        if(!cleanName || !cleanId) return onToast('資料不完整', 'error');
        try {
            const uc = await createUserWithEmailAndPassword(auth, `${cleanId}@hands.com`, cleanPwd);
            const role = usersCount === 0 ? 'admin' : 'user';
            const userData = { uid: uc.user.uid, displayName: cleanName, employeeId: cleanId, email: registerData.email, department: registerData.department, role, isOnline: true, lastActive: serverTimestamp(), createdAt: serverTimestamp() };
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', uc.user.uid), userData);
            await sendNotification(uc.user.uid, 'system', `歡迎！您的編號: ${cleanId}, 權限: ${role==='admin'?'管理員':'一般'}`);
            await addLog(userData, '系統註冊', `${cleanName} 註冊 (${role})`);
            onLoginSuccess(userData);
            onToast('註冊成功');
        } catch (e) { console.error(e); onToast(e.message, 'error'); }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#007130] to-[#004d21] rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl rotate-3"><FolderKanban size={48} /></div>
                    <h1 className="text-3xl font-black text-gray-800 mb-2">台隆手創館</h1><h2 className="text-gray-400 font-medium">專案管理系統 {APP_VERSION}</h2>
                </div>
                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
                        <div><label className="text-sm font-bold text-gray-600 ml-1">員工編號</label><input className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 text-lg outline-none focus:border-theme" placeholder="輸入編號" value={loginId} onChange={e=>setLoginId(e.target.value)} /></div>
                        <div><label className="text-sm font-bold text-gray-600 ml-1">密碼</label><input type="password" className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 text-lg outline-none focus:border-theme" placeholder="輸入密碼" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} /></div>
                        <button className="w-full bg-theme text-white font-bold py-4 rounded-2xl text-lg hover:shadow-xl transition flex items-center justify-center gap-2"><LogIn size={20}/> 登入</button>
                        <div className="border-t pt-4 text-center"><button type="button" onClick={()=>setMode('register')} className="text-gray-400 hover:text-gray-600 font-bold">員工註冊</button></div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-4"><button type="button" onClick={()=>setMode('login')}><ArrowRightLeft/></button> 員工註冊</div>
                        <input className="w-full border rounded-2xl p-4 bg-gray-50 outline-none focus:ring-2 ring-theme/50" placeholder="姓名" value={registerData.name} onChange={e=>setRegisterData({...registerData, name:e.target.value})} />
                        <input className="w-full border rounded-2xl p-4 bg-gray-50 outline-none focus:ring-2 ring-theme/50" placeholder="Email" value={registerData.email} onChange={e=>setRegisterData({...registerData, email:e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <input className="w-full border rounded-2xl p-4 bg-gray-50 outline-none" placeholder="編號" value={registerData.employeeId} onChange={e=>setRegisterData({...registerData, employeeId:e.target.value.replace(/\D/g,'')})} maxLength={6} />
                            <select className="border rounded-2xl p-4 bg-gray-50 outline-none" value={registerData.department} onChange={e=>setRegisterData({...registerData, department:e.target.value})}>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
                        </div>
                        <input type="password" className="w-full border rounded-2xl p-4 bg-gray-50 outline-none" placeholder="密碼 (6-12位)" value={registerData.password} onChange={e=>setRegisterData({...registerData, password:e.target.value})} />
                        <button className="w-full bg-theme text-white font-bold py-4 rounded-2xl text-lg hover:shadow-xl transition">註冊並登入</button>
                    </form>
                )}
            </div>
        </div>
    );
};

const Sidebar = ({ activeTab, setActiveTab, currentUser, notifications, markAsRead, onNotificationClick, isMobile, onCloseMobile, onLogout, onShowChangelog }) => {
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const menuItems = [
    { id: 'dashboard', label: '儀表板', icon: LayoutDashboard },
    { id: 'projects', label: '專案列表', icon: FolderKanban },
    ...(currentUser?.role === 'admin' ? [{ id: 'users', label: '用戶管理', icon: Users }] : []),
    { divider: true },
    { id: 'member_changes', label: '會員資料異動', icon: UserCog },
    { id: 'point_requests', label: '會員點數補點', icon: Gift },
    { id: 'voucher_requests', label: '電子券申請', icon: Ticket },
  ];

  return (
    <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-80 bg-white border-r border-gray-200 transition-transform duration-300 ${isMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col shadow-2xl lg:shadow-none`}>
      <div className="p-6 border-b flex items-center gap-3"><div className="bg-theme text-white p-2.5 rounded-xl"><FolderKanban size={22} /></div><div><h1 className="text-lg font-bold">台隆手創館</h1><span className="text-xs text-gray-400">專案管理系統</span></div></div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="mb-4 relative">
           <div className="flex gap-2">
               <button onClick={() => setShowNotif(!showNotif)} className={`flex-1 flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold border transition-all ${showNotif ? 'bg-theme text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                 <Bell size={20} className={unreadCount>0 && !showNotif ? 'animate-bounce' : ''} />通知中心
                 {unreadCount>0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount}</span>}
               </button>
               {Notification.permission === 'default' && <button onClick={()=>Notification.requestPermission()} className="px-3 rounded-2xl border bg-white text-gray-400 hover:text-theme"><BellRing size={20} /></button>}
           </div>
           {showNotif && (
             <div className="absolute top-full left-0 w-full mt-2 bg-white border rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto">
                 {notifications.length === 0 ? <div className="p-8 text-center text-gray-400 text-xs">無新通知</div> : notifications.map(n => (
                     <div key={n.id} onClick={() => { markAsRead(n.id); if(n.linkProjectId) onNotificationClick(n.linkProjectId); }} className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${n.read ? 'opacity-60' : 'bg-blue-50/40'}`}>
                         <div className="flex justify-between mb-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.type==='assignment'?'bg-theme/10 text-theme':'bg-blue-100 text-blue-600'}`}>{n.type==='assignment'?'新指派': (n.type==='system' ? '公告' : '通知')}</span><span className="text-[10px] text-gray-400">{formatTime(n.createdAt)}</span></div>
                         <p className="text-xs text-gray-700">{n.message}</p>
                     </div>
                 ))}
             </div>
           )}
        </div>
        {menuItems.map((item, i) => item.divider ? <div key={i} className="h-px bg-gray-100 my-3 mx-4"/> : 
          <button key={item.id} onClick={() => { setActiveTab(item.id); onCloseMobile?.(); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-theme-light text-theme' : 'text-gray-500 hover:bg-gray-50'}`}>
            <item.icon size={20} />{item.label}
          </button>
        )}
      </nav>
      <div className="p-4 border-t bg-gray-50/50">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-gray-500 shadow-sm">{currentUser?.displayName?.[0]}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{currentUser?.displayName}</p><p className="text-xs text-gray-500">{getDepartmentLabel(currentUser?.department)}</p></div>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 bg-white rounded-xl"><LogOut size={18} /></button>
        </div>
        <div className="flex justify-center gap-2 mt-3"><div className="text-[10px] text-gray-300 font-mono">{APP_VERSION}</div><button onClick={onShowChangelog} className="text-[10px] text-theme font-bold bg-white px-2 py-0.5 rounded-full border border-theme/20">Log</button></div>
      </div>
    </aside>
  );
};

const DashboardView = ({ projects, users, myCount, isAdmin, schedules, logs, openScheduleModal, deleteSchedule, onBroadcast, setBroadcastMsg, broadcastMsg, onAddAnnouncement, announcements, currentUser, onClearLogs, onClearNotifications }) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [newAnnounce, setNewAnnounce] = useState('');
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {/* 公告面板 */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col p-6 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 text-gray-800">
                        <div className="p-2.5 bg-orange-100 text-orange-500 rounded-xl"><Megaphone size={20} /></div>
                        <h3 className="font-bold text-lg">公告面板</h3>
                    </div>
                    
                    {isAdmin && (
                        <div className="flex gap-2 mb-6">
                            <input 
                                className="flex-1 border border-gray-200 rounded-xl p-3 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all" 
                                placeholder="發布新公告..." 
                                value={newAnnounce}
                                onChange={(e) => setNewAnnounce(e.target.value)}
                            />
                            <button 
                                onClick={() => { if(newAnnounce.trim()){ onAddAnnouncement(newAnnounce); setNewAnnounce(''); } }} 
                                disabled={!newAnnounce.trim()}
                                className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Send size={16} /> 發布
                            </button>
                        </div>
                    )}

                    <div className="space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                        {announcements.length === 0 ? <div className="text-center text-gray-400 py-4 text-sm bg-gray-50 rounded-xl">目前沒有公告</div> : 
                         announcements.map(a => (
                            <div key={a.id} className="p-4 bg-orange-50/40 rounded-xl border border-orange-100 flex gap-4 items-start group hover:bg-orange-50 transition-colors">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 shadow-sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 font-mono">
                                        <span>{formatTime(a.createdAt)}</span><span>•</span><span className="bg-white px-2 py-0.5 rounded border border-orange-100 text-orange-400">{a.creatorName}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 管理員維護專區 */}
                {isAdmin && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3 mb-4 text-gray-800">
                            <div className="p-2.5 bg-red-50 text-red-500 rounded-xl"><Shield size={20} /></div>
                            <h3 className="font-bold text-lg">系統維護</h3>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <button onClick={onClearLogs} className="flex-1 border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                                <Trash2 size={18} /> 刪除系統日誌資料
                            </button>
                            <button onClick={onClearNotifications} className="flex-1 border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                                <Eraser size={18} /> 清空所有人通知中心
                            </button>
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2.5"><CalendarDays size={20} className="text-theme"/>活動檔期列表</h3><button onClick={openScheduleModal} className="text-xs bg-theme text-white px-4 py-2 rounded-xl font-bold hover:bg-[#005a26] transition-colors shadow-sm shadow-theme/20">管理檔期</button></div>
                        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-8 py-4">名稱</th><th className="px-8 py-4">區間</th><th className="px-8 py-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100">{schedules.length === 0 ? <tr><td colSpan="3" className="px-8 py-12 text-center text-gray-400">無資料</td></tr> : schedules.map(s => (<tr key={s.id} className="hover:bg-gray-50 transition-colors"><td className="px-8 py-4 font-bold text-gray-700">{s.name}</td><td className="px-8 py-4 font-mono text-gray-500">{s.startDate} ~ {s.endDate}</td><td className="px-8 py-4 text-right"><button onClick={() => deleteSchedule(s.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
                    </div>
                )}
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[450px]">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2.5"><Clock size={20} className="text-gray-400"/>系統日誌 (異常)</h3></div>
                <div className="overflow-y-auto flex-1 p-0 custom-scrollbar"><table className="w-full text-sm"><tbody className="divide-y divide-gray-100">{logs.slice(0, 15).map(l => (<tr key={l.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-3.5"><div className="flex justify-between text-xs mb-1.5 font-bold text-gray-700"><span>{l.userName}</span><span className="text-gray-400 font-medium font-mono">{formatTime(l.timestamp)}</span></div><p className={`text-xs truncate leading-relaxed ${(l.action.includes('異常') || l.action.includes('錯誤') || l.action.includes('失敗')) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>[{l.action}] {l.details}</p></td></tr>))}</tbody></table></div>
            </div>
        </div>
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

// ==========================================
// --- Module: Main App Component ---
// ==========================================

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  const { projects, users, logs, schedules, pointRequests, voucherRequests, voucherPool, memberChangeRequests, notifications, announcements } = useSystemData(authUser, userProfile);
  
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

  const handleClearLogs = async () => {
      requestConfirm('清空日誌', '確定要刪除所有系統日誌嗎？此操作無法復原。', async () => {
          try {
              const batch = writeBatch(db);
              logs.forEach(log => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'logs', log.id)));
              await batch.commit();
              handleToast('日誌已清空');
          } catch (e) { handleToast('清除失敗', 'error'); }
      });
  };

  const handleClearNotifications = async () => {
      requestConfirm('清空通知', '確定要清空所有人的通知嗎？', async () => {
          try {
              const batch = writeBatch(db);
              notifications.forEach(n => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', n.id)));
              await batch.commit();
              handleToast('通知已清空');
          } catch (e) { handleToast('清除失敗', 'error'); }
      });
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
            {/* 儀表板：新增公告發布功能 */}
            {activeTab === 'dashboard' && <DashboardView 
                projects={projects} users={users} myCount={myProjectCount} isAdmin={isAdmin} 
                schedules={schedules} logs={logs} openScheduleModal={()=>toggleModal('schedule')} 
                deleteSchedule={(id)=>requestConfirm('刪除', '確定刪除？', async()=>{await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', id));handleToast('已刪除');})} 
                onBroadcast={handleBroadcast} setBroadcastMsg={setBroadcastMsg} broadcastMsg={broadcastMsg} 
                onAddAnnouncement={async (msg) => { 
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), { content: msg, createdAt: serverTimestamp(), createdBy: userProfile.employeeId, creatorName: userProfile.displayName }); 
                    await notifyGroup(users, () => true, 'system', `【公告】${msg}`); 
                    await addLog(userProfile, '系統廣播', `發送公告: ${msg}`); 
                    handleToast('公告已發送'); 
                }} 
                announcements={announcements} currentUser={userProfile}
                onClearLogs={handleClearLogs}
                onClearNotifications={handleClearNotifications}
            />}
            
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
             <textarea
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 ring-theme/50 h-32"
              placeholder="描述..."
              value={formData.description||''}
              onChange={e=>setFormData({...formData, description:e.target.value})}
            />
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
            <div className="space-y-8 pl-2">
                
                {/* --- 新增：資料庫狀態監控 --- */}
                <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-200 shadow-inner">
                    <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold border-b border-gray-200 pb-2">
                        <Database size={18} /> 
                        <h4>資料庫狀態監控</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">總專案數</span>
                            <span className="text-2xl font-black text-theme">{projects.length}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">活躍用戶</span>
                            <span className="text-2xl font-black text-blue-600">{users.length}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">連線狀態</span>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <span className="text-sm font-bold text-emerald-600">良好</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* -------------------------------- */}

                {CHANGELOGS.map((log, i) => (
                    <div key={i} className="relative pl-8 border-l-2 border-gray-100 last:border-0 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-[3px] border-theme shadow-sm"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <span className="font-black text-gray-800 text-xl tracking-tight">{log.version}</span>
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">{log.date}</span>
                        </div>
                        <ul className="list-disc list-outside ml-4 space-y-2">
                            {log.content.map((item, j) => (
                                <li key={j} className="text-sm text-gray-600 font-medium">{item}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </Modal>
        
        {selectedProject && (
          <ProjectDetailsModal 
            project={selectedProject} 
            onClose={()=>setSelectedProject(null)} 
            users={users} 
            currentUser={currentUserProfile}
            isAdmin={isAdmin}
          />
        )}

        {/* Global Toast */}
        {toast.show && <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-2xl shadow-xl z-[10000] animate-fade-in flex items-center gap-3 font-bold ${toast.type==='error'?'bg-red-500':'bg-emerald-600'}`}>
            {toast.type==='error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
            {toast.message}
        </div>}
      </main>
    </div>
  );
}
