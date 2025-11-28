import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from './firebase';

// --- Constants ---
export const APP_VERSION = 'v3.0.0 Modular';
export const THEME_COLOR = '#007130';
export const DEPARTMENTS = ['企劃', '設計', '採購', '營業', '資訊', '營運'];
export const VOUCHER_REASONS = ['活動結束退換貨補券', '客訴或個案', '其他'];
export const MEMBER_CHANGE_TYPES = ['變更手機號碼', '變更生日', '刪除會員', '其他'];
export const DEPARTMENT_ICONS = { 
  '企劃': '📝', '設計': '🎨', '採購': '🛍️', 
  '營業': '🏪', '資訊': '💻', '營運': '⚙️' 
};

export const CHANGELOGS = [
    { version: 'v3.0.0', date: '2025-06-09', content: ['系統重構：功能模組化', '優化元件結構，提升效能與可維護性'] },
    { version: 'v2.3.1', date: '2025-06-08', content: ['修復 Vercel 部署語法錯誤', '確保登入頁面與主程式結構分離'] },
];

// --- Helpers ---
export const formatTime = (ts) => !ts ? '剛剛' : new Date(ts.toDate?.() || ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDate = (ts) => !ts ? '...' : new Date(ts.toDate?.() || ts).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
export const getDepartmentLabel = (dept) => `${DEPARTMENT_ICONS[dept] || '🏢'} ${dept}`;

export const getDaysDiff = (targetDate) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(targetDate); target.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export const getScheduleEmoji = (name) => {
    if (!name) return '📅';
    if (name.includes('春')||name.includes('年')) return '🧧'; 
    if (name.includes('母')) return '🌹'; 
    if (name.includes('父')) return '👔';
    if (name.includes('聖誕')) return '🎄'; 
    if (name.includes('夏')) return '☀️'; 
    if (name.includes('購')) return '🛍️'; 
    return '📅';
};

// --- Log & Notification ---
export const sendNotification = async (targetUid, type, message, linkId = null) => {
    if (!targetUid) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
            targetUserId: targetUid, type, message, linkProjectId: linkId, read: false, createdAt: serverTimestamp()
        });
    } catch (e) { console.error("Notification Error:", e); }
};

export const notifyGroup = async (users, roleFilter, type, message) => {
    const targets = users.filter(roleFilter);
    for (const user of targets) {
        await sendNotification(user.uid, type, message);
    }
};

export const addLog = async (currentUser, action, details) => {
    try { 
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
            action, details, 
            userId: currentUser?.uid || 'system', 
            userName: currentUser?.displayName || 'System', 
            timestamp: serverTimestamp()
        }); 
    } catch(e) {}
};
