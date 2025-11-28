import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  setDoc, serverTimestamp, writeBatch, query, orderBy
} from 'firebase/firestore';
import { 
  LayoutDashboard, FolderKanban, Users, Plus, Trash2, Activity, Shield, Clock,
  Menu, X, MessageSquare, UserCircle, Hash, Mail, CalendarClock, Send, LogIn,
  CheckCircle2, AlertCircle, Grid, List, Edit, ArrowRight, Briefcase, Bell,
  CalendarDays, Zap, AlertTriangle, Flame, Gift, CheckSquare, Ticket, UserCheck, BriefcaseBusiness,
  Lock, KeyRound, Timer, UserCog, LogOut, FileText, Info, Archive, Undo2, ArrowRightLeft, UserPlus, ChevronRight
} from 'lucide-react';

// --- Configuration & Constants ---
const APP_VERSION = 'v2.2.2 Voucher Approval';
const THEME_COLOR = '#007130';
const DEPARTMENTS = ['企劃', '設計', '採購', '營業', '資訊', '營運'];
const DEPARTMENT_ICONS = {
    '企劃': '📝',
    '設計': '🎨',
    '採購': '🛍️',
    '營業': '🏪',
    '資訊': '💻',
    '營運': '⚙️'
};
const VOUCHER_REASONS = ['活動結束退換貨補券', '客訴或個案','其他'];
const MEMBER_CHANGE_TYPES = ['變更手機號碼', '變更生日', '刪除會員','其他'];

const CHANGELOGS = [
    { version: 'v2.2.2', date: '2025-06-04', content: ['電子券申請新增「駁回」功能', '開放主管 (Manager) 權限可核准或駁回電子券申請'] },
    { version: 'v2.2.1', date: '2025-06-03', content: ['全面應用部門 Emoji 圖示於選單與列表中', '優化使用者介面視覺細節'] },
    { version: 'v2.2.0', date: '2025-06-02', content: ['新增部門對應 Emoji 圖示', '管理員名稱新增皇冠 👑 標示', '實作資料權限分流'] },
    { version: 'v2.1.1', date: '2025-06-01', content: ['修復新增專案指派歸類錯誤', '移除其他專案標題刪除線', '優化專案詳情手機版滾動體驗'] },
];

// Firebase Init
const firebaseConfig = {
  apiKey: "AIzaSyC6AOjDsuIbSjTMVqvVDTCu8gO_FTz9jrM",
  authDomain: "handspmsystem.firebaseapp.com",
  projectId: "handspmsystem",
  // ...其他欄位
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Helper Functions (Notifications) ---
const sendNotification = async (targetUid, type, message, linkId = null) => {
    if (!targetUid) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
            targetUserId: targetUid,
            type,
            message,
            linkProjectId: linkId,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (e) { console.error("Notification Error:", e); }
};

const notifyGroup = async (users, roleFilter, type, message) => {
    const targets = users.filter(roleFilter);
    for (const user of targets) {
        await sendNotification(user.uid, type, message);
    }
};

// --- Hooks ---
const useSystemData = (authUser, userProfile) => {
  const [data, setData] = useState({
    projects: [], users: [], logs: [], notifications: [], schedules: [],
    pointRequests: [], voucherRequests: [], voucherPool: [], memberChangeRequests: []
  });

  useEffect(() => {
    if (!authUser) return; 
    
    // Permission Filter Logic
    const isPrivileged = userProfile?.role === 'admin' || userProfile?.role === 'manager';
    const personalFilter = (d) => isPrivileged ? true : d.requesterId === userProfile?.employeeId;

    const collections = [
      { key: 'users', path: 'users_metadata' },
      { key: 'projects', path: 'projects', sort: 'updatedAt' },
      { key: 'logs', path: 'logs', sort: 'timestamp' },
      { key: 'schedules', path: 'schedules', sort: 'startDate', isDate: true },
      { 
        key: 'notifications', 
        path: 'notifications', 
        sort: 'createdAt', 
        filter: (d) => userProfile && d.targetUserId === userProfile.uid 
      },
      // Apply personal filter to these collections
      { key: 'pointRequests', path: 'point_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'voucherRequests', path: 'voucher_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'memberChangeRequests', path: 'member_change_requests', sort: 'createdAt', filter: personalFilter },
      
      { key: 'voucherPool', path: 'voucher_pool' }
    ];

    const unsubs = collections.map(({ key, path, sort, isDate, filter }) => 
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', path), (snap) => {
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (filter) items = items.filter(filter);
        if (sort) {
          items.sort((a, b) => {
            const valA = a[sort], valB = b[sort];
            if (isDate) return new Date(valA) - new Date(valB);
            return (valB?.toMillis?.() || 0) - (valA?.toMillis?.() || 0);
          });
        }
        setData(prev => ({ ...prev, [key]: items }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [authUser, userProfile]); 

  return data;
};

// --- Helper Functions (Format) ---
const formatTime = (ts) => !ts ? '剛剛' : new Date(ts.toDate?.() || ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDate = (ts) => !ts ? '...' : new Date(ts.toDate?.() || ts).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
const showToast = (setToast, msg, type = 'success') => setToast({ show: true, message: msg, type });

const addLog = async (currentUser, action, details) => {
  try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
    action, details, userId: currentUser?.uid || 'system', userName: currentUser?.displayName || 'System', timestamp: serverTimestamp()
  }); } catch(e) {}
};

const getDaysDiff = (targetDate) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getScheduleEmoji = (name) => {
    if (!name) return '📅';
    if (name.includes('春節') || name.includes('新春') || name.includes('過年')) return '🧧';
    if (name.includes('母親節')) return '🌹'; 
    if (name.includes('年中慶')) return '🎉';
    if (name.includes('父親節')) return '👔';
    if (name.includes('秋') || name.includes('秋上市')) return '🍁';
    if (name.includes('週年慶')) return '🎂';
    if (name.includes('聖誕') || name.includes('耶誕')) return '🎄';
    if (name.includes('情人')) return '💘';
    if (name.includes('夏')) return '☀️';
    if (name.includes('開學')) return '🎒';
    if (name.includes('雙11') || name.includes('購物節')) return '🛍️';
    return '📅';
};

// Helper to get department label with emoji
const getDepartmentLabel = (dept) => {
    const icon = DEPARTMENT_ICONS[dept] || '🏢';
    return `${icon} ${dept}`;
};

// --- Shared Components ---
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
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed pl-1">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm">取消</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-md shadow-red-200 transition-all text-sm flex items-center gap-2">
              <Trash2 size={16} /> 確認執行
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active: ['bg-green-50 text-[#007130]', '進行中'],
    transferred: ['bg-blue-50 text-blue-600', '轉交給他人'],
    completed: ['bg-gray-100 text-gray-500', '已完成'],
    unassigned: ['bg-slate-100 text-slate-600', '待分配'],
    pending: ['bg-orange-50 text-orange-600', '待核准'],
    closed: ['bg-gray-100 text-gray-500', '已結案'],
    approved: ['bg-theme-light text-theme', '已核准'],
    rejected: ['bg-red-50 text-red-600', '已駁回']
  };
  const [cls, label] = map[status] || map.unassigned;
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border border-black/5 ${cls} whitespace-nowrap`}>{label}</span>;
};

const UrgencyBadge = ({ level }) => {
  if (!level || level === 'normal') return null;
  const isVery = level === 'very_urgent';
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm border whitespace-nowrap ${isVery ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
      {isVery ? <Flame size={10} fill="currentColor"/> : <Zap size={10} fill="currentColor"/>}
      {isVery ? '非常緊急' : '緊急'}
    </span>
  );
};

// --- Sub-Components ---

const Sidebar = ({ activeTab, setActiveTab, currentUser, unreadCount, notifications, markAsRead, onNotificationClick, isMobile, onCloseMobile, onLogout, onShowChangelog }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  
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
    <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-80 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col ${isMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shadow-2xl lg:shadow-none`}>
      <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-white sticky top-0 z-10">
        <div className="bg-gradient-to-br from-[#007130] to-[#005a26] text-white p-2.5 rounded-xl shadow-lg"><FolderKanban size={22} /></div>
        <div><h1 className="text-lg font-bold text-gray-800 tracking-tight">台隆手創館</h1><span className="text-xs text-gray-400 font-medium tracking-wide">專案管理系統</span></div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="mb-4 relative">
           <button 
             onClick={() => setShowNotifications(!showNotifications)}
             className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold border transition-all duration-200 ${showNotifications ? 'bg-theme text-white border-theme shadow-md ring-2 ring-theme/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
           >
             <Bell size={20} className={unreadCount > 0 && !showNotifications ? 'animate-bounce' : ''} />
             <span>通知中心</span>
             {unreadCount > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{unreadCount}</span>}
           </button>

           {/* Notification Dropdown */}
           {showNotifications && (
             <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto animate-fade-in ring-1 ring-black/5">
                 {notifications.length === 0 ? (
                     <div className="p-8 text-center text-gray-400 text-xs">目前沒有新通知</div>
                 ) : (
                     notifications.map(n => (
                         <div 
                           key={n.id} 
                           onClick={() => {
                               markAsRead(n.id);
                               if(n.linkProjectId) onNotificationClick(n.linkProjectId);
                           }}
                           className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${n.read ? 'opacity-60' : 'bg-blue-50/40'}`}
                         >
                             <div className="flex justify-between items-start mb-1.5">
                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.type === 'assignment' ? 'bg-theme/10 text-theme' : n.type === 'system' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                     {n.type === 'assignment' ? '新指派' : n.type === 'system' ? '異動' : '通知'}
                                 </span>
                                 <span className="text-[10px] text-gray-400">{formatTime(n.createdAt)}</span>
                             </div>
                             <p className="text-xs text-gray-700 leading-relaxed font-medium">{n.message}</p>
                         </div>
                     ))
                 )}
             </div>
           )}
        </div>
        {menuItems.map((item, i) => item.divider ? 
          <div key={i} className="h-px bg-gray-100 my-3 mx-4"/> : 
          <button key={item.id} onClick={() => { setActiveTab(item.id); onCloseMobile?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${activeTab === item.id ? 'bg-theme-light text-theme shadow-sm ring-1 ring-theme/10' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
            <item.icon size={20} strokeWidth={2.5} className={activeTab === item.id ? 'text-theme' : 'text-gray-400'} />{item.label}
          </button>
        )}
      </nav>
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-gray-500 shadow-sm border border-gray-200">{currentUser?.displayName?.[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
                <p className="text-sm font-bold truncate text-gray-800">{currentUser?.displayName}</p>
                {currentUser?.role === 'admin' && <span className="text-xs" title="管理員">👑</span>}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Briefcase size={10}/>{getDepartmentLabel(currentUser?.department)}</p>
          </div>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-white hover:shadow-sm rounded-xl transition-all" title="登出">
              <LogOut size={18} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
            <div className="text-[10px] text-gray-300 font-mono tracking-wide">{APP_VERSION}</div>
            <button onClick={onShowChangelog} className="text-[10px] text-theme font-bold bg-white border border-theme/20 px-2 py-0.5 rounded-full hover:bg-theme hover:text-white transition-colors">Log</button>
        </div>
      </div>
    </aside>
  );
};

const DashboardView = ({ projects, users, myCount, isAdmin, schedules, logs, openScheduleModal, deleteSchedule }) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const currentSchedule = schedules.find(s => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return today >= start && today <= end;
  });

  const nextSchedule = schedules
      .filter(s => new Date(s.startDate) > today)
      .sort((a,b) => new Date(a.startDate) - new Date(b.startDate))[0];

  const activeScheduleName = currentSchedule ? currentSchedule.name : (nextSchedule ? nextSchedule.name : '');
  const scheduleEmoji = getScheduleEmoji(activeScheduleName);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-br from-[#0a2e18] to-[#14522d] rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden ring-1 ring-white/10 group">
            <div className="relative z-10 flex-1 text-white">
                <div className="flex items-center gap-2 mb-3 text-white/80 text-xs font-bold uppercase tracking-widest">
                    <CalendarClock size={16} />
                    HANDS 活動檔期
                </div>
                {currentSchedule ? (
                    <div>
                        <h2 className="text-4xl font-extrabold mb-2 tracking-tight drop-shadow-md text-white">{currentSchedule.name}</h2>
                        <p className="text-white/90 font-mono mb-6 text-sm flex items-center gap-2">
                            <span className="bg-white/20 px-2 py-0.5 rounded">{currentSchedule.startDate}</span>
                            <ArrowRight size={12} className="text-white"/>
                            <span className="bg-white/20 px-2 py-0.5 rounded">{currentSchedule.endDate}</span>
                        </p>
                        <div className="inline-flex items-center gap-2 bg-white text-[#007130] px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-black/10 animate-pulse">
                            <Timer size={18} />
                            活動倒數 {getDaysDiff(currentSchedule.endDate)} 天
                        </div>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-3xl font-bold mb-2 text-white/60">目前無進行中檔期</h2>
                        {nextSchedule ? (
                            <div className="mt-4 bg-white/10 rounded-2xl p-4 border border-white/20 inline-block backdrop-blur-sm">
                                <p className="text-white font-bold flex items-center gap-2 text-sm mb-1">
                                    <ArrowRight size={16} className="text-white" />
                                    下檔預告：{nextSchedule.name}
                                </p>
                                <p className="text-white font-bold text-lg">
                                    距離開檔還有 {getDaysDiff(nextSchedule.startDate)} 天
                                </p>
                            </div>
                        ) : (
                            <p className="text-white/50 text-sm mt-1 italic">尚無規劃未來檔期</p>
                        )}
                    </div>
                )}
            </div>
            <div className="absolute -right-8 -bottom-10 text-[10rem] opacity-20 rotate-12 select-none pointer-events-none filter drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6">
                {scheduleEmoji}
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
            { title: '總專案數', val: projects.length, icon: FolderKanban, color: 'text-theme', bg: 'bg-theme-light' },
            { title: '指派給我', val: myCount, icon: CheckCircle2, color: 'text-white', bg: 'bg-gradient-to-br from-[#007130] to-[#005a26]', isDark: true },
        ].map((card, i) => (
            <div key={i} className={`p-6 rounded-3xl shadow-sm border border-gray-100 transition-all hover:shadow-lg hover:-translate-y-1 duration-300 ${card.isDark ? card.bg : 'bg-white'}`}>
            <div className="flex justify-between items-start">
                <div><p className={`text-xs font-bold uppercase tracking-wider mb-2 ${card.isDark ? 'text-emerald-100/60' : 'text-gray-400'}`}>{card.title}</p><h3 className={`text-4xl font-black ${card.isDark ? 'text-white' : 'text-gray-800'}`}>{card.val}</h3></div>
                <div className={`p-4 rounded-2xl ${!card.isDark ? 'bg-gray-50' : 'bg-white/20 backdrop-blur-md'} ${card.color}`}><card.icon size={28} /></div>
            </div>
            </div>
        ))}
        </div>
        {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2.5"><CalendarDays size={20} className="text-theme"/>活動檔期列表</h3>
                <button onClick={openScheduleModal} className="text-xs bg-theme text-white px-4 py-2 rounded-xl font-bold hover:bg-[#005a26] transition-colors shadow-sm shadow-theme/20">管理檔期</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-8 py-4">名稱</th><th className="px-8 py-4">區間</th><th className="px-8 py-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                    {schedules.length === 0 ? <tr><td colSpan="3" className="px-8 py-12 text-center text-gray-400">無資料</td></tr> : schedules.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors"><td className="px-8 py-4 font-bold text-gray-700">{s.name}</td><td className="px-8 py-4 font-mono text-gray-500">{s.startDate} ~ {s.endDate}</td>
                    <td className="px-8 py-4 text-right"><button onClick={() => deleteSchedule(s.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"><Trash2 size={18}/></button></td></tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[450px]">
            <div className="px-6 py-6 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2.5"><Clock size={20} className="text-gray-400"/>系統日誌 (異常)</h3></div>
            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar"><table className="w-full text-sm"><tbody className="divide-y divide-gray-100">{logs.slice(0, 15).map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-3.5">
                    <div className="flex justify-between text-xs mb-1.5 font-bold text-gray-700"><span>{l.userName}</span><span className="text-gray-400 font-medium font-mono">{formatTime(l.timestamp)}</span></div>
                    <p className={`text-xs truncate leading-relaxed ${(l.action.includes('異常') || l.action.includes('錯誤') || l.action.includes('失敗')) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>[{l.action}] {l.details}</p>
                </td></tr>
            ))}</tbody></table></div>
            </div>
        </div>
        )}
    </div>
  );
};

const ProjectsView = ({ projects, users, currentUser, isAdmin, onAdd, onSelect, onDelete, notifications }) => {
  const [viewMode, setViewMode] = useState('grid');
  
  const activeStatuses = ['unassigned', 'active', 'transferred', 'pending'];
  const completedStatuses = ['completed', 'closed', 'approved', 'rejected'];

  const myActiveProjects = projects.filter(p => 
    (p.assignedToEmployeeId === currentUser.employeeId || p.createdBy === currentUser.employeeId) && 
    activeStatuses.includes(p.status)
  );

  const otherActiveProjects = projects.filter(p => 
    p.assignedToEmployeeId !== currentUser.employeeId && 
    p.createdBy !== currentUser.employeeId && 
    activeStatuses.includes(p.status)
  );

  const completedProjects = projects.filter(p => 
    completedStatuses.includes(p.status)
  );

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
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2"><StatusBadge status={p.status} />{!isSimple && <UrgencyBadge level={p.urgency} />}</div>
                    {(isAdmin || p.createdBy === currentUser.employeeId) && 
                        <button onClick={(e)=>{e.stopPropagation(); onDelete(p.id, p.title);}} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    }
                </div>
                <h3 className={`font-bold text-gray-800 truncate mb-2 text-lg group-hover:text-theme transition-colors ${isSimple ? 'line-through decoration-gray-300 text-gray-500' : ''}`}>{p.title}</h3>
                {!isSimple && <p className="text-gray-500 text-sm line-clamp-2 h-10 mb-5 leading-relaxed">{p.description}</p>}
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-auto"><UserCircle size={16} className="text-gray-400"/><span className="font-bold truncate">{p.assignedToName}</span></div>
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left whitespace-nowrap text-sm">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-6 py-4">專案名稱</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4">負責人</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{list.map(p => (
              <tr key={p.id} onClick={() => onSelect(p)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">
                    {p.assignedToEmployeeId === currentUser.employeeId && <CheckCircle2 size={18} className="text-theme"/>}
                    {p.title}
                    {notifications.some(n => !n.read && n.linkProjectId === p.id) && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                </td>
                <td className="px-6 py-4"><StatusBadge status={p.status}/></td><td className="px-6 py-4 text-gray-600 font-medium">{p.assignedToName}</td>
                <td className="px-6 py-4 text-right">{(isAdmin || p.createdBy === currentUser.employeeId) && <button onClick={(e)=>{e.stopPropagation(); onDelete(p.id, p.title);}} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18}/></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 pl-3 border-l-[6px] border-theme">專案列表</h2>
        <div className="flex gap-3">
          <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50">
            {['grid', 'list'].map(m => <button key={m} onClick={()=>setViewMode(m)} className={`p-2.5 rounded-lg transition-all ${viewMode===m?'bg-white text-theme shadow-sm ring-1 ring-black/5':'text-gray-400 hover:text-gray-600'}`}>{m==='grid'?<Grid size={20}/>:<List size={20}/>}</button>)}
          </div>
          <button onClick={onAdd} className="flex items-center gap-2 bg-theme text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={20}/>新增專案</button>
        </div>
      </div>
      
      <ProjectListSection list={myActiveProjects} title="我的專案 (進行中)" />
      <div className="border-t border-gray-200 my-8 opacity-50"></div>
      <ProjectListSection list={otherActiveProjects} title="其他專案 (進行中)" isSimple={true} />
      <div className="border-t border-gray-200 my-8 opacity-50"></div>
      <ProjectListSection list={completedProjects} title="已結束的專案" isSimple={true} />
    </div>
  );
};

// --- Project Details with Discussion Modal ---
const ProjectDetailsModal = ({ project, onClose, users, currentUser, isAdmin }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!project) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [project]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleAddSystemComment = async (text) => {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), {
          text,
          type: 'system',
          createdAt: serverTimestamp()
      });
  };

  const updateProject = async (updates, message) => {
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id), updates);
          if (message) await handleAddSystemComment(message);
          
          if (updates.assignedToEmployeeId && updates.assignedToEmployeeId !== project.assignedToEmployeeId) {
              const assignedUser = users.find(u => u.employeeId === updates.assignedToEmployeeId);
              if (assignedUser) {
                  await sendNotification(assignedUser.uid, 'assignment', `${currentUser.displayName} 將專案「${project.title}」指派給了您`, project.id);
              }
          }
      } catch (e) { console.error(e); }
  };

  const handleSendComment = async (e) => {
      e.preventDefault();
      if (!newComment.trim()) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects', project.id, 'comments'), {
          text: newComment,
          userId: currentUser.employeeId,
          userName: currentUser.displayName,
          type: 'user',
          createdAt: serverTimestamp()
      });
      setNewComment('');
  };

  return (
    <Modal isOpen={!!project} onClose={onClose} title="專案詳情" maxWidth="max-w-5xl">
       <div className="flex flex-col lg:flex-row gap-8 lg:h-[650px] overflow-hidden">
         {/* Details Column */}
         <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
           <div className="flex justify-between items-start">
             <div>
                 <div className="flex gap-2 mb-3"><StatusBadge status={project.status}/><UrgencyBadge level={project.urgency}/></div>
                 <h2 className="text-3xl font-extrabold mb-1 text-gray-800 leading-tight">{project.title}</h2>
             </div>
             <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 flex items-center gap-1"><UserCircle size={14}/>建立者: {project.creatorName}</div>
           </div>
           <div className="bg-white border border-gray-100 p-6 rounded-2xl min-h-[120px] whitespace-pre-wrap text-gray-600 shadow-sm leading-relaxed text-sm">{project.description}</div>
           
           <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100 space-y-5">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider"><Edit size={16}/> 專案管理面板</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">狀態</label>
                      <select 
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all" 
                        value={project.status} 
                        onChange={(e)=>updateProject({status:e.target.value}, `將狀態更改為: ${e.target.options[e.target.selectedIndex].text}`)}
                      >
                          <option value="active">進行中</option>
                          <option value="transferred">轉交給他人</option>
                          <option value="completed">已完成</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">緊急度</label>
                      <select 
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all" 
                        value={project.urgency} 
                        onChange={(e)=>updateProject({urgency:e.target.value}, `將緊急度更改為: ${e.target.options[e.target.selectedIndex].text}`)}
                      >
                          <option value="normal">正常</option><option value="urgent">緊急</option><option value="very_urgent">非常緊急</option>
                      </select>
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">指派負責人</label>
                  <select 
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-theme/20 outline-none transition-all"
                    value={project.assignedToEmployeeId || ''}
                    onChange={(e) => {
                        const newId = e.target.value;
                        const newUser = users.find(u => u.employeeId === newId);
                        const newName = newUser ? newUser.displayName : '未指派';
                        updateProject({ assignedToEmployeeId: newId, assignedToName: newName }, `將負責人更改為: ${newName}`);
                    }}
                  >
                    <option value="">未指派</option>
                    {users.map(u => (
                      <option key={u.id} value={u.employeeId}>{u.displayName} ({getDepartmentLabel(u.department)})</option>
                    ))}
                  </select>
              </div>
           </div>
         </div>

         <div className="w-full lg:w-[400px] bg-gray-50 border border-gray-200 rounded-2xl flex flex-col overflow-hidden h-[400px] lg:h-auto shadow-inner mt-4 lg:mt-0">
            <div className="p-4 bg-white border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2"><MessageSquare size={18}/> 專案討論 ({comments.length})</div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {comments.length === 0 && <div className="text-center text-gray-400 text-xs mt-10">尚無討論，開始留言吧！</div>}
                {comments.map(c => (
                    c.type === 'system' ? (
                        <div key={c.id} className="flex items-center gap-3 my-3 opacity-80">
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <span className="text-[10px] text-gray-500 font-medium bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm">{c.text} • {formatTime(c.createdAt)}</span>
                            <div className="h-px bg-gray-200 flex-1"></div>
                        </div>
                    ) : (
                        <div key={c.id} className="flex gap-3 items-start group">
                             <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 shadow-sm mt-1">{c.userName?.[0]}</div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-baseline mb-1">
                                     <span className="text-xs font-bold text-gray-700">{c.userName}</span>
                                     <span className="text-[10px] text-gray-400 font-mono">{formatTime(c.createdAt)}</span>
                                 </div>
                                 <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 text-sm text-gray-800 shadow-sm break-words leading-relaxed group-hover:shadow-md transition-shadow">{c.text}</div>
                             </div>
                        </div>
                    )
                ))}
                <div ref={commentsEndRef}></div>
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleSendComment} className="relative">
                    <input 
                        className="w-full border border-gray-300 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-theme focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-all" 
                        placeholder="輸入留言..." 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button type="submit" disabled={!newComment.trim()} className="absolute right-2 top-2 p-1.5 text-theme disabled:text-gray-300 hover:bg-theme-light rounded-lg transition-colors"><Send size={18}/></button>
                </form>
            </div>
         </div>
       </div>
    </Modal>
  );
};

// --- Main App ---
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  const { projects, users, logs, schedules, pointRequests, voucherRequests, voucherPool, memberChangeRequests, notifications } = useSystemData(authUser, currentUserProfile);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [modals, setModals] = useState({ project: false, schedule: false, point: false, voucher: false, user: false, inventory: false, memberChange: false, changelog: false });
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  const [authMode, setAuthMode] = useState('login'); 
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerData, setRegisterData] = useState({ name: '', employeeId: '', email: '', department: '企劃', password: '' });
  
  const [formData, setFormData] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Role Helper
  const isManagerOrAdmin = useMemo(() => 
      currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager', 
  [currentUserProfile]);
  const isAdmin = currentUserProfile?.role === 'admin';

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read), [notifications]);
  const markNotificationAsRead = async (id) => {
      try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', id), { read: true }); } catch(e) {}
  };
  const handleNotificationClick = (projectId) => {
      const targetProject = projects.find(p => p.id === projectId);
      if (targetProject) setSelectedProject(targetProject);
  };

  useEffect(() => {
    const init = async () => {
      try { 
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) { console.error(e); }
    };
    init();
    return onAuthStateChanged(auth, setAuthUser);
  }, []);

  const toggleModal = (key, val = true) => setModals(prev => ({ ...prev, [key]: val }));
  
const handleLogin = async (e) => {
    e.preventDefault();
    try {
        // 1. 技巧：將員工編號組合成 Email 進行驗證
        const email = `${loginId}@hands.com`;
        
        // 2. 呼叫 Firebase 進行安全登入
        const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword);
        const user = userCredential.user;

        // 3. 登入成功後，從資料庫撈取該用戶的個人資料 (角色、部門等)
        // 這裡我們從 users 陣列中找 (因為 useSystemData 已經讀取了 metadata)
        // *注意*：為了更穩定的作法，建議直接讀取單筆 doc，但為了配合您現有架構，我們先從 users 找
        const userMeta = users.find(u => u.uid === user.uid);
        
        if (userMeta) {
            setCurrentUserProfile(userMeta);
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', user.uid), { lastActive: serverTimestamp(), isOnline: true });
            showToast(setToast, '登入成功');
        } else {
            // 雖然帳號密碼對，但資料庫沒資料 (極少見)
            showToast(setToast, '找不到使用者資料', 'error');
        }

    } catch (error) {
        console.error(error);
        showToast(setToast, '登入失敗：編號或密碼錯誤', 'error');
        await addLog(null, '登入失敗', `ID: ${loginId} 嘗試登入失敗`);
    }
  };

const handleRegister = async (e) => {
    e.preventDefault();
    if(!registerData.password) { showToast(setToast, '請設定密碼', 'error'); return; }
    if(!registerData.name || !registerData.employeeId) { showToast(setToast, '請填寫完整資料', 'error'); return; }

    try {
        // 1. 技巧：將員工編號組合成 Email
        const email = `${registerData.employeeId}@hands.com`;
        
        // 2. 建立安全帳號 (這一步會自動加密密碼)
        const userCredential = await createUserWithEmailAndPassword(auth, email, registerData.password);
        const user = userCredential.user;
        
        // 3. 判斷權限 (如果是第一個人，給 admin，否則 user)
        // 注意：這裡可能有並發問題，但簡單版先這樣寫
        const isFirstRun = users.length === 0; 
        const role = isFirstRun ? 'admin' : 'user';

        // 4. 只將「非機密」資料寫入 Firestore (注意：這裡不再存 password 欄位了！)
        const userData = { 
            uid: user.uid, // 使用 Firebase 產生的安全 UID
            displayName: registerData.name, 
            employeeId: registerData.employeeId, 
            // email: registerData.email, // 如果您想存真實 email 可以留著，不想存就拿掉
            department: registerData.department, 
            role: role, 
            isOnline: true, 
            lastActive: serverTimestamp(), 
            createdAt: serverTimestamp() 
        };
        
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', user.uid), userData);
        await addLog(userData, '系統註冊', `${registerData.name} 註冊了帳號 (角色: ${role})`);
        
        setCurrentUserProfile(userData);
        showToast(setToast, '註冊成功，已自動登入');

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            showToast(setToast, '此員工編號已註冊過', 'error');
        } else {
            showToast(setToast, '註冊失敗: ' + error.message, 'error');
        }
    }
  };

  const genericAdd = async (collectionName, data, successMsg) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), { ...data, createdAt: serverTimestamp() });
      showToast(setToast, successMsg);
      return true;
    } catch (e) { 
        showToast(setToast, '操作失敗', 'error');
        await addLog(currentUserProfile, '系統錯誤', `執行 ${collectionName} 新增失敗`);
        return false; 
    }
  };

  const handleAddVoucherCodes = async () => {
      const inputCodes = (formData.codes || '').split(',').map(c => c.trim()).filter(c => c);
      if (inputCodes.length === 0) return;

      const existingCodes = new Set(voucherPool.map(v => v.code));
      const duplicates = inputCodes.filter(c => existingCodes.has(c));
      
      if (duplicates.length > 0) {
          showToast(setToast, `重複券號，未新增: ${duplicates.join(', ')}`, 'error');
          return;
      }

      const uniqueNewCodes = inputCodes.filter(c => !existingCodes.has(c));
      
      if (uniqueNewCodes.length > 0) {
          const batch = writeBatch(db);
          uniqueNewCodes.forEach(c => {
              const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'voucher_pool'));
              batch.set(ref, { code: c, isUsed: false, createdAt: serverTimestamp() });
          });
          await batch.commit();
          setFormData({...formData, codes: ''});
          showToast(setToast, `已成功新增 ${uniqueNewCodes.length} 組券號`);
      }
  };

  const requestConfirm = (title, message, onConfirmAction) => {
      setConfirmDialog({
          isOpen: true,
          title,
          message,
          onConfirm: onConfirmAction
      });
  };

  const MobileRequestCard = ({ title, status, meta, actions, children }) => (
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex justify-between items-start">
              <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">{title}</h4>
                  <div className="text-xs text-gray-400 font-mono">{meta}</div>
              </div>
              <StatusBadge status={status} />
          </div>
          <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 border border-gray-50/50">
              {children}
          </div>
          {actions && (
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-1">
                  {actions}
              </div>
          )}
      </div>
  );

  if (!currentUserProfile) {
    const isFirstRun = users.length === 0 && authUser;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans bg-[#f8fafc]">
        <style>{`body, input, button, select, textarea { font-family: 'Noto Sans TC', sans-serif; }`}</style>
        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 transition-all duration-300">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-[#007130] to-[#004d21] rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-theme/30 transform rotate-3"><FolderKanban size={48} /></div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">台隆手創館</h1><h2 className="text-gray-400 font-medium tracking-wide">專案管理系統 {APP_VERSION}</h2>
          </div>

          {authMode === 'login' && !isFirstRun ? (
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
              <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2 ml-1">員工編號</label>
                  <div className="relative group">
                    <input type="text" maxLength={6} className="w-full border-2 border-gray-100 rounded-2xl p-4 pl-12 focus:border-theme outline-none bg-gray-50 focus:bg-white transition-all text-lg" placeholder="輸入 6 位數編號" value={loginId} onChange={(e) => setLoginId(e.target.value.replace(/\D/g, ''))} />
                    <UserCircle className="absolute left-4 top-4 text-gray-400 group-focus-within:text-theme transition-colors" size={22} />
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2 ml-1">登入密碼</label>
                  <div className="relative group">
                    <input type="password" className="w-full border-2 border-gray-100 rounded-2xl p-4 pl-12 focus:border-theme outline-none bg-gray-50 focus:bg-white transition-all text-lg" placeholder="輸入密碼" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                    <KeyRound className="absolute left-4 top-4 text-gray-400 group-focus-within:text-theme transition-colors" size={22} />
                  </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-[#007130] to-[#005a26] text-white font-bold py-4 rounded-2xl hover:shadow-xl hover:shadow-theme/30 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 text-lg mt-2"><LogIn size={22} />登入系統</button>
              
              <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-400 font-medium">首次登入請先註冊</span></div>
              </div>
              <button type="button" onClick={() => setAuthMode('register')} className="w-full bg-white border-2 border-gray-100 text-gray-600 font-bold py-3.5 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"><UserPlus size={20} /> 員工註冊</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-2">
                  <button type="button" onClick={() => setAuthMode('login')} className="p-1 -ml-1 text-gray-400 hover:text-theme transition-colors"><ArrowRightLeft size={20}/></button>
                  {isFirstRun ? "系統初始化 (管理員)" : "員工註冊"}
              </div>
              
              <input className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme transition-all bg-gray-50 focus:bg-white" placeholder="姓名" value={registerData.name} onChange={e=>setRegisterData({...registerData, name:e.target.value})} required />
              
              <div className="grid grid-cols-2 gap-4">
                  <input className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme transition-all bg-gray-50 focus:bg-white" placeholder="員工編號" value={registerData.employeeId} onChange={e=>setRegisterData({...registerData, employeeId:e.target.value.replace(/\D/g, '')})} maxLength={6} required />
                  <select className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme transition-all bg-gray-50 focus:bg-white appearance-none" value={registerData.department} onChange={e=>setRegisterData({...registerData, department:e.target.value})}>
                      {DEPARTMENTS.map(d=><option key={d} value={d}>{getDepartmentLabel(d)}</option>)}
                  </select>
              </div>

              <div className="relative">
                  <input type="password" className="w-full border border-gray-200 rounded-2xl p-4 pl-12 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme transition-all bg-gray-50 focus:bg-white" placeholder="設定登入密碼" value={registerData.password} onChange={e=>setRegisterData({...registerData, password:e.target.value})} required />
                  <Lock className="absolute left-4 top-4 text-gray-400" size={20} />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-[#007130] to-[#005a26] text-white font-bold py-4 rounded-2xl hover:shadow-xl hover:shadow-theme/30 transition transform active:scale-[0.98] text-lg">完成註冊並登入</button>
              {!isFirstRun && <button type="button" onClick={() => setAuthMode('login')} className="w-full text-gray-400 text-sm font-medium hover:text-gray-600 transition">返回登入</button>}
            </form>
          )}
        </div>
        {toast.show && <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-2xl shadow-2xl z-[10000] animate-fade-in flex items-center gap-3 font-bold ${toast.type==='error'?'bg-red-500':'bg-emerald-600'}`}>
            {toast.type==='error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
            {toast.message}
        </div>}
      </div>
    );
  }

  const myProjectCount = projects.filter(p => p.assignedToEmployeeId === currentUserProfile.employeeId).length;

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap');
        body, input, button, select, textarea { font-family: 'Noto Sans TC', sans-serif; }
        .bg-theme { background-color: ${THEME_COLOR}; } .text-theme { color: ${THEME_COLOR}; }
        .bg-theme-light { background-color: rgba(0, 113, 48, 0.08); } .ring-theme:focus { --tw-ring-color: ${THEME_COLOR}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.2); }
      `}</style>

      {/* Global Components */}
      {isMobileMenu && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsMobileMenu(false)} />}
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
      
      <Sidebar 
        activeTab={activeTab} setActiveTab={setActiveTab} 
        currentUser={currentUserProfile} isMobile={isMobileMenu} 
        onCloseMobile={() => setIsMobileMenu(false)}
        unreadCount={unreadNotifications.length}
        notifications={notifications}
        markAsRead={markNotificationAsRead}
        onNotificationClick={handleNotificationClick}
        onLogout={handleLogout}
        onShowChangelog={() => toggleModal('changelog')}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#f8fafc]">
        <header className="lg:hidden bg-white border-b p-4 flex justify-between items-center z-10 shadow-sm sticky top-0">
          <div className="flex items-center gap-2"><div className="bg-theme text-white p-1.5 rounded-lg"><FolderKanban size={18} /></div><h1 className="font-bold text-gray-800"> HANDS PM System</h1></div>
          <button onClick={() => setIsMobileMenu(true)} className="text-gray-600 p-1 bg-gray-100 rounded"><Menu size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView 
              projects={projects} users={users} myCount={myProjectCount} isAdmin={isAdmin}
              schedules={schedules} logs={logs} openScheduleModal={()=>toggleModal('schedule')} 
              deleteSchedule={(id) => requestConfirm('刪除檔期', '確定要刪除此活動檔期嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', id)); showToast(setToast, '已刪除'); })}
            />}
            
            {activeTab === 'projects' && <ProjectsView 
              projects={projects} users={users} currentUser={currentUserProfile} isAdmin={isAdmin}
              onAdd={()=>{setFormData({title:'', description:'', urgency:'normal', assignedTo:''}); toggleModal('project');}}
              onSelect={setSelectedProject}
              onDelete={(id, title) => requestConfirm('刪除專案', `確定要刪除專案「${title}」嗎？此操作無法復原。`, async () => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id)); showToast(setToast, '已刪除'); } catch(e) { console.error(e); } })}
              notifications={notifications}
            />}

            {activeTab === 'member_changes' && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
                    <div className="flex justify-between mb-6 md:mb-8 items-center">
                        <h2 className="text-xl md:text-2xl font-bold border-l-[6px] border-theme pl-4 text-gray-800">會員資料異動</h2>
                        <button onClick={()=>{setFormData({cardId:'', changeType: MEMBER_CHANGE_TYPES[0], note:''}); toggleModal('memberChange');}} className="bg-theme text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={18}/>新增</button>
                    </div>
                    
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">申請日期</th>
                                    <th className="px-6 py-4">申請人</th>
                                    <th className="px-6 py-4">會員卡號</th>
                                    <th className="px-6 py-4">異動類型</th>
                                    <th className="px-6 py-4">備註 / 新資料</th>
                                    <th className="px-6 py-4">狀態</th>
                                    <th className="px-6 py-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {memberChangeRequests.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 font-mono">{formatDate(r.createdAt)}</td>
                                        <td className="px-6 py-4 font-bold text-gray-700">{r.requesterName}</td>
                                        <td className="px-6 py-4 font-mono text-gray-600 bg-gray-50 px-2 rounded inline-block my-2">{r.cardId}</td>
                                        <td className="px-6 py-4 text-gray-700"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{r.changeType}</span></td>
                                        <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{r.note}</td>
                                        <td className="px-6 py-4"><StatusBadge status={r.status}/></td>
                                        <td className="px-6 py-4 text-right">
                                            {isAdmin && r.status === 'pending' && <button onClick={async()=>{
                                                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'member_change_requests', r.id), { status: 'approved', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() });
                                                await sendNotification(r.requesterId, 'system', `您的會員異動申請（卡號：${r.cardId}）已核准`);
                                                showToast(setToast, '已處理');
                                            }} className="text-theme font-bold hover:text-white hover:bg-theme px-3 py-1.5 rounded-lg transition-all text-xs border border-theme/20 mr-2">已處理</button>}
                                            {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && (
                                                <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'member_change_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-all"><Undo2 size={16}/></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {memberChangeRequests.map(r => (
                            <MobileRequestCard 
                                key={r.id} 
                                title={r.changeType} 
                                status={r.status} 
                                meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                                actions={
                                    <>
                                        {isAdmin && r.status === 'pending' && <button onClick={async()=>{ await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'member_change_requests', r.id), { status: 'approved', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() }); await sendNotification(r.requesterId, 'system', `您的會員異動申請（卡號：${r.cardId}）已核准`); showToast(setToast, '已處理'); }} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">已處理</button>}
                                        {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'member_change_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}
                                    </>
                                }
                            >
                                <div className="flex justify-between mb-1"><span className="text-gray-400">卡號</span><span className="font-mono font-bold text-gray-800">{r.cardId}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">備註</span><span className="text-gray-800 text-right">{r.note || '-'}</span></div>
                            </MobileRequestCard>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'point_requests' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
                <div className="flex justify-between mb-6 md:mb-8 items-center">
                  <h2 className="text-xl md:text-2xl font-bold border-l-[6px] border-theme pl-4 text-gray-800">點數補點申請</h2>
                  <button onClick={()=>{setFormData({memberIdentifier:'', points:''}); toggleModal('point');}} className="bg-theme text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={18}/>申請</button>
                </div>
                
                {/* Desktop Table */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">申請人</th><th className="px-6 py-4">會員</th><th className="px-6 py-4">點數</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">{pointRequests.map(r=><tr key={r.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 text-gray-500 font-mono">{formatDate(r.createdAt)}</td><td className="px-6 py-4 font-bold text-gray-700">{r.requesterName}</td><td className="px-6 py-4 font-mono text-gray-600">{r.memberIdentifier}</td><td className="px-6 py-4 text-theme font-bold text-lg">{r.points}</td><td className="px-6 py-4"><StatusBadge status={r.status}/></td>
                    <td className="px-6 py-4 text-right">
                        {isAdmin && r.status === 'pending' && <button onClick={async()=>{ await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'point_requests', r.id), { status: 'approved', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() }); await sendNotification(r.requesterId, 'system', `您的補點申請（會員：${r.memberIdentifier}）已核准`); showToast(setToast, '已核准'); }} className="text-theme font-bold hover:text-white hover:bg-theme px-3 py-1.5 rounded-lg transition-all text-xs border border-theme/20 mr-2">核准</button>}
                        {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'point_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-all"><Undo2 size={16}/></button>}
                    </td></tr>)}</tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {pointRequests.map(r => (
                        <MobileRequestCard 
                            key={r.id} 
                            title={`${r.points} 點`}
                            status={r.status} 
                            meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                            actions={
                                <>
                                    {isAdmin && r.status === 'pending' && <button onClick={async()=>{ await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'point_requests', r.id), { status: 'approved', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() }); await sendNotification(r.requesterId, 'system', `您的補點申請（會員：${r.memberIdentifier}）已核准`); showToast(setToast, '已核准'); }} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">核准</button>}
                                    {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'point_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}
                                </>
                            }
                        >
                            <div className="flex justify-between"><span className="text-gray-400">會員帳號</span><span className="font-mono font-bold text-gray-800">{r.memberIdentifier}</span></div>
                        </MobileRequestCard>
                    ))}
                </div>
              </div>
            )}
            
            {activeTab === 'voucher_requests' && (
               <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
                 <div className="flex flex-col md:flex-row justify-between mb-6 md:mb-8 items-start md:items-center gap-4">
                   <h2 className="text-xl md:text-2xl font-bold border-l-[6px] border-theme pl-4 text-gray-800">電子券申請</h2>
                   <div className="flex gap-3 w-full md:w-auto">
                     {isAdmin && <button onClick={()=>toggleModal('inventory')} className="flex-1 md:flex-none bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition text-center">庫存 ({voucherPool.filter(v=>!v.isUsed).length})</button>}
                     <button onClick={()=>{setFormData({reason:VOUCHER_REASONS[0]}); toggleModal('voucher');}} className="flex-1 md:flex-none bg-theme text-white px-5 py-2.5 rounded-xl font-bold text-sm flex justify-center items-center gap-2 hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={18}/>申請</button>
                   </div>
                 </div>
                 
                 {/* Desktop Table */}
                 <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">申請人</th><th className="px-6 py-4">原因</th><th className="px-6 py-4">狀態</th><th className="px-6 py-4">券號</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">{voucherRequests.map(r=><tr key={r.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 text-gray-500 font-mono">{formatDate(r.createdAt)}</td><td className="px-6 py-4 font-bold text-gray-700">{r.requesterName}</td><td className="px-6 py-4 text-gray-600">{r.reason}</td><td className="px-6 py-4"><StatusBadge status={r.status}/></td><td className="px-6 py-4 font-mono font-bold text-theme tracking-wide">{r.assignedCode||'-'}</td>
                    <td className="px-6 py-4 text-right">
                        {isManagerOrAdmin && r.status==='pending' && (
                            <div className="flex justify-end gap-2">
                                <button onClick={async()=>{ const code = voucherPool.find(v=>!v.isUsed); if(!code) return showToast(setToast, '無庫存', 'error'); const batch = writeBatch(db); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id), { status:'approved', assignedCode:code.code, approvedBy:currentUserProfile.displayName }); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_pool', code.id), { isUsed:true, assignedToRequestId:r.id }); await batch.commit(); await sendNotification(r.requesterId, 'system', `您的電子券申請已核准，券號：${code.code}`); showToast(setToast, '已核准'); }} className="text-white bg-theme hover:bg-[#005a26] px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm">核准</button>
                                <button onClick={() => requestConfirm('駁回申請', '確定要駁回此申請嗎？', async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id), { status: 'rejected', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() }); await sendNotification(r.requesterId, 'system', `您的電子券申請已被駁回`); showToast(setToast, '已駁回'); })} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold border border-red-200">駁回</button>
                            </div>
                        )}
                        {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && (
                            <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-all"><Undo2 size={16}/></button>
                        )}
                    </td></tr>)}</tbody>
                    </table>
                 </div>

                 {/* Mobile Card View */}
                 <div className="md:hidden space-y-3">
                    {voucherRequests.map(r => (
                        <MobileRequestCard 
                            key={r.id} 
                            title={r.reason} 
                            status={r.status} 
                            meta={`${formatDate(r.createdAt)} • ${r.requesterName}`}
                            actions={
                                <>
                                    {isManagerOrAdmin && r.status === 'pending' && (
                                        <div className="flex gap-2 w-full">
                                            <button onClick={async()=>{ const code = voucherPool.find(v=>!v.isUsed); if(!code) return showToast(setToast, '無庫存', 'error'); const batch = writeBatch(db); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id), { status:'approved', assignedCode:code.code, approvedBy:currentUserProfile.displayName }); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_pool', code.id), { isUsed:true, assignedToRequestId:r.id }); await batch.commit(); await sendNotification(r.requesterId, 'system', `您的電子券申請已核准，券號：${code.code}`); showToast(setToast, '已核准'); }} className="flex-1 bg-theme text-white py-2 rounded-lg text-sm font-bold">核准</button>
                                            <button onClick={() => requestConfirm('駁回申請', '確定要駁回此申請嗎？', async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id), { status: 'rejected', approvedBy: currentUserProfile.displayName, completedAt: serverTimestamp() }); await sendNotification(r.requesterId, 'system', `您的電子券申請已被駁回`); showToast(setToast, '已駁回'); })} className="flex-1 bg-red-50 text-red-600 border border-red-100 py-2 rounded-lg text-sm font-bold">駁回</button>
                                        </div>
                                    )}
                                    {r.requesterId === currentUserProfile.employeeId && r.status === 'pending' && <button onClick={() => requestConfirm('撤銷申請', '確定要撤銷此申請嗎？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voucher_requests', r.id)); showToast(setToast, '申請已撤銷'); })} className="flex-1 bg-gray-100 text-red-500 py-2 rounded-lg text-sm font-bold">撤銷</button>}
                                </>
                            }
                        >
                            <div className="flex justify-between items-center"><span className="text-gray-400">配發券號</span><span className="font-mono font-bold text-theme text-lg">{r.assignedCode || '待分配'}</span></div>
                        </MobileRequestCard>
                    ))}
                 </div>
               </div>
            )}

            {activeTab === 'users' && isAdmin && (
               <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
                 <div className="flex justify-between mb-6 md:mb-8 items-center">
                   <h2 className="text-xl md:text-2xl font-bold border-l-[6px] border-theme pl-4 text-gray-800">用戶管理</h2>
                   <button onClick={()=>{setEditingUser(null); setFormData({displayName:'', employeeId:'', department:'企劃', role:'user', email:'', password: ''}); toggleModal('user');}} className="bg-theme text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#005a26] transition shadow-lg shadow-theme/20"><Plus size={18}/>新增</button>
                 </div>
                 {/* Desktop Table */}
                 <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100"><tr><th className="px-6 py-4">姓名</th><th className="px-6 py-4">編號</th><th className="px-6 py-4">部門</th><th className="px-6 py-4">角色</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">{users.map(u=><tr key={u.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">{u.displayName[0]}</div>
                        {u.displayName}
                    </td><td className="px-6 py-4 font-mono text-gray-600">{u.employeeId}</td><td className="px-6 py-4"><span className="bg-gray-100 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600">{getDepartmentLabel(u.department)}</span></td><td className="px-6 py-4 text-gray-600">{u.role}</td><td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={()=>{setEditingUser(u); setFormData(u); toggleModal('user');}} className="text-gray-400 hover:text-theme p-2 rounded-lg hover:bg-gray-100 transition-colors"><Edit size={18}/></button>
                        <button onClick={() => requestConfirm('刪除用戶', '確定要刪除此用戶嗎？此操作無法復原。', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', u.id)); showToast(setToast, '用戶已刪除'); })} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18}/></button>
                    </td></tr>)}</tbody>
                    </table>
                 </div>
                 {/* Mobile List */}
                 <div className="md:hidden space-y-3">
                     {users.map(u => (
                         <div key={u.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">{u.displayName[0]}</div>
                                 <div>
                                     <div className="font-bold text-gray-800">{u.displayName}</div>
                                     <div className="text-xs text-gray-500 font-mono">{u.employeeId} • {getDepartmentLabel(u.department)}</div>
                                 </div>
                             </div>
                             <div className="flex gap-1">
                                <button onClick={()=>{setEditingUser(u); setFormData(u); toggleModal('user');}} className="p-2 text-gray-400 hover:text-theme bg-gray-50 rounded-lg"><Edit size={18}/></button>
                                <button onClick={() => requestConfirm('刪除用戶', '確定刪除？', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', u.id)); })} className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
               </div>
            )}
          </div>
        </div>

        {/* --- Modals --- */}
        <Modal isOpen={modals.project} onClose={()=>toggleModal('project', false)} title="新增專案">
          <div className="space-y-5">
             {/* ... Inputs ... */}
             <div>
                 <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">專案名稱</label>
                 <input className="w-full border border-gray-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme transition-all bg-gray-50 focus:bg-white text-base" placeholder="輸入專案名稱" value={formData.title||''} onChange={e=>setFormData({...formData, title:e.target.value})} />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">描述</label>
                 <textarea className="w-full border border-gray-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-theme/50 focus:border-theme h-32 transition-all bg-gray-50 focus:bg-white text-base" placeholder="輸入專案描述..." value={formData.description||''} onChange={e=>setFormData({...formData, description:e.target.value})} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div>
                   <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">指派給 (必選)</label>
                   <select className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-theme/50 transition-all text-base" value={formData.assignedTo||''} onChange={e=>setFormData({...formData, assignedTo:e.target.value})}>
                     <option value="">選擇負責人</option>{users.map(u=><option key={u.id} value={u.employeeId}>{u.displayName} ({getDepartmentLabel(u.department)})</option>)}
                   </select>
               </div>
               <div>
                   <label className="text-xs font-bold text-gray-500 mb-1.5 block ml-1">緊急程度</label>
                   <select className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-theme/50 transition-all text-base" value={formData.urgency||'normal'} onChange={e=>setFormData({...formData, urgency:e.target.value})}>
                     <option value="normal">正常</option><option value="urgent">緊急</option><option value="very_urgent">非常緊急</option>
                   </select>
               </div>
             </div>
             <button onClick={async()=>{
               if(!formData.assignedTo) return showToast(setToast, '請選擇負責人', 'error');
               const assignee = users.find(u=>u.employeeId===formData.assignedTo);
               
               // Fix: Ensure assignedToEmployeeId is correctly set
               const newProjectData = {
                   ...formData, 
                   assignedToEmployeeId: formData.assignedTo, // Explicitly set ID
                   status:'active', 
                   assignedToName: assignee?.displayName||'未指派', 
                   createdBy:currentUserProfile.employeeId, 
                   creatorName:currentUserProfile.displayName
               };
               const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), { ...newProjectData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
               
               if(assignee) {
                   await sendNotification(assignee.uid, 'assignment', `${currentUserProfile.displayName} 將新專案「${formData.title}」指派給了您`, docRef.id);
               }
               showToast(setToast, '專案已建立');
               toggleModal('project', false);
             }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg shadow-theme/20 mt-2 text-lg">建立專案</button>
          </div>
        </Modal>

        <Modal isOpen={modals.schedule} onClose={()=>toggleModal('schedule', false)} title="新增檔期">
          <div className="space-y-5">
             <input className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" placeholder="檔期名稱" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} />
             <div className="grid grid-cols-2 gap-4"><input type="date" className="border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" value={formData.startDate||''} onChange={e=>setFormData({...formData, startDate:e.target.value})} /><input type="date" className="border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" value={formData.endDate||''} onChange={e=>setFormData({...formData, endDate:e.target.value})} /></div>
             <button onClick={async()=>{ await genericAdd('schedules', formData, '檔期已新增'); toggleModal('schedule', false); }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg text-lg">新增</button>
          </div>
        </Modal>

        <Modal isOpen={modals.memberChange} onClose={()=>toggleModal('memberChange', false)} title="會員資料異動申請">
           <div className="space-y-5">
             <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 border border-blue-100 font-medium">申請人: {currentUserProfile.displayName} (自動帶入)</div>
             <input className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" placeholder="會員卡號 (請手動輸入)" value={formData.cardId||''} onChange={e=>setFormData({...formData, cardId:e.target.value})} />
             <select className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" value={formData.changeType||''} onChange={e=>setFormData({...formData, changeType:e.target.value})}>
                {MEMBER_CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
             <textarea className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none h-32 text-base" placeholder="變更內容 / 備註 (例如: 新手機號碼 0912...)" value={formData.note||''} onChange={e=>setFormData({...formData, note:e.target.value})} />
             <button onClick={async()=>{ 
                 if(!formData.cardId) return showToast(setToast, '請輸入卡號', 'error');
                 await genericAdd('member_change_requests', {...formData, requesterId:currentUserProfile.employeeId, requesterName:currentUserProfile.displayName, status:'pending'}, '申請已提交'); 
                 await notifyGroup(users, u => u.role === 'admin', 'system', `${currentUserProfile.displayName} 提交了會員異動申請`);
                 toggleModal('memberChange', false); 
             }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg text-lg">提交申請</button>
           </div>
        </Modal>

        <Modal isOpen={modals.point} onClose={()=>toggleModal('point', false)} title="補點申請">
           <div className="space-y-5">
             <input className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" placeholder="會員卡號/電話" value={formData.memberIdentifier||''} onChange={e=>setFormData({...formData, memberIdentifier:e.target.value})} />
             <input type="number" className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" placeholder="補點點數" value={formData.points||''} onChange={e=>setFormData({...formData, points:e.target.value})} />
             <button onClick={async()=>{ 
                 await genericAdd('point_requests', {...formData, requesterId:currentUserProfile.employeeId, requesterName:currentUserProfile.displayName, status:'pending'}, '已提交'); 
                 await notifyGroup(users, u => u.role === 'admin', 'system', `${currentUserProfile.displayName} 提交了補點申請 (${formData.points}點)`);
                 toggleModal('point', false); 
             }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg text-lg">提交</button>
           </div>
        </Modal>

        <Modal isOpen={modals.voucher} onClose={()=>toggleModal('voucher', false)} title="電子券申請">
           <div className="space-y-5">
             <select className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" value={formData.reason||''} onChange={e=>setFormData({...formData, reason:e.target.value})}>{VOUCHER_REASONS.map(r=><option key={r} value={r}>{r}</option>)}</select>
             <button onClick={async()=>{ 
                 await genericAdd('voucher_requests', {reason:formData.reason, requesterId:currentUserProfile.employeeId, requesterName:currentUserProfile.displayName, department:currentUserProfile.department, status:'pending'}, '已申請'); 
                 await notifyGroup(users, u => u.role === 'manager' || u.role === 'admin', 'system', `${currentUserProfile.displayName} 提交了電子券申請`);
                 toggleModal('voucher', false); 
             }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg text-lg">提交</button>
           </div>
        </Modal>

        <Modal isOpen={modals.inventory} onClose={()=>toggleModal('inventory', false)} title="庫存管理">
          <div className="space-y-5">
            <div className="flex gap-2"><input className="flex-1 border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-theme/50 text-base" placeholder="新增券號 (逗號分隔)" value={formData.codes||''} onChange={e=>setFormData({...formData, codes:e.target.value})} /><button onClick={handleAddVoucherCodes} className="bg-theme text-white px-5 rounded-xl font-bold hover:bg-[#005a26] transition">新增</button></div>
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl custom-scrollbar"><table className="w-full text-left text-sm"><tbody className="divide-y divide-gray-100">{voucherPool.map(v=><tr key={v.id}><td className="p-3 font-mono text-gray-600">{v.code}</td><td className="p-3 text-right">{v.isUsed?<span className="text-red-500 bg-red-50 px-2 py-1 rounded text-xs font-bold">已用</span>:<span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">可用</span>}</td></tr>)}</tbody></table></div>
          </div>
        </Modal>

        <Modal isOpen={modals.user} onClose={()=>toggleModal('user', false)} title={editingUser?"編輯用戶":"新增用戶"}>
           <div className="space-y-5">
              <input className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" placeholder="姓名" value={formData.displayName||''} onChange={e=>setFormData({...formData, displayName:e.target.value})} />
              <input className={`w-full border border-gray-200 rounded-xl p-4 outline-none text-base ${editingUser?'bg-gray-100 text-gray-500':'bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50'}`} placeholder="員工編號" readOnly={!!editingUser} value={formData.employeeId||''} onChange={e=>setFormData({...formData, employeeId:e.target.value})} />
              <input className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-theme/50 outline-none text-base" type="password" placeholder={editingUser ? "重設密碼 (若不更改請留空)" : "設定密碼"} value={formData.password||''} onChange={e=>setFormData({...formData, password:e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white outline-none text-base" value={formData.department||''} onChange={e=>setFormData({...formData, department:e.target.value})}>{DEPARTMENTS.map(d=><option key={d} value={d}>{getDepartmentLabel(d)}</option>)}</select>
                <select className="border border-gray-200 rounded-xl p-4 bg-gray-50 focus:bg-white outline-none text-base" value={formData.role||'user'} onChange={e=>setFormData({...formData, role:e.target.value})}><option value="user">一般</option><option value="manager">主管</option><option value="admin">管理員</option></select>
              </div>
              <button onClick={async()=>{
                if(editingUser) { 
                    const updateData = {...formData};
                    if(!updateData.password) delete updateData.password; // Don't overwrite if empty
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', editingUser.id), updateData); 
                    showToast(setToast, '已更新'); 
                }
                else { 
                    if(!formData.password) { showToast(setToast, '請設定密碼', 'error'); return; }
                    const uid='user_'+Date.now(); 
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', uid), {...formData, uid, isOnline:false}); 
                    showToast(setToast, '已建立'); 
                }
                toggleModal('user', false);
              }} className="w-full bg-theme text-white font-bold py-4 rounded-xl hover:bg-[#005a26] transition shadow-lg text-lg">儲存</button>
           </div>
        </Modal>

        <Modal isOpen={modals.changelog} onClose={()=>toggleModal('changelog', false)} title="系統版本更新紀錄">
            <div className="space-y-8 pl-2">
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
        {toast.show && <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-2xl shadow-2xl z-[10000] animate-fade-in flex items-center gap-3 font-bold ${toast.type==='error'?'bg-red-500':'bg-emerald-600'}`}>
            {toast.type==='error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
            {toast.message}
        </div>}
      </main>
    </div>
  );

}

