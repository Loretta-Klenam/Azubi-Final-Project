const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is Evendor?",
    answer:
      "Evendor is where you discover events and register for a ticket in a couple of clicks -- no printing, no paperwork.",
  },
  {
    question: "Do I need an account to register for an event?",
    answer:
      "No. You can register with just your name and email from any event's page, and you'll get a confirmation code and QR ticket immediately. Creating a free account just lets you keep all your tickets in one place under \"My tickets\".",
  },
  {
    question: "How do I find my ticket again later?",
    answer:
      "Every registration gives you a ticket link with a confirmation code built in -- keep that link, or bookmark the \"My tickets\" page if you registered while signed in.",
  },
  {
    question: "Can I cancel a registration?",
    answer:
      "Yes. Open your ticket and use \"Cancel registration\" -- this frees your spot for someone else and lets you register again later with the same email if you change your mind.",
  },
  {
    question: "How is this different from an admin account?",
    answer:
      "Admin accounts are for event organizers only, created directly by the team running Evendor. They can create, edit, and manage events and see who has registered. Regular user accounts cannot access admin tools.",
  },
];

const HOW_TO_USE: { title: string; description: string }[] = [
  {
    title: "1. Discover",
    description: "Browse upcoming events on the Discover page -- open one to see full details.",
  },
  {
    title: "2. Register",
    description:
      "Fill in your name and email (or sign in first) and confirm -- you'll get a ticket instantly.",
  },
  {
    title: "3. Keep your ticket",
    description:
      "Your confirmation page has a QR code and all the event details -- save the link or sign in to find it under \"My tickets\" any time.",
  },
];

export default function FaqPage() {
  return (
    <div>
      <h1>FAQs</h1>
      <section>
        {FAQS.map((faq) => (
          <div key={faq.question} className="card-form" style={{ marginBottom: "1rem", maxWidth: "none" }}>
            <h2 style={{ marginTop: 0 }}>{faq.question}</h2>
            <p>{faq.answer}</p>
          </div>
        ))}
      </section>

      <h1>How to use Evendor</h1>
      <section className="event-list">
        {HOW_TO_USE.map((step) => (
          <div key={step.title} className="event-card">
            <h2>{step.title}</h2>
            <p>{step.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
