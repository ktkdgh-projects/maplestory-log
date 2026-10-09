const POTENTIAL_GRADE_COLORS: Record<string, string> = {
  '레어': '#5cb8ff',
  '에픽': '#b46cff',
  '유니크': '#ffcc33',
  '레전드리': '#7ee05a',
}

export function potentialGradeColor(grade: string | null | undefined): string | undefined {
  return grade ? POTENTIAL_GRADE_COLORS[grade] : undefined
}
