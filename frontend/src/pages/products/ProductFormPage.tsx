import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react"

export default function ProductFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
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
            setError("Product not found")
            return
          }
          setName(product.name)
          setSku(product.sku)
          setCategory(product.category)
          setPrice(String(product.price))
          setStock(String(product.stock))
          setLowStockThreshold(String(product.low_stock_threshold))
        })
        .catch(() => setError("Failed to load product"))
        .finally(() => setFetching(false))
    }
  }, [id, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const body = {
      name,
      sku,
      category,
      price: parseFloat(price),
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
      setError(err.response?.data?.error || "Failed to save product")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading product...</div>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/products")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit Product" : "Create Product"}</CardTitle>
          <CardDescription>
            {isEdit ? "Update product details below" : "Fill in the product details below"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Stock Keeping Unit"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Electronics, Hardware"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
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
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="5"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/products")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
