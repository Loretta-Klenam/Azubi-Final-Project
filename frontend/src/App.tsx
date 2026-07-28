import { Routes, Route, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const events = [
  { id: '1', title: 'Tech Summit 2026', date: '2026-10-15', spots: 120 },
  { id: '2', title: 'Design Meetup', date: '2026-11-20', spots: 60 },
];

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-semibold">EventFlow</Link>
          <div className="flex gap-4 text-sm text-slate-300">
            <Link to="/events">Events</Link>
            <Link to="/admin">Admin</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl"
        >
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-400">Serverless ticketing</p>
          <h1 className="text-4xl font-bold">Launch, manage, and sell event access in minutes.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Built with React, TypeScript, AWS Lambda, DynamoDB, and Terraform for multi-environment deployment.
          </p>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{event.date}</p>
              <p className="mt-4 text-sm text-cyan-300">{event.spots} seats available</p>
            </div>
          ))}
        </section>

        <Routes>
          <Route path="/" element={<div className="text-slate-400">Welcome to the event portal.</div>} />
          <Route path="/events" element={<div className="text-slate-400">Event catalog coming soon.</div>} />
          <Route path="/admin" element={<div className="text-slate-400">Admin dashboard coming soon.</div>} />
        </Routes>
      </main>
    </div>
  );
}
