import { describe, expect, it } from 'vitest'
import { metadata } from '@/app/page'

describe('home page metadata', () => {
  it('gives search results a title and a description', () => {
    expect(metadata.title).toEqual(expect.any(String))
    expect(metadata.description).toEqual(expect.any(String))
    expect(String(metadata.description).length).toBeGreaterThan(0)
  })
})
