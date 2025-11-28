import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 請確認這裡的設定與您原本的一致
const firebaseConfig = {
  apiKey: "AIzaSyC6AOjDsuIbSjTMVqvVDTCu8gO_FTz9jrM",
  authDomain: "handspmsystem.firebaseapp.com",
  projectId: "handspmsystem",
  // 其他需要的欄位...
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'default-app-id'; // 若有環境變數可替換此處
