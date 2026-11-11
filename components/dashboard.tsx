'use client'

import { useEffect, useState } from 'react'
import { BILLING_ENTITIES } from '@/lib/billing-entities'

interface Store {
  id: string
  shopDomain: string
  label?: string
  collectionId?: string
}

interface Group {
  id: string
  title: string
  discountType: string
  discountValue: number
  minimumOrderAmount: number | null
  startsAt: string | null
  endsAt: string | null
  customerSelection: string
  singleItem?: boolean
  excludedTags?: string[]
  codeCount: number
  stores: string[]
}

function formatDateTimeLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIsoString(local?: string) {
  if (!local) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function parseTags(input: string) {
  return input
    .split(/[\n,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
}

function defaultStartsAt() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return formatDateTimeLocal(d.toISOString())
}

function defaultEndsAt() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1, 11, 31)
  d.setHours(23, 59, 0, 0)
  return formatDateTimeLocal(d.toISOString())
}

export default function Dashboard() {
  const [stores, setStores] = useState<Store[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [newShop, setNewShop] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rulesOpen, setRulesOpen] = useState<string | null>(null)
  const [storesOpen, setStoresOpen] = useState(false)

  const defaultFormState = () => ({
    title: '',
    discountType: 'percentage',
    discountValue: '',
    minimumOrderAmount: '',
    startsAt: defaultStartsAt(),
    endsAt: defaultEndsAt(),
    customerSelection: 'all',
    singleItem: true,
    advanced: false,
    excludedTags: 'gift_card',
    billingEntity: 'rocky-boots',
    codeCount: 1,
    customCodes: false,
    codeInput: '',
    generatePrefix: '',
    generateCount: 10,
  })

  const [form, setForm] = useState(defaultFormState)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<any>(null)

  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeForm, setActiveForm] = useState({
    codeInput: '',
    generatePrefix: '',
    generateCount: 10,
    mode: 'add',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [storesRes, groupsRes] = await Promise.all([
        fetch('/api/stores'),
        fetch('/api/discount-groups'),
      ])
      if (storesRes.ok) setStores(await storesRes.json())
      if (groupsRes.ok) setGroups(await groupsRes.json())
    } catch (err) {
      console.error(err)
    }
  }

  async function searchGroups(query: string) {
    try {
      const res = await fetch(`/api/discount-groups?query=${encodeURIComponent(query)}`)
      if (res.ok) setGroups(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadData()
      return
    }
    const t = setTimeout(() => searchGroups(searchQuery), 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  function parseCodes(input: string) {
    return input
      .split(/[\n,]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
  }

  function buildCodes(): string[] {
    const fromInput = parseCodes(form.codeInput)
    if (fromInput.length > 0) return fromInput
    if (form.generatePrefix && form.generateCount > 0) {
      const codes: string[] = []
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      for (let i = 0; i < form.generateCount; i++) {
        const suffix = (i + 1).toString(36).toUpperCase().padStart(3, '0')
        codes.push(`${form.generatePrefix}-${ts}-${suffix}`)
      }
      return codes
    }
    return []
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const payload: any = {
      title: form.title,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      minimumOrderAmount: form.minimumOrderAmount ? parseFloat(form.minimumOrderAmount) : undefined,
      startsAt: toIsoString(form.startsAt),
      endsAt: toIsoString(form.endsAt),
      customerSelection: form.customerSelection,
      singleItem: form.singleItem,
      excludedTags: parseTags(form.excludedTags),
    }

    if (form.customCodes) {
      const codes = buildCodes()
      if (codes.length === 0) {
        alert('Please provide at least one discount code or generate codes')
        return
      }
      payload.codes = codes
    } else {
      payload.billingEntity = form.billingEntity
      payload.codeCount = form.codeCount
    }

    setLoading(true)
    try {
      const res = await fetch('/api/discount-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create group')
      const generated = data.group?.codes?.map((c: any) => c.code) || []
      alert(generated.length
        ? `Discount group created with ${generated.length} code${generated.length === 1 ? '' : 's'}: ${generated.slice(0, 5).join(', ')}${generated.length > 5 ? ` (+${generated.length - 5} more)` : ''}`
        : 'Discount group created')
      setForm(defaultFormState())
      await loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateCollection(shop: string, collectionId: string, label: string) {
    try {
      const res = await fetch('/api/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain: shop, collectionId, label }),
      })
      if (!res.ok) throw new Error('Update failed')
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleInstall() {
    const domain = newShop.trim().toLowerCase()
    if (!domain) return
    // OAuth must run top-level — Shopify refuses to render auth pages inside
    // the embedded iframe. Cross-origin iframes may navigate the top frame.
    const authUrl = new URL(`/api/shopify/auth?shop=${encodeURIComponent(domain)}`, window.location.origin)
    window.top!.location.href = authUrl.toString()
  }

  async function handleEdit(group: Group) {
    setEditingId(group.id)
    setEditingForm({
      title: group.title,
      discountType: group.discountType,
      discountValue: group.discountValue,
      minimumOrderAmount: group.minimumOrderAmount || '',
      startsAt: formatDateTimeLocal(group.startsAt),
      endsAt: formatDateTimeLocal(group.endsAt),
      customerSelection: group.customerSelection,
      singleItem: (group as any).singleItem || false,
      excludedTags: ((group as any).excludedTags || []).join(', '),
    })
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    try {
      const res = await fetch(`/api/discount-groups/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingForm,
          excludedTags: parseTags(editingForm.excludedTags || ''),
          discountValue: parseFloat(editingForm.discountValue),
          minimumOrderAmount: editingForm.minimumOrderAmount ? parseFloat(editingForm.minimumOrderAmount) : undefined,
          startsAt: toIsoString(editingForm.startsAt),
          endsAt: toIsoString(editingForm.endsAt),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      alert('Group updated')
      setEditingId(null)
      setEditingForm(null)
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this discount group?')) return
    try {
      const res = await fetch(`/api/discount-groups/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function buildActiveCodes(): string[] {
    const fromInput = parseCodes(activeForm.codeInput)
    if (fromInput.length > 0) return fromInput
    if (activeForm.generatePrefix && activeForm.generateCount > 0) {
      const codes: string[] = []
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      for (let i = 0; i < activeForm.generateCount; i++) {
        const suffix = (i + 1).toString(36).toUpperCase().padStart(3, '0')
        codes.push(`${activeForm.generatePrefix}-${ts}-${suffix}`)
      }
      return codes
    }
    return []
  }

  async function handleAddCodes(e: React.FormEvent) {
    e.preventDefault()
    if (!activeGroup) return
    const codes = buildActiveCodes()
    if (codes.length === 0) {
      alert('Please provide codes or generate them')
      return
    }
    try {
      const res = await fetch(`/api/discount-groups/${activeGroup}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes,
          mode: activeForm.mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add codes')
      alert(
        data.mode === 'remove'
          ? `${data.removed?.length || 0} codes removed${data.missing?.length ? `, ${data.missing.length} not found` : ''}`
          : `${data.added?.length || 0} codes added, ${data.skipped?.length || 0} skipped`
      )
      setActiveGroup(null)
      setActiveForm({ codeInput: '', generatePrefix: '', generateCount: 10, mode: 'add' })
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">Discount Dashboard</h1>
          <p className="text-muted small mb-0">Manage stores and coupon code groups</p>
        </div>
      </div>

      <section className="card mb-4">
        <div className="card-header">
          <button
            className="btn btn-link p-0 text-decoration-none text-dark w-100 text-start"
            onClick={() => setStoresOpen(!storesOpen)}
          >
            <h2 className="h5 mb-0">{storesOpen ? '▾' : '▸'} Shopify Stores</h2>
          </button>
        </div>
        {storesOpen && (
        <div className="card-body">
          {stores.length === 0 && (
            <div className="alert alert-warning">No stores connected. Add a store below to get started.</div>
          )}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label">Add Store (myshopify domain)</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="store.myshopify.com"
                  value={newShop}
                  onChange={(e) => setNewShop(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleInstall}>
                  Install
                </button>
              </div>
            </div>
          </div>

          {stores.map((store) => (
            <div key={store.id} className="border rounded p-3 mb-2">
              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Store</label>
                  <div className="form-control-plaintext fw-semibold">{store.shopDomain}</div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Label</label>
                  <input
                    type="text"
                    className="form-control"
                    defaultValue={store.label || ''}
                    onBlur={(e) => handleUpdateCollection(store.shopDomain, store.collectionId || '', e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Collection ID</label>
                  <input
                    type="text"
                    className="form-control"
                    defaultValue={store.collectionId || ''}
                    onBlur={(e) => handleUpdateCollection(store.shopDomain, e.target.value, store.label || '')}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      <section className="card mb-4">
        <div className="card-header">
          <h2 className="h5 mb-0">Create Discount Group</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleCreate}>
            <div className="row g-3 mb-3">
              <div className="col-12">
                <label className="form-label">Discount Group Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Billing Entity</label>
                <select
                  className="form-select"
                  value={form.billingEntity}
                  disabled={form.customCodes}
                  onChange={(e) => setForm({ ...form, billingEntity: e.target.value })}
                >
                  {BILLING_ENTITIES.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Number of Codes</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="1000"
                  value={form.codeCount}
                  disabled={form.customCodes}
                  onChange={(e) => setForm({ ...form, codeCount: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={form.discountType}
                  onChange={(e) => setForm({
                    ...form,
                    discountType: e.target.value,
                    singleItem: e.target.value === 'percentage' ? form.singleItem : false,
                  })}
                >
                  <option value="percentage">Percent off</option>
                  <option value="fixed_amount">Amount off</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">{form.discountType === 'percentage' ? 'Percent (%)' : 'Amount ($)'}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Start Date</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">End Date</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="advanced"
                checked={form.advanced}
                onChange={(e) => setForm({ ...form, advanced: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="advanced">
                Show advanced options
              </label>
            </div>

            {form.advanced && (
              <div className="border rounded p-3 mb-3 bg-light">
                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="customCodes"
                    checked={form.customCodes}
                    onChange={(e) => setForm({ ...form, customCodes: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="customCodes">
                    Custom Codes (paste or auto-generate)
                  </label>
                </div>

                {form.customCodes && (
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Codes (one per line or comma-separated)</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.codeInput}
                        onChange={(e) => setForm({ ...form, codeInput: e.target.value })}
                        placeholder="CODE1, CODE2, CODE3"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Or Auto-Generate</label>
                      <div className="input-group mb-2">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Prefix"
                          value={form.generatePrefix}
                          onChange={(e) => setForm({ ...form, generatePrefix: e.target.value })}
                        />
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="1000"
                          value={form.generateCount}
                          onChange={(e) => setForm({ ...form, generateCount: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-text">Paste a list of codes OR fill prefix/count. Max 1000.</div>
                    </div>
                  </div>
                )}

                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="singleItem"
                    checked={form.singleItem}
                    disabled={form.discountType !== 'percentage'}
                    onChange={(e) => setForm({ ...form, singleItem: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="singleItem">
                    % off one item only
                  </label>
                  {form.discountType !== 'percentage' && (
                    <div className="form-text">Requires percent off</div>
                  )}
                </div>

                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Excluded Product Tags</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.excludedTags}
                      onChange={(e) => setForm({ ...form, excludedTags: e.target.value })}
                      placeholder="e.g. no-discount, clearance"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Minimum Order ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.minimumOrderAmount}
                      onChange={(e) => setForm({ ...form, minimumOrderAmount: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Customer Selection</label>
                    <select
                      className="form-select"
                      value={form.customerSelection}
                      onChange={(e) => setForm({ ...form, customerSelection: e.target.value })}
                    >
                      <option value="all">All Customers</option>
                      <option value="prerequisite">Specific Customers</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex align-items-center gap-3">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Discount Group'}
              </button>
              {!form.customCodes && (
                <span className="text-muted small">
                  e.g. {BILLING_ENTITIES.find(e => e.id === form.billingEntity)?.prefix ?? '??'}
                  {'XXXXXXXX'}
                  {String((form.endsAt ? new Date(form.endsAt) : new Date()).getFullYear() % 100).padStart(2, '0')}
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h2 className="h5 mb-0">Discount Groups</h2>
          <input
            type="text"
            className="form-control form-control-sm w-auto"
            placeholder="Search by title or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
        <div className="card-body">
          {groups.length === 0 && (
            <div className="alert alert-info">{searchQuery ? 'No groups match your search.' : 'No discount groups yet.'}</div>
          )}
          {groups.map((group) => (
            <div key={group.id} className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="mb-1">{group.title}</h5>
                  <p className="mb-1 text-muted small">
                    {group.discountType === 'percentage' ? `${group.discountValue}%` : `$${group.discountValue}`} off
                    {group.singleItem ? ' · single item' : ''}
                    {group.excludedTags && group.excludedTags.length ? ` · excludes ${group.excludedTags.join(', ')}` : ''}
                    {group.minimumOrderAmount ? ` · min $${group.minimumOrderAmount}` : ''}
                    {group.startsAt ? ` · starts ${new Date(group.startsAt).toLocaleString()}` : ''}
                    {group.endsAt ? ` · ends ${new Date(group.endsAt).toLocaleString()}` : ''}
                  </p>
                  <p className="mb-0 text-muted small">
                    {group.codeCount} codes · {group.stores.length} stores
                    {group.stores.length > 0 ? ` · ${group.stores.join(', ')}` : ''}
                  </p>
                </div>
                <div className="btn-group">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => setActiveGroup(group.id)}>
                    Add Codes
                  </button>
                  <button className="btn btn-sm btn-outline-info" onClick={() => setRulesOpen(rulesOpen === group.id ? null : group.id)}>
                    {rulesOpen === group.id ? 'Hide Rules' : 'View Rules'}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEdit(group)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(group.id)}>
                    Delete
                  </button>
                </div>
              </div>

              {rulesOpen === group.id && (
                <div className="mt-3 p-3 bg-light border rounded">
                  <h6 className="fw-semibold">Discount Rules</h6>
                  <ul className="list-unstyled mb-0 small">
                    <li><strong>Title:</strong> {group.title}</li>
                    <li><strong>Type:</strong> {group.discountType === 'percentage' ? 'Percent off' : 'Fixed amount off'}</li>
                    <li><strong>Value:</strong> {group.discountType === 'percentage' ? `${group.discountValue}%` : `$${group.discountValue}`}</li>
                    <li><strong>Minimum order:</strong> {group.minimumOrderAmount ? `$${group.minimumOrderAmount}` : 'None'}</li>
                    <li><strong>Customer selection:</strong> {group.customerSelection === 'all' ? 'All customers' : 'Specific customers'}</li>
                    <li><strong>Single item:</strong> {group.singleItem ? 'Yes (most expensive eligible item)' : 'No'}</li>
                    <li><strong>Excluded tags:</strong> {group.excludedTags && group.excludedTags.length ? group.excludedTags.join(', ') : 'None'}</li>
                    <li><strong>Start:</strong> {group.startsAt ? new Date(group.startsAt).toLocaleString() : 'Immediately'}</li>
                    <li><strong>End:</strong> {group.endsAt ? new Date(group.endsAt).toLocaleString() : 'No expiry'}</li>
                    <li><strong>Code count:</strong> {group.codeCount}</li>
                    <li><strong>Connected stores:</strong> {group.stores.length ? group.stores.join(', ') : 'None'}</li>
                  </ul>
                </div>
              )}

              {editingId === group.id && editingForm && (
                <form onSubmit={handleUpdate} className="mt-3 border-top pt-3">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editingForm.title}
                        onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Type</label>
                      <select
                        className="form-select"
                        value={editingForm.discountType}
                        onChange={(e) => setEditingForm({ ...editingForm, discountType: e.target.value })}
                      >
                        <option value="percentage">Percent</option>
                        <option value="fixed_amount">Amount</option>
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Value</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editingForm.discountValue}
                        onChange={(e) => setEditingForm({ ...editingForm, discountValue: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Min Order ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editingForm.minimumOrderAmount}
                        onChange={(e) => setEditingForm({ ...editingForm, minimumOrderAmount: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Start</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={editingForm.startsAt}
                        onChange={(e) => setEditingForm({ ...editingForm, startsAt: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">End</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={editingForm.endsAt}
                        onChange={(e) => setEditingForm({ ...editingForm, endsAt: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Single Item</label>
                      <div className="form-check mt-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={!!editingForm.singleItem}
                          disabled={editingForm.discountType !== 'percentage'}
                          onChange={(e) => setEditingForm({ ...editingForm, singleItem: e.target.checked })}
                        />
                        <label className="form-check-label">one item</label>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Excluded Tags</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editingForm.excludedTags || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, excludedTags: e.target.value })}
                        placeholder="comma-separated"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <button className="btn btn-primary btn-sm me-2" type="submit">Save</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {activeGroup === group.id && (
                <form onSubmit={handleAddCodes} className="mt-3 border-top pt-3">
                  <div className="row g-3 mb-3">
                    <div className="col-md-5">
                      <label className="form-label">
                        {activeForm.mode === 'remove'
                          ? 'Codes to Remove (one per line or comma-separated)'
                          : 'Codes to Add (one per line or comma-separated)'}
                      </label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={activeForm.codeInput}
                        onChange={(e) => setActiveForm({ ...activeForm, codeInput: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Or Auto-Generate</label>
                      <div className="input-group mb-2">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Prefix"
                          value={activeForm.generatePrefix}
                          onChange={(e) => setActiveForm({ ...activeForm, generatePrefix: e.target.value })}
                        />
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="1000"
                          value={activeForm.generateCount}
                          onChange={(e) => setActiveForm({ ...activeForm, generateCount: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-text">Paste a list OR fill prefix/count</div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Mode</label>
                      <select
                        className="form-select"
                        value={activeForm.mode}
                        onChange={(e) => setActiveForm({ ...activeForm, mode: e.target.value })}
                      >
                        <option value="add">Add only new</option>
                        <option value="replace">Replace all (override)</option>
                        <option value="block">Skip used</option>
                        <option value="remove">Remove (delete from all stores)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm me-2" type="submit">Save Codes</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setActiveGroup(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
