# Reddit Post Draft — r/vibecoding

---

**Title options (pick one):**

B) "I vibe-coded an entire government SaaS as a public servant with zero budget. Now I have a dilemma I never expected."


---

**Post:**

I need to share this because I genuinely don't know what happens next, and I think this community will understand the journey better than anyone.

**The background**

I'm a Department Head at a Regional Social Welfare Directorate. My job among others is the supervising of care facilities — elderly homes, children's activity centers, supported living facilities. Think licensing, inspections, sanctions.

Here's how that works today: physical folders. Handwritten inspection reports. Sending documents by courier. No central database. No way for a supervisor to see what's happening across 140+ facilities without literally asking someone to pull the physical file. When we find a violation, calculating the fine means manually searching through legislation, checking if the facility has prior offenses (by digging through more folders), and type the administrative decision.

Every other sector in public administration got digitized through EU Recovery Fund money — tax authority, social security, healthcare, unemployment services. All got Integrated Information Systems. Social welfare? Still paper. Nobody built anything for us.

**The trigger**

About 7 months ago I started experimenting with AI tools. Not as a developer — I have zero programming education. I started with a simple idea: what if I could build a searchable legislation archive for my colleagues? Social welfare law is scattered across dozens of laws, ministerial decisions, and circulars. Finding the right provision wastes hours.

That prototype grew. First a document archive, then a professional forum, then an AI legal assistant that actually knows social welfare legislation (RAG over real legal documents). Each piece solved a real pain point I experience every day at work. I show it to my superiors, none showed real interest. 

**The 3-day sprint**

Three days ago I had a call with Ministry General Secretary who wanted some special operational information that he couldn't find at his ministry's services. I provided the info he was looking for and discussed a little further then I hit him with my little project idea. He showed interest and wanted me to present it on a zoom call next week. That was last Thursday. 


I decided to go all in. Using Claude Code (as the developer), and Lovable (for UI mockups), I transformed the prototype into a full Integrated Information System. Here's what got built:

- **Facility Registry** — every supervised facility with full history, license tracking, color-coded expiry warnings
- **Digital Field Inspections** — mobile-first forms with facility-specific checklists pulled from actual Ministerial Decisions. Inspector fills it on their phone at the facility, submits, facility owner gets notified instantly. Today this notification takes weeks by mail.
- **Automated Sanctions Engine** — select violation type, system auto-calculates fine based on law + checks for recidivism + generates the formal administrative decision as PDF auto updates the existing fine processing system.
- **AI Legal Assistant** — ask questions about social welfare law in natural language, get answers with specific legal references
- **Oversight Dashboard** — real-time KPIs, expiring license alerts, pending inspections, sanctions trend charts

The technical stack: Flask, React, PostgreSQL + pgvector, OpenAI API. Role-based access for 4 user types. Deployed. Mock interoperability layer designed for real government API connections (tax authority, national id system, criminal records, other registers etc).

14 different Claude Code instances worked on it over 5 days. Each one picked a nickname, wrote a diary entry about what they built and how they felt about it, and passed the baton to the next. The codebase diary reads like a relay race written by philosophers.

**The dilemma**

I sent an introductory memo to the Secretary General of the Ministry and some day this week I'll demo the system live.

But I'm facing a positioning problem nobody talks about:

**I'm not a contractor** pitching a product. I'm a civil servant who built this within his official duties. The law says that proposing operational improvements is part of a Department Head's responsibilities. So this isn't a side project — it's literally in my job description.

**I'm not from IT.** I'm from Social Welfare. The people who normally propose information systems are from Digital Governance or the EU Funds directorate. I'm from the directorate that *uses* the system — which means I know the domain better than any contractor ever could, but I have zero institutional standing in the "we build systems" hierarchy.

**I'm not asking for money for myself.** This isn't a startup. I'm salaried. I want the Ministry to adopt the system, fund proper deployment (government cloud, real API connections), and roll it out to all Regional Units nationwide. I built it. I want to hand it over.

**What I've learned**

**Domain expertise beats technical skills.** Every contractor who builds government systems spends months learning what I already know from doing the job for years. The inspection forms in my system use actual criteria from Ministerial Decisions — I have the Word documents in my office cabinet. The fine calculations reference real legal provisions with real amounts. No outside developer could have specified this in months. I specified it in days because I live it.

**AI is the great equalizer.** I didn't learn to code. I learned to describe what I need precisely. My Claude user preferences literally say "explain everything like I'm 10." I can't read a stack trace — but I can tell you exactly what a social worker needs to see when they open an inspection form on their phone at a care facility. The AI ensemble did the  implementation. I directed the what and why.

**Vibe coding works for serious systems.** This isn't a todo app. It's a regulatory platform with role-based access, audit trails, GDPR deletion endpoints, multi-step sanction workflows, and PDF generation of formal administrative decisions. 30+ database models, 50+ API endpoints, security hardening, Docker deployment. Built without writing a single line of code myself.

**The question**

How do you bridge the gap between "one person built this with AI tools" and "this is now an institutional system"?

The prototype works. But government systems need: official procurement processes, security certification, government cloud hosting, formal interoperability agreements with other ministries, user training, change management. One Department Head can't do any of that.

I need the Secretary General to watch this demo and think: *"This solves a real problem. Let's fund it properly."* Not: *"Nice experiment from an employee."*

Has anyone navigated something similar? Built something real with AI tools and then had to make an institution adopt it?

I'll update after the call.

---
