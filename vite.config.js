import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // 策略 1: 提高警告門檻到 1500 KB
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 策略 2: 手動拆分程式碼區塊 (Code Splitting)
        manualChunks: {
          // 將 React 核心拆分為獨立區塊
          'react-vendor': ['react', 'react-dom'],
          // 將 Firebase 拆分為獨立區塊 (這是通常最大的部分)
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // 將 UI 圖示庫拆分
          'ui-vendor': ['lucide-react']
        }
      }
    }
  }
})
