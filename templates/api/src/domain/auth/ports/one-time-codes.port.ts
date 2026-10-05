// Six digits a person can type. The digest is keyed, so a copy of the table alone cannot try the million codes.
export interface OneTimeCodes {
  create(): string
  digest(code: string): string
}

export const ONE_TIME_CODES = Symbol('OneTimeCodes')
