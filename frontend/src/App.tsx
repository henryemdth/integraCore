import { useEffect } from "react"
import { Routes, Route, useNavigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { SocketProvider } from "@/contexts/SocketContext"
import { setNavigateFn } from "@/lib/navigation"
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
import DiscountHistoryPage from "@/pages/discounts/DiscountHistoryPage"
import NotFoundPage from "@/pages/NotFoundPage"

// Hands the router's navigate to the navigation singleton so non-component
// code (e.g. the axios 401 interceptor) can redirect without touching the URL.
function NavigateRegistrar() {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigateFn(navigate)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigateRegistrar />
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
            </Route>
            <Route element={<AuthGuard roles={["admin"]} />}>
              <Route element={<Layout />}>
                <Route path="/discounts" element={<DiscountHistoryPage />} />
                <Route path="/users" element={<UserListPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  )
}
