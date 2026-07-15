import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import authStore from './store/authStore'
import { authAPI } from './api'

const Home = React.lazy(() => import('./pages/Home'))
const Auth = React.lazy(() => import('./pages/Auth'))
const SOPGenerator = React.lazy(() => import('./pages/SOPGenerator'))
const SOPEditor = React.lazy(() => import('./pages/SOPEditor'))
const SOPExecutor = React.lazy(() => import('./pages/SOPExecutor'))
const SOPList = React.lazy(() => import('./pages/SOPList'))
const Invite = React.lazy(() => import('./pages/Invite'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Onboarding = React.lazy(() => import('./pages/Onboarding'))

function App() {
  const { isAuthenticated, login, logout, showOnboarding } = authStore()
  const profileLoadedRef = useRef(false)

  useEffect(() => {
    if (isAuthenticated && !profileLoadedRef.current) {
      profileLoadedRef.current = true
      authAPI.getProfile()
        .then((user) => {
          login(user, localStorage.getItem('lifeflow_token'))
        })
        .catch(() => {
          profileLoadedRef.current = false
          logout()
        })
    }
    if (!isAuthenticated) {
      profileLoadedRef.current = false
    }
  }, [isAuthenticated])

  const PrivateRoute = ({ children }) => {
    return isAuthenticated ? children : <Navigate to="/auth" />
  }

  const PublicRoute = ({ children }) => {
    return !isAuthenticated ? children : <Navigate to="/" />
  }

  const OnboardingRoute = ({ children }) => {
    if (!isAuthenticated) return <Navigate to="/auth" />
    if (showOnboarding) return children
    return <Navigate to="/" />
  }

  return (
    <div className="app">
      <React.Suspense fallback={<div className="loading">加载中...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/generate" element={<PrivateRoute><SOPGenerator /></PrivateRoute>} />
          <Route path="/editor/:id?" element={<PrivateRoute><SOPEditor /></PrivateRoute>} />
          <Route path="/execute/:id" element={<PrivateRoute><SOPExecutor /></PrivateRoute>} />
          <Route path="/sops" element={<PrivateRoute><SOPList /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </React.Suspense>
    </div>
  )
}

export default App
