const POTENTIAL_GRADE_COLORS: Record<string, string> = {
  '레어': 'var(--grade-rare)',
  '에픽': 'var(--grade-epic)',
  '유니크': 'var(--grade-unique)',
  '레전드리': 'var(--grade-legendary)',
}

export function potentialGradeColor(grade: string | null | undefined): string | undefined {
  return grade ? POTENTIAL_GRADE_COLORS[grade] : undefined
}

// 에픽만 받침이 있다: "에픽이", "유니크가"
export const gradeSubject = (grade: string) => `${grade}${grade === '에픽' ? '이' : '가'}`
