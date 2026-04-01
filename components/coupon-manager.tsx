'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShopifyProduct, ShopifyCollection } from '@/lib/types'

interface CouponManagerProps {
  discountId: string
}

export function CouponManager({ discountId }: CouponManagerProps) {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [collections, setCollections] = useState<ShopifyCollection[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [addCodes, setAddCodes] = useState('')
  const [removeCodes, setRemoveCodes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [collectionSearch, setCollectionSearch] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCollections()
  }, [])

  const fetchProducts = async (query = '') => {
    try {
      const response = await fetch(`/api/products?query=${encodeURIComponent(query)}&limit=25`)
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchCollections = async (query = '') => {
    try {
      const response = await fetch(`/api/collections?query=${encodeURIComponent(query)}&limit=25`)
      const data = await response.json()
      setCollections(data)
    } catch (error) {
      console.error('Error fetching collections:', error)
    }
  }

  const handleAddCodes = async () => {
    if (!addCodes.trim()) return

    setIsLoading(true)
    try {
      const codes = addCodes.split(',').map(code => code.trim()).filter(code => code)
      
      const response = await fetch(`/api/coupons/${discountId}/codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codes }),
      })

      if (response.ok) {
        alert('Codes added successfully!')
        setAddCodes('')
      } else {
        alert('Failed to add codes')
      }
    } catch (error) {
      console.error('Error adding codes:', error)
      alert('Error adding codes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveCodes = async () => {
    if (!removeCodes.trim()) return

    setIsLoading(true)
    try {
      const codes = removeCodes.split(',').map(code => code.trim()).filter(code => code)
      
      const response = await fetch(`/api/coupons/${discountId}/codes`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codes }),
      })

      if (response.ok) {
        alert('Codes removed successfully!')
        setRemoveCodes('')
      } else {
        alert('Failed to remove codes')
      }
    } catch (error) {
      console.error('Error removing codes:', error)
      alert('Error removing codes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductSearch = (value: string) => {
    setProductSearch(value)
    fetchProducts(value)
  }

  const handleCollectionSearch = (value: string) => {
    setCollectionSearch(value)
    fetchCollections(value)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Manage Coupon Codes
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Codes (comma-separated)
            </label>
            <div className="flex space-x-2">
              <Input
                placeholder="CODE1, CODE2, CODE3"
                value={addCodes}
                onChange={(e) => setAddCodes(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAddCodes}
                disabled={isLoading || !addCodes.trim()}
              >
                Add Codes
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter multiple codes separated by commas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remove Codes (comma-separated)
            </label>
            <div className="flex space-x-2">
              <Input
                placeholder="CODE1, CODE2, CODE3"
                value={removeCodes}
                onChange={(e) => setRemoveCodes(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleRemoveCodes}
                disabled={isLoading || !removeCodes.trim()}
                variant="destructive"
              >
                Remove Codes
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter codes to remove, separated by commas
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Product Restrictions
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Products
            </label>
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => handleProductSearch(e.target.value)}
            />
          </div>

          {products.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Products
              </label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`product-${product.id}`}
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product.id])
                        } else {
                          setSelectedProducts(selectedProducts.filter(id => id !== product.id))
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`product-${product.id}`} className="flex-1 text-sm">
                      <div className="font-medium">{product.title}</div>
                      <div className="text-gray-500">{product.vendor} - {product.productType}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Collection Restrictions
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Collections
            </label>
            <Input
              placeholder="Search collections..."
              value={collectionSearch}
              onChange={(e) => handleCollectionSearch(e.target.value)}
            />
          </div>

          {collections.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Collections
              </label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                {collections.map((collection) => (
                  <div key={collection.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`collection-${collection.id}`}
                      checked={selectedCollections.includes(collection.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollections([...selectedCollections, collection.id])
                        } else {
                          setSelectedCollections(selectedCollections.filter(id => id !== collection.id))
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`collection-${collection.id}`} className="flex-1 text-sm font-medium">
                      {collection.title}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
