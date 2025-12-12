import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { LandingPage } from './components/LandingPage'
import { GitHubLeaderboard } from './components/GitHubLeaderboard'
import { UserProfile } from './components/UserProfile'
import { GitHubCallback } from './components/GitHubCallback'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<App />} />
          <Route path="/gitrank" element={<GitHubLeaderboard />} />
          <Route path="/gitrank/:username" element={<UserProfile />} />
          <Route path="/auth/callback" element={<GitHubCallback />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
