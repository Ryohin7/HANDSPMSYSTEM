import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './project.jsx' // 引用您剛剛改名的檔案
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
