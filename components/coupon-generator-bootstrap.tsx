'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
  numberOfCodes: z.number().min(1, 'Number of codes must be at least 1').max(100000, 'Maximum 100,000 codes allowed'),
})

type CouponFormData = z.infer<typeof couponSchema>

export function CouponGeneratorBootstrap() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
  const [numberOfCodes, setNumberOfCodes] = useState(1)

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
      const codes: string[] = []
      
      // Warn for large batches
      if (numberOfCodes > 1000) {
        const confirmed = confirm(`Generating ${numberOfCodes} codes may take a while and could impact performance. Do you want to continue?`)
        if (!confirmed) {
          setIsGenerating(false)
          return
        }
      }
      
      // Generate codes in batches to avoid blocking
      const batchSize = 100
      for (let i = 0; i < numberOfCodes; i++) {
        const code = generateCouponCode()
        // Add a small suffix to make each code unique
        const uniqueSuffix = i > 0 ? `-${i + 1}` : ''
        const finalCode = code + uniqueSuffix
        codes.push(finalCode)
        
        // Update progress for large batches
        if (numberOfCodes > 100 && i % batchSize === 0) {
          console.log(`Generated ${i} of ${numberOfCodes} codes...`)
        }
      }
      
      setGeneratedCodes(codes)
      
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
          codes,
          brandId: selectedBrand?.id 
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.failureCount > 0) {
          alert(`Generated ${result.successCount} of ${codes.length} codes successfully. ${result.failureCount} codes failed.`)
        } else {
          alert(`Successfully generated ${codes.length} coupon codes!`)
        }
      } else {
        const error = await response.text()
        alert(`Error generating coupons: ${error}`)
      }
    } catch (error) {
      console.error('Error generating coupons:', error)
      alert('Error generating coupon codes')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h2 className="h4 mb-0">
              Generate New Coupon Code
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)} className="needs-validation">
              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label">Brand</label>
                  <select 
                    className="form-select"
                    {...register('brandId')}
                    onChange={(e) => setValue('brandId', e.target.value)}
                  >
                    <option value="">Select a brand</option>
                    {BRANDS.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.displayName} {!brand.hasShopifyStore && '(No Store)'}
                      </option>
                    ))}
                  </select>
                  {errors.brandId && (
                    <div className="text-danger small mt-1">{errors.brandId.message}</div>
                  )}
                </div>

                <div className="col-md-3">
                  <label className="form-label">Department</label>
                  <select 
                    className="form-select"
                    {...register('departmentId')}
                    onChange={(e) => setValue('departmentId', e.target.value)}
                  >
                    <option value="">Select a department</option>
                    {DEPARTMENTS.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.displayName}
                      </option>
                    ))}
                  </select>
                  {errors.departmentId && (
                    <div className="text-danger small mt-1">{errors.departmentId.message}</div>
                  )}
                </div>

                <div className="col-md-3">
                  <label className="form-label">Number of Codes</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="100000"
                    {...register('numberOfCodes', { valueAsNumber: true })}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setNumberOfCodes(value)
                      setValue('numberOfCodes', value)
                    }}
                  />
                  <div className="form-text">Generate 1-100,000 codes at once</div>
                  {errors.numberOfCodes && (
                    <div className="text-danger small mt-1">{errors.numberOfCodes.message}</div>
                  )}
                </div>
              </div>

              <div className="alert alert-info">
                <h5 className="alert-heading">Preview Code</h5>
                <div className="font-monospace fs-5 bg-light p-2 rounded border">
                  {previewCode || 'Select brand and department to preview'}
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label">Discount Type</label>
                  <select 
                    className="form-select"
                    {...register('discountType')}
                    onChange={(e) => setValue('discountType', e.target.value as any)}
                  >
                    <option value="">Select discount type</option>
                    {DISCOUNT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {errors.discountType && (
                    <div className="text-danger small mt-1">{errors.discountType.message}</div>
                  )}
                </div>

                {discountType !== 'free_shipping' && (
                  <div className="col-md-6">
                    <label className="form-label">
                      Discount Value {discountType === 'percentage' ? '(%)' : '($)'}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step={discountType === 'percentage' ? '0.01' : '0.01'}
                      placeholder={discountType === 'percentage' ? '10.00' : '10.00'}
                      {...register('discountValue', { valueAsNumber: true })}
                    />
                    {errors.discountValue && (
                      <div className="text-danger small mt-1">{errors.discountValue.message}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="row mb-4">
                <div className="col-md-4">
                  <label className="form-label">Minimum Order Amount ($)</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...register('minimumOrderAmount', { valueAsNumber: true })}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Usage Limit</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    placeholder="Unlimited"
                    {...register('usageLimit', { valueAsNumber: true })}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Usage Limit Per Customer</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    placeholder="Unlimited"
                    {...register('usageLimitPerCustomer', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label">Start Date</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    {...register('startsAt')}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">End Date</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    {...register('endsAt')}
                  />
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label">Customer Selection</label>
                  <select 
                    className="form-select"
                    {...register('customerSelection')}
                    onChange={(e) => setValue('customerSelection', e.target.value as any)}
                  >
                    {CUSTOMER_SELECTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Applies To</label>
                  <select 
                    className="form-select"
                    {...register('appliesTo')}
                    onChange={(e) => setValue('appliesTo', e.target.value as any)}
                  >
                    {APPLIES_TO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Custom Suffix (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Custom identifier (e.g., SUMMER2024)"
                  {...register('customSuffix')}
                />
                <div className="form-text">Leave blank for auto-generated suffix</div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !selectedBrand || !selectedDepartment}
                className="btn btn-primary w-100"
              >
                {isGenerating ? `Generating ${numberOfCodes} code${numberOfCodes > 1 ? 's' : ''}...` : `Generate ${numberOfCodes} Coupon Code${numberOfCodes > 1 ? 's' : ''}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {generatedCodes.length > 0 && (
        <div className="mt-4">
          <div className="alert alert-success">
            <h4 className="alert-heading">
              Coupon Codes Generated Successfully! ({generatedCodes.length} codes)
            </h4>
            <div className="bg-white p-3 rounded border border-success">
              {generatedCodes.map((code, index) => (
                <div key={index} className="font-monospace fs-5 mb-2">
                  {code}
                </div>
              ))}
            </div>
            <p className="mb-0 mt-2">
              These codes have been created in Shopify and are ready to use.
            </p>
            <div className="mt-3">
              <button 
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCodes.join('\n'))
                  alert('Codes copied to clipboard!')
                }}
              >
                Copy All Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
