import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FolderKanban, LogIn, UserPlus, ArrowRightLeft, Mail, Lock, UserCircle, KeyRound } from 'lucide-react';
import { auth, db, appId } from '../lib/firebase';
import { APP_VERSION, DEPARTMENTS, getDepartmentLabel, sendNotification, addLog } from '../lib/utils';

const AuthView = ({ onLoginSuccess, onToast, usersCount }) => {
    const [mode, setMode] = useState('login');
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerData, setRegisterData] = useState({ name: '', employeeId: '', email: '', department: '企劃', password: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        const cleanId = loginId.trim();
        const cleanPassword = loginPassword.trim();
        
        if(!cleanId || !cleanPassword) return onToast('請輸入完整的帳號與密碼', 'error');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, `${cleanId}@hands.com`, cleanPassword);
            const user = userCredential.user;
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const userData = docSnap.data();
                await updateDoc(docRef, { lastActive: serverTimestamp(), isOnline: true });
                onLoginSuccess(userData);
                onToast('登入成功');
            } else {
                onToast('帳號驗證成功，但找不到員工資料', 'error');
            }
        } catch (error) {
            console.error("Login Error:", error);
            onToast('員工編號或密碼錯誤 (或帳號未註冊)', 'error');
            await addLog(null, '登入失敗', `ID: ${cleanId} 嘗試登入失敗`);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const cleanId = registerData.employeeId.trim();
        const cleanPassword = registerData.password.trim();
        const cleanName = registerData.name.trim();

        if (cleanPassword.length < 6 || cleanPassword.length > 12) return onToast('密碼長度需為 6~12 位數', 'error');
        if(!cleanName || !cleanId) return onToast('請填寫完整資料', 'error');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, `${cleanId}@hands.com`, cleanPassword);
            const user = userCredential.user;
            const isFirstRun = usersCount === 0; 
            const role = isFirstRun ? 'admin' : 'user';

            const userData = { 
                uid: user.uid, displayName: cleanName, employeeId: cleanId, email: registerData.email,
                department: registerData.department, role: role, isOnline: true, 
                lastActive: serverTimestamp(), createdAt: serverTimestamp() 
            };
            
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_metadata', user.uid), userData);
            await sendNotification(user.uid, 'system', `歡迎加入！您的員工編號為：${cleanId}，預設權限為：${role === 'admin' ? '管理員' : '一般用戶'}`);
            await addLog(userData, '系統註冊', `${cleanName} 註冊了帳號 (角色: ${role})`);
            
            onLoginSuccess(userData);
            onToast('註冊成功，已自動登入');
        } catch (error) {
            console.error(error);
            onToast('註冊失敗: ' + error.message, 'error');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 transition-all duration-300">
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#007130] to-[#004d21] rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-theme/30 transform rotate-3"><FolderKanban size={48} /></div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">台隆手創館</h1>
                    <h2 className="text-gray-400 font-medium tracking-wide">專案管理系統 {APP_VERSION}</h2>
                </div>

                {mode === 'login' ? (
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
                        <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-400 font-medium">首次登入請先註冊</span></div></div>
                        <button type="button" onClick={() => setMode('register')} className="w-full bg-white border-2 border-gray-100 text-gray-600 font-bold py-3.5 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"><UserPlus size={20} /> 員工註冊</button>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-2"><button type="button" onClick={() => setMode('login')} className="p-1 -ml-1 text-gray-400 hover:text-theme transition-colors"><ArrowRightLeft size={20}/></button>員工註冊</div>
                        <input className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50" placeholder="姓名" value={registerData.name} onChange={e=>setRegisterData({...registerData, name:e.target.value})} required />
                        <div className="relative"><input type="email" className="w-full border border-gray-200 rounded-2xl p-4 pl-12 outline-none focus:ring-2 focus:ring-theme/50" placeholder="電子信箱 (用於接收通知)" value={registerData.email} onChange={e=>setRegisterData({...registerData, email:e.target.value})} /><Mail className="absolute left-4 top-4 text-gray-400" size={20} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <input className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50" placeholder="員工編號" value={registerData.employeeId} onChange={e=>setRegisterData({...registerData, employeeId:e.target.value.replace(/\D/g, '')})} maxLength={6} required />
                            <select className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-theme/50 appearance-none" value={registerData.department} onChange={e=>setRegisterData({...registerData, department:e.target.value})}>{DEPARTMENTS.map(d=><option key={d} value={d}>{getDepartmentLabel(d)}</option>)}</select>
                        </div>
                        <div className="relative"><input type="password" className="w-full border border-gray-200 rounded-2xl p-4 pl-12 outline-none focus:ring-2 focus:ring-theme/50" placeholder="設定登入密碼 (6-12位)" value={registerData.password} onChange={e=>setRegisterData({...registerData, password:e.target.value})} required /><Lock className="absolute left-4 top-4 text-gray-400" size={20} /></div>
                        <button type="submit" className="w-full bg-gradient-to-r from-[#007130] to-[#005a26] text-white font-bold py-4 rounded-2xl hover:shadow-xl transition text-lg">完成註冊並登入</button>
                        <button type="button" onClick={() => setMode('login')} className="w-full text-gray-400 text-sm font-medium hover:text-gray-600 transition">返回登入</button>
                    </form>
                )}
            </div>
        </div>
    );
};
export default AuthView;
