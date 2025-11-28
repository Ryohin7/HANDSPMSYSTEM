import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

export const useSystemData = (authUser, userProfile) => {
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
      { key: 'notifications', path: 'notifications', sort: 'createdAt', filter: (d) => userProfile && d.targetUserId === userProfile.uid },
      { key: 'pointRequests', path: 'point_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'voucherRequests', path: 'voucher_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'memberChangeRequests', path: 'member_change_requests', sort: 'createdAt', filter: personalFilter },
      { key: 'voucherPool', path: 'voucher_pool' }
    ];

    const unsubs = collections.map(({ key, path, sort, isDate, filter }) => 
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', path), (snap) => {
        // --- Web Push Logic (Simplified) ---
        if (key === 'notifications') {
            snap.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const notifData = change.doc.data();
                    const now = Date.now();
                    const notifTime = notifData.createdAt?.toMillis ? notifData.createdAt.toMillis() : now;
                    // Only notify if within last 10 seconds
                    if (userProfile && notifData.targetUserId === userProfile.uid && (now - notifTime) < 10000 && Notification.permission === 'granted') {
                        try { new Notification('Hands PM System', { body: notifData.message, icon: '/vite.svg', tag: change.doc.id }); } catch (e) {}
                    }
                }
            });
        }

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
