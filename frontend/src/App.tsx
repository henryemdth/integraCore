import { Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { SocketProvider } from "@/contexts/SocketContext"
import AuthGuard from "@/components/AuthGuard"
import Layout from "@/components/Layout"
import LoginPage from "@/pages/auth/LoginPage"
import SetupPage from "@/pages/auth/SetupPage"
import DashboardPage from "@/pages/DashboardPage"
import ProductListPage from "@/pages/products/ProductListPage"
import ProductFormPage from "@/pages/products/ProductFormPage"
import SalesListPage from "@/pages/sales/SalesListPage"
import UserListPage from "@/pages/users/UserListPage"
import SettingsPage from "@/pages/settings/SettingsPage"
import NotFoundPage from "@/pages/NotFoundPage"

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
              <Route path="/sales" element={<SalesListPage />} />
              <Route path="/users" element={<UserListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  )
}
