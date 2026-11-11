'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BRANDS, DEPARTMENTS, DISCOUNT_TYPES, CUSTOMER_SELECTION_OPTIONS, APPLIES_TO_OPTIONS } from '@/lib/constants'
import { Brand, Department } from '@/lib/types'

const couponSchema = z.object({
  brandId: z.string().min(1, 'Brand is required'),
  departmentId: z.string().min(1, 'Department is required'),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  discountValue: z.number().min(0, 'Discount value is required'),
  minimumOrderAmount: z.number().optional(),
  usageLimit: z.number().optional(),
  usageLimitPerCustomer: z.number().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  customerSelection: z.enum(['all', 'prerequisite']),
  appliesTo: z.enum(['all', 'product', 'collection']),
  customSuffix: z.string().optional(),
})

type CouponFormData = z.infer<typeof couponSchema>

export function CouponGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string>('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
  })

  const selectedBrand = BRANDS.find(b => b.id === watch('brandId'))
  const selectedDepartment = DEPARTMENTS.find(d => d.id === watch('departmentId'))
  const discountType = watch('discountType')

  const generateCouponCode = () => {
    if (!selectedBrand || !selectedDepartment) return ''
    
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const customSuffix = watch('customSuffix') || randomSuffix
    
    return `${selectedDepartment.prefix}-${selectedBrand.name.toUpperCase().replace(/\s+/g, '')}-${timestamp}-${customSuffix}`
  }

  const previewCode = generateCouponCode()

  const onSubmit = async (data: CouponFormData) => {
    setIsGenerating(true)
    try {
      const code = generateCouponCode()
      setGeneratedCode(code)
      
      // Validate that selected brand has a Shopify store
      if (selectedBrand && !selectedBrand.hasShopifyStore) {
        alert(`${selectedBrand.displayName} does not have a Shopify store configured. Please select a different brand.`)
        return
      }
      
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ...data, 
          codes: [code],
          brandId: selectedBrand?.id 
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        alert(`Coupon code generated: ${code}`)
      } else {
        const error = await response.text()
        alert(`Error generating coupon: ${error}`)
      }
    } catch (error) {
      console.error('Error generating coupon:', error)
      alert('Error generating coupon code')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Generate New Coupon Code
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand
              </label>
              <Select onValueChange={(value: string) => setValue('brandId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{brand.displayName}</span>
                        {!brand.hasShopifyStore && (
                          <span className="text-xs text-gray-500 ml-2">(No Store)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brandId && (
                <p className="text-red-500 text-sm mt-1">{errors.brandId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <Select onValueChange={(value: string) => setValue('departmentId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && (
                <p className="text-red-500 text-sm mt-1">{errors.departmentId.message}</p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview Code</h3>
            <div className="font-mono text-lg bg-white px-3 py-2 rounded border">
              {previewCode || 'Select brand and department to preview'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Type
              </label>
              <Select onValueChange={(value: string) => setValue('discountType', value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select discount type" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.discountType && (
                <p className="text-red-500 text-sm mt-1">{errors.discountType.message}</p>
              )}
            </div>

            {discountType !== 'free_shipping' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value {discountType === 'percentage' ? '(%)' : '($)'}
                </label>
                <Input
                  type="number"
                  min="0"
                  step={discountType === 'percentage' ? '0.01' : '0.01'}
                  placeholder={discountType === 'percentage' ? '10.00' : '10.00'}
                  {...register('discountValue', { valueAsNumber: true })}
                />
                {errors.discountValue && (
                  <p className="text-red-500 text-sm mt-1">{errors.discountValue.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Order Amount ($)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register('minimumOrderAmount', { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usage Limit
              </label>
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                {...register('usageLimit', { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usage Limit Per Customer
              </label>
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                {...register('usageLimitPerCustomer', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <Input
                type="datetime-local"
                {...register('startsAt')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <Input
                type="datetime-local"
                {...register('endsAt')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Selection
              </label>
              <Select onValueChange={(value: string) => setValue('customerSelection', value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer selection" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_SELECTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applies To
              </label>
              <Select onValueChange={(value: string) => setValue('appliesTo', value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select applies to" />
                </SelectTrigger>
                <SelectContent>
                  {APPLIES_TO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Suffix (Optional)
            </label>
            <Input
              placeholder="Custom identifier (e.g., SUMMER2024)"
              {...register('customSuffix')}
            />
            <p className="text-sm text-gray-500 mt-1">
              Leave blank for auto-generated suffix
            </p>
          </div>

          <Button
            type="submit"
            disabled={isGenerating || !selectedBrand || !selectedDepartment}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate Coupon Code'}
          </Button>
        </form>
      </div>

      {generatedCode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Coupon Code Generated Successfully!
          </h3>
          <div className="font-mono text-xl bg-white px-4 py-3 rounded border border-green-300">
            {generatedCode}
          </div>
          <p className="text-sm text-green-600 mt-2">
            This code has been created in Shopify and is ready to use.
          </p>
        </div>
      )}
    </div>
  )
}
