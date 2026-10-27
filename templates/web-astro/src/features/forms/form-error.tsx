import type { FieldErrors } from 'react-hook-form'

export function FormError({ errors }: { errors: FieldErrors }) {
  const message = errors.root?.server?.message

  if (message === undefined) {
    return null
  }

  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}
