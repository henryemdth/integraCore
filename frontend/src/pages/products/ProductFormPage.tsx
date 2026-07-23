import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react"

export default function ProductFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [stock, setStock] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState("5")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/api/products?page=1&limit=100&search=`)
        .then((res) => {
          const product = res.data.products.find((p: Product) => p.id === Number(id))
          if (!product) {
            setError(t("products.editForm.notFound"))
            return
          }
          setName(product.name)
          setSku(product.sku)
          setCategory(product.category)
          setPrice(String(product.price))
          setSellPrice(String(product.sell_price))
          setStock(String(product.stock))
          setLowStockThreshold(String(product.low_stock_threshold))
        })
        .catch(() => setError(t("products.createForm.failedSave")))
        .finally(() => setFetching(false))
    }
  }, [id, isEdit, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const body = {
      name,
      sku,
      category,
      price: parseFloat(price),
      sell_price: parseFloat(sellPrice),
      stock: parseInt(stock) || 0,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
    }

    try {
      if (isEdit) {
        await api.put(`/api/products/${id}`, body)
      } else {
        await api.post("/api/products", body)
      }
      navigate("/products")
    } catch (err: any) {
      setError(err.response?.data?.error || t("products.createForm.failedSave"))
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t("common.loading")}</div>
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
              </div>
              <div className="col-span-6 space-y-2">
                <Label htmlFor="sku">{t("products.sku") + " *"}</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t("products.createForm.skuPlaceholder")}
                  required
                />
              </div>
              <div className="col-span-6 space-y-2">
                <Label htmlFor="category">{t("products.category")}</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t("products.createForm.categoryPlaceholder")}
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
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/products")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : isEdit ? t("products.editForm.title") : t("products.createForm.title")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
