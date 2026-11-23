import { lazy, Suspense, useEffect } from "react"
import { Routes, Route, useNavigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { SocketProvider } from "@/contexts/SocketContext"
import { setNavigateFn } from "@/lib/navigation"
import AuthGuard from "@/components/AuthGuard"
import Layout from "@/components/Layout"
import { Loader2 } from "lucide-react"

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"))
const SetupPage = lazy(() => import("@/pages/auth/SetupPage"))
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const ProductListPage = lazy(() => import("@/pages/products/ProductListPage"))
const ProductFormPage = lazy(() => import("@/pages/products/ProductFormPage"))
const SalesListPage = lazy(() => import("@/pages/sales/SalesListPage"))
const UserListPage = lazy(() => import("@/pages/users/UserListPage"))
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"))
const DiscountHistoryPage = lazy(() => import("@/pages/discounts/DiscountHistoryPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route element={<AuthGuard />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/products" element={<ProductListPage />} />
                <Route path="/sales" element={<SalesListPage />} />
              </Route>
              <Route element={<AuthGuard roles={["admin"]} />}>
                <Route element={<Layout />}>
                  <Route path="/products/new" element={<ProductFormPage />} />
                  <Route path="/products/:id/edit" element={<ProductFormPage />} />
                  <Route path="/discounts" element={<DiscountHistoryPage />} />
                  <Route path="/users" element={<UserListPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </SocketProvider>
    </AuthProvider>
  )
}
