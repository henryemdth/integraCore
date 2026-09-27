import { useState, useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react"
import { getErrorMessage } from "@/lib/errorMessages"
import { normalizeForSearch } from "@/lib/text"
import { formatCurrency } from "@/lib/format"

export default function ProductFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [stock, setStock] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState("5")
  const [status, setStatus] = useState<"active" | "discontinued">("active")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/api/products/${id}`)
        .then((res) => {
          const product = res.data.product as Product
          setName(product.name)
          setSku(product.sku)
          setCategory(product.category)
          setPrice(String(product.price))
          setSellPrice(String(product.sell_price))
          setStock(String(product.stock))
          setLowStockThreshold(String(product.low_stock_threshold))
          setStatus(product.status)
        })
        .catch((err: any) => setError(getErrorMessage(err, "products.editForm.notFound")))
        .finally(() => setFetching(false))
    }
  }, [id, isEdit])

  const { data: categories = [] } = useQuery({
    queryKey: ["products", "categories"],
    queryFn: async () => {
      const res = await api.get("/api/products/categories")
      return res.data.categories as string[]
    },
  })

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products", "list-all"],
    queryFn: async () => {
      const res = await api.get("/api/products?limit=10000")
      return res.data.products as Product[]
    },
  })

  // Debounce so the duplicate-name check runs after the user pauses typing.
  const [debouncedName, setDebouncedName] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(name), 400)
    return () => clearTimeout(timer)
  }, [name])

  const duplicateMatches = useMemo(() => {
    const query = normalizeForSearch(debouncedName)
    if (query.length < 2) return []
    const currentId = isEdit ? Number(id) : -1
    return allProducts
      .filter((p) => p.id !== currentId)
      .map((p) => ({ product: p, norm: normalizeForSearch(p.name) }))
      .filter(({ norm }) => norm.includes(query) || query.includes(norm))
      .sort((a, b) => {
        const exactA = a.norm === query ? 0 : 1
        const exactB = b.norm === query ? 0 : 1
        return exactA !== exactB ? exactA - exactB : a.norm.length - b.norm.length
      })
      .slice(0, 3)
  }, [debouncedName, allProducts, isEdit, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const body: Record<string, any> = {
      name,
      sku,
      category,
      price: parseFloat(price),
      sell_price: parseFloat(sellPrice),
      stock: parseInt(stock) || 0,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
    }

    if (isEdit && isAdmin) {
      body.status = status
    }

    try {
      if (isEdit) {
        await api.put(`/api/products/${id}`, body)
      } else {
        await api.post("/api/products", body)
      }
      queryClient.invalidateQueries({ queryKey: ["products"] })
      navigate("/products")
    } catch (err: any) {
      setError(getErrorMessage(err, "products.createForm.failedSave"))
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="w-full">
        <Skeleton className="h-9 w-20 mb-4" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="col-span-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Button variant="ghost" size="sm" onClick={() => navigate("/products")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t("common.back")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? t("products.editForm.title") : t("products.createForm.title")}</CardTitle>
          <CardDescription>
            {isEdit ? t("products.editForm.desc") : t("products.createForm.desc")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6 space-y-2">
                <Label htmlFor="name">{t("products.name") + " *"}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("products.createForm.namePlaceholder")}
                  required
                />
                {duplicateMatches.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">{t("products.createForm.duplicateNameTitle")}</span>
                      <ul className="mt-1 space-y-0.5">
                        {duplicateMatches.map(({ product }) => (
                          <li key={product.id}>
                            {t("products.createForm.duplicateNameItem", {
                              name: product.name,
                              sku: product.sku,
                              category: product.category || t("products.createForm.noCategory"),
                              price: formatCurrency(product.sell_price),
                            })}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="col-span-6 space-y-2">
                <Label htmlFor="sku">{t("products.sku") + " *"}</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t("products.createForm.skuPlaceholder")}
                  required
                  className="font-data"
                />
              </div>
              <div className="col-span-6 space-y-2">
                <Label>{t("products.category")}</Label>
                <SearchableSelect
                  value={category}
                  onValueChange={setCategory}
                  options={categories.map((c) => ({ value: c, label: c }))}
                  creatable
                  createLabel={(text) => t("products.createForm.useValue", { value: text })}
                  placeholder={t("products.createForm.categoryPlaceholder")}
                  searchPlaceholder={t("common.search")}
                  clearLabel={t("products.createForm.clearCategory")}
                  className="w-full max-w-none"
                />
              </div>
              <div className="col-span-6 space-y-2">
                <Label htmlFor="price">{t("products.purchasePrice") + " *"}</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="font-data"
                />
              </div>
              <div className="col-span-4 space-y-2">
                <Label htmlFor="sell_price">{t("products.sellPrice") + " *"}</Label>
                <Input
                  id="sell_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="font-data"
                />
              </div>
              <div className="col-span-4 space-y-2">
                <Label htmlFor="stock">{t("products.stock")}</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="font-data"
                />
              </div>
              <div className="col-span-4 space-y-2">
                <Label htmlFor="threshold">{t("products.lowStockThreshold")}</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="5"
                  className="font-data"
                />
              </div>
              {isEdit && isAdmin && (
                <div className="col-span-4 space-y-2">
                  <Label>{t("products.status")}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as "active" | "discontinued")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("products.active")}</SelectItem>
                      <SelectItem value="discontinued">{t("products.discontinued")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/products")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? t("common.loading") : isEdit ? t("products.editForm.title") : t("products.createForm.title")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
