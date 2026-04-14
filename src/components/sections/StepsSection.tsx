type StepItem = {
  id: number
  title: string
  description: string
}

const STEPS: StepItem[] = [
  {
    id: 1,
    title: 'אימון המודל',
    description: 'העלאת מסמכים וניהול בסיס הידע שממנו המודל מתמחר.',
  },
  {
    id: 2,
    title: 'בקשות לקוח',
    description: 'בקשות מגיעות מצד הלקוח ונשמרות לניהול במערכת.',
  },
  {
    id: 3,
    title: 'אישור ושליחה',
    description: 'מעקב אחרי ההצעות, עריכה ואישור לפני שליחה ללקוח.',
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
