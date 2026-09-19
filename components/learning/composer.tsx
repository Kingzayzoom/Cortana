"use client"

import { useState } from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  placeholder: string
  disabled?: boolean
  onSubmit: (text: string) => void
}

export function Composer({ placeholder, disabled, onSubmit }: Props) {
  const [text, setText] = useState("")

  return (
    <form
      className="flex items-center gap-2 rounded-full border bg-card py-1.5 pr-1.5 pl-4 shadow-sm focus-within:ring-3 focus-within:ring-ring/30"
      onSubmit={(e) => {
        e.preventDefault()
        const value = text.trim()
        if (!value || disabled) return
        onSubmit(value)
        setText("")
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={500}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <Button type="submit" size="icon" className="rounded-full" disabled={disabled || !text.trim()} aria-label="Send">
        <SendHorizontal />
      </Button>
    </form>
  )
}
