import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import VerifyOtpPage from '@/pages/VerifyOtpPage'
import OnboardingNamePage from '@/pages/OnboardingNamePage'
import OnboardingUserTypePage from '@/pages/OnboardingUserTypePage'
import MainMenuPage from '@/pages/MainMenuPage'
import DashboardPage from '@/pages/DashboardPage'
import ExplorePage from '@/pages/ExplorePage'
import DealRoomsPage from '@/pages/DealRoomsPage'
import DealRoomPage from '@/pages/DealRoomPage'
import ProjectsPage from '@/pages/ProjectsPage'
import FreelancerProfilePage from '@/pages/FreelancerProfilePage'
import FreelancerOnboardingPage from '@/pages/FreelancerOnboardingPage'
import FreelancerDashboardPage from '@/pages/freelancer/FreelancerDashboardPage'
import FreelancerDealRoomsPage from '@/pages/freelancer/FreelancerDealRoomsPage'
import FreelancerOpportunitiesPage from '@/pages/freelancer/FreelancerOpportunitiesPage'
import FreelancerMyProfilePage from '@/pages/freelancer/FreelancerMyProfilePage'
import JoinWorkspacePage from '@/pages/JoinWorkspacePage'
import SettingsPage from '@/pages/SettingsPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import TermsPage from '@/pages/TermsPage'
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage'
import ProtectedRoute, { AuthRoute, ClientRoute, FreelancerRoute } from '@/components/ProtectedRoute'


function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/onboarding/name" element={
            <ProtectedRoute>
              <OnboardingNamePage />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/type" element={
            <ProtectedRoute>
              <OnboardingUserTypePage />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/freelancer" element={
            <ProtectedRoute>
              <FreelancerOnboardingPage />
            </ProtectedRoute>
          } />
          {/* Client-only routes */}
          <Route path="/chat" element={
            <ClientRoute>
              <MainMenuPage />
            </ClientRoute>
          } />
          <Route path="/dashboard" element={
            <ClientRoute>
              <DashboardPage />
            </ClientRoute>
          } />
          <Route path="/explore" element={
            <ClientRoute>
              <ExplorePage />
            </ClientRoute>
          } />
          <Route path="/dealrooms" element={
            <ClientRoute>
              <DealRoomsPage />
            </ClientRoute>
          } />
          <Route path="/dealroom" element={
            <ClientRoute>
              <DealRoomPage />
            </ClientRoute>
          } />
          <Route path="/dealroom/:workspaceId" element={
            <ClientRoute>
              <DealRoomPage />
            </ClientRoute>
          } />
          <Route path="/projects" element={
            <ClientRoute>
              <ProjectsPage />
            </ClientRoute>
          } />
          <Route path="/profile/:id" element={
            <ClientRoute>
              <FreelancerProfilePage />
            </ClientRoute>
          } />
          {/* Freelancer routes */}
          <Route path="/freelancer/dashboard" element={
            <FreelancerRoute>
              <FreelancerDashboardPage />
            </FreelancerRoute>
          } />
          <Route path="/freelancer/dealrooms" element={
            <FreelancerRoute>
              <FreelancerDealRoomsPage />
            </FreelancerRoute>
          } />
          <Route path="/freelancer/dealroom" element={
            <FreelancerRoute>
              <DealRoomPage />
            </FreelancerRoute>
          } />
          <Route path="/freelancer/dealroom/:workspaceId" element={
            <FreelancerRoute>
              <DealRoomPage />
            </FreelancerRoute>
          } />
          <Route path="/freelancer/opportunities" element={
            <FreelancerRoute>
              <FreelancerOpportunitiesPage />
            </FreelancerRoute>
          } />
          <Route path="/freelancer/profile" element={
            <FreelancerRoute>
              <FreelancerMyProfilePage />
            </FreelancerRoute>
          } />
          <Route path="/settings" element={
            <AuthRoute>
              <SettingsPage />
            </AuthRoute>
          } />
          <Route path="/join/:token" element={
            <ProtectedRoute>
              <JoinWorkspacePage />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
  )
}

export default App
