// A store reviewer cannot read the inbox or the phone a code goes to, so a few addresses may take a code agreed
// beforehand instead. Each use is reported, since a fixed code is a weaker secret than a sent one.
export interface ReviewSignIns {
  accepts(destination: string, code: string): boolean
}

export const REVIEW_SIGN_INS = Symbol('ReviewSignIns')
