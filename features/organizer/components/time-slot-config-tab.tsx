'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { upsertTimeSlot, deleteTimeSlot } from '../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  id: string
  label: string
  startsAt: Date | string
  endsAt: Date | string
  capacity: number
  price: number
  currency: string
  bookedCount?: number
}

interface TimeSlotConfigTabProps {
  eventId: string
  timeSlots: TimeSlot[]
}

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50'

const labelCls = 'block text-[11.5px] font-medium text-zinc-400 mb-1'

function toLocalISOString(d: Date | string): string {
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTimeRange(startsAt: Date | string, endsAt: Date | string): string {
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${fmt(startsAt)} – ${fmt(endsAt)}`
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeSlotConfigTab({ eventId, timeSlots: initial }: TimeSlotConfigTabProps) {
  const [slots, setSlots] = useState(initial)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState({ label: '', startsAt: '', endsAt: '', capacity: '1', price: '0' })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openNew() {
    setEditingId('new')
    setForm({ label: '', startsAt: '', endsAt: '', capacity: '1', price: '0' })
    setError(null)
  }

  function openEdit(slot: TimeSlot) {
    setEditingId(slot.id)
    setForm({
      label: slot.label,
      startsAt: toLocalISOString(slot.startsAt),
      endsAt: toLocalISOString(slot.endsAt),
      capacity: String(slot.capacity),
      price: String(slot.price),
    })
    setError(null)
  }

  function closeForm() {
    setEditingId(null)
    setError(null)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await upsertTimeSlot({
        eventId,
        ...(editingId !== 'new' ? { timeSlotId: editingId! } : {}),
        label: form.label,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        capacity: Number(form.capacity),
        price: Number(form.price),
      })

      if (!result.success) { setError(result.error); return }

      const updated: TimeSlot = {
        id: result.timeSlotId,
        label: form.label,
        startsAt: new Date(form.startsAt),
        endsAt: new Date(form.endsAt),
        capacity: Number(form.capacity),
        price: Number(form.price),
        currency: 'NGN',
        bookedCount: editingId !== 'new' ? (slots.find((s) => s.id === editingId)?.bookedCount ?? 0) : 0,
      }

      if (editingId === 'new') {
        setSlots((prev) => [...prev, updated].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()))
      } else {
        setSlots((prev) => prev.map((s) => (s.id === editingId ? updated : s)))
      }
      closeForm()
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteTimeSlot(id, eventId)
      if (!result.success) { setError(result.error) }
      else { setSlots((prev) => prev.filter((s) => s.id !== id)) }
      setDeleteConfirmId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-zinc-300">Time Slots</h3>
        <button type="button" onClick={openNew} disabled={isPending || editingId !== null}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600/10 border border-violet-500/30 px-3 py-1.5 text-[12.5px] font-medium text-violet-400 hover:bg-violet-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus className="h-3.5 w-3.5" /> Add Slot
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {/* Inline form */}
      {editingId !== null && (
        <form onSubmit={handleSave} className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-semibold text-zinc-200">{editingId === 'new' ? 'New Time Slot' : 'Edit Slot'}</p>
            <button type="button" onClick={closeForm} disabled={isPending} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
          </div>
          <div>
            <label className={labelCls}>Label *</label>
            <input className={inputCls} value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} required placeholder="e.g. Morning Session" disabled={isPending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Starts At *</label>
              <input type="datetime-local" className={inputCls} value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} required disabled={isPending} />
            </div>
            <div>
              <label className={labelCls}>Ends At *</label>
              <input type="datetime-local" className={inputCls} value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} required disabled={isPending} />
            </div>
            <div>
              <label className={labelCls}>Capacity *</label>
              <input type="number" min={1} className={inputCls} value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} required disabled={isPending} />
            </div>
            <div>
              <label className={labelCls}>Price (kobo)</label>
              <input type="number" min={0} className={inputCls} value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} disabled={isPending} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeForm} disabled={isPending} className="text-[13px] text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancel</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          </div>
        </form>
      )}

      {/* Slot list */}
      {slots.length === 0 && editingId === null ? (
        <p className="text-[13px] text-zinc-500 text-center py-6">No time slots yet.</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const hasBookings = (slot.bookedCount ?? 0) > 0
            return (
              <div key={slot.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-zinc-100">{slot.label}</p>
                  <p className="text-[11.5px] text-zinc-500">
                    {formatDate(slot.startsAt)} · {formatTimeRange(slot.startsAt, slot.endsAt)} · {slot.capacity} spots
                    {hasBookings ? ` · ${slot.bookedCount} booked` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openEdit(slot)} disabled={isPending || editingId !== null} aria-label={`Edit ${slot.label}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirmId === slot.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <span className="text-[11px] text-zinc-400">Delete?</span>
                      <button type="button" onClick={() => handleDelete(slot.id)} disabled={isPending} className="rounded px-2 py-0.5 text-[11px] bg-red-600 text-white hover:bg-red-500 disabled:opacity-50">Yes</button>
                      <button type="button" onClick={() => setDeleteConfirmId(null)} disabled={isPending} className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">No</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDeleteConfirmId(slot.id)} disabled={isPending || hasBookings}
                      title={hasBookings ? 'Cannot delete — bookings exist' : 'Delete'}
                      aria-label={`Delete ${slot.label}`}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
