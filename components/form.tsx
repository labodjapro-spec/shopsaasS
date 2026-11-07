'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/form'
import { buttonClass, type ButtonVariant } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'

type Action = (state: FormState, formData: FormData) => Promise<FormState>

/** Formulaire branché sur une Server Action, affiche erreurs et messages */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className={className}>
      {children}
      <FormFeedback state={state} />
    </form>
  )
}

export function FormFeedback({ state }: { state: FormState }) {
  if (!state) return null
  return (
    <>
      {state.error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
    </>
  )
}

export function SubmitButton({
  children,
  variant = 'primary',
  className,
  confirm,
  confirmTitle,
  pendingLabel = 'Enregistrement…',
}: {
  children: React.ReactNode
  variant?: ButtonVariant
  className?: string
  confirm?: string
  confirmTitle?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm) return
    e.preventDefault()
    // Trouver le formulaire parent
    formRef.current = (e.currentTarget as HTMLButtonElement).closest('form')
    setOpen(true)
  }

  function handleConfirm() {
    setOpen(false)
    // Soumettre le formulaire parent
    formRef.current?.requestSubmit()
  }

  return (
    <>
      <button
        type={confirm ? 'button' : 'submit'}
        disabled={pending}
        className={buttonClass(variant, className)}
        onClick={handleClick}
      >
        {pending ? pendingLabel : children}
      </button>

      {confirm && (
        <ConfirmDialog
          open={open}
          title={confirmTitle ?? (variant === 'danger' ? 'Action irréversible' : 'Confirmer')}
          message={confirm}
          confirmLabel={variant === 'danger' ? 'Supprimer' : 'Confirmer'}
          variant={variant === 'danger' ? 'danger' : 'default'}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
