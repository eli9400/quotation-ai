type StepItem = {
  id: number
  title: string
  description: string
}

const STEPS: StepItem[] = [
  {
    id: 1,
    title: 'העלאת מסמכים',
    description: 'PDF / DOCX עם דוגמאות להצעות מחיר קיימות.',
  },
  {
    id: 2,
    title: 'אימון מודל',
    description: 'בניית פרופיל תמחור לפי מסמכי העסק שלך.',
  },
  {
    id: 3,
    title: 'יצירת הצעה',
    description: 'הפקת הצעת מחיר מותאמת ללקוח לפי הדרישה.',
  },
]

export function StepsSection() {
  return (
    <section className="steps">
      {STEPS.map((step) => (
        <article key={step.id} className="step-card">
          <span>{step.id}</span>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
        </article>
      ))}
    </section>
  )
}
