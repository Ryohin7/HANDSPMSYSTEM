import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './project' // 這裡引入您的 project.jsx
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
