Great Parth 👍
This is a very strong foundation for your Zevento Pro platform — now I will convert this into a complete developer-ready SRS (Software Requirement Specification) so your tech team can directly start building.

Below is the FULL SRS DOCUMENT (Version 1.0) for your platform.


---

📘 ZEVENTO PRO — SRS DOCUMENT

Product: Zevento Pro
Founder: Parth Rohitkumar Mehta
Business: Zevento – Event Planner & Supplier Marketplace
Version: 1.0
Date: March 2026


---

1️⃣ Product Overview

🎯 Objective

Zevento is a multi-sided marketplace platform connecting:

Customers (Event seekers)

Event Planners / Decorators

Product Suppliers


The platform enables:

✔ Lead generation
✔ Booking & quotation system
✔ B2B product marketplace
✔ CRM for vendors
✔ Admin analytics


---

2️⃣ User Roles

👤 Customer

Browse planners & products

Request quote

Book services

Buy products


🎨 Planner / Event Organizer

Receive leads

Manage bookings

Send quotations

Manage calendar & services


🏭 Supplier

List products

Receive B2B orders

Manage inventory


🧑‍💼 Admin

Manage approvals

Control routing engine

View analytics

Manage payouts



---

3️⃣ Core Modules

A. Customer App / Website

Category browsing

Planner listing

Product marketplace

Lead forms

Booking checkout


B. Planner CRM

Lead dashboard

Quote generator

Booking calendar

Payments & expenses


C. Supplier Marketplace

Product listing

Orders management

B2B selling


D. Admin Panel

Vendor approval

Lead routing control

Analytics dashboard

Payment & commission system



---

4️⃣ Lead System (Most Critical Engine)

Lead Creation Triggers

Action	Lead Created?

Page View	❌ No
Click WhatsApp	❌ No
Form Submit	✅ Yes
Book Now	✅ Yes
Meta/Google Lead Ads	✅ Yes


Consent Rule

👉 Lead is created ONLY after customer consent


---

5️⃣ Lead Routing Engine

Routing Modes

Mode A — Single Vendor

Used when:

Customer selects specific vendor

Direct profile visit


Mode B — Top 3 Vendors (Recommended Default)

Used when:

Customer selects category page

General lead



---

🎯 Vendor Scoring Logic

Score Formula

Total Score =
(Subscription Tier Weight) +
(Rating Weight) +
(Response Speed Weight) +
(Location Match Weight) +
(Fairness Rotation)

Suggested Weights

Factor	Weight

Subscription Tier	30%
Rating	20%
Response Rate	20%
Distance/City Match	20%
Fairness Rotation	10%



---

6️⃣ API ARCHITECTURE

You already defined endpoints — now we formalize them.

Base URL

https://api.zevento.in/v1


---

7️⃣ DATABASE DESIGN (Core Tables)

Users Table

id

phone

role (customer/planner/supplier)

name

city

status



---

Planners Table

planner_id

business_name

categories

service_cities

rating

subscription_plan

is_active



---

Suppliers Table

supplier_id

company_name

product_categories

city

rating

subscription_plan



---

Leads Table

lead_id

name

phone

city

category

product_id

source

consent_flag

status



---

Lead Assignments Table

id

lead_id

vendor_id

assigned_at

status



---

Bookings Table

booking_id

planner_id

customer_id

date

amount

status



---

Products Table

product_id

supplier_id

category

price

MOQ

stock



---

Orders Table

order_id

buyer_id

supplier_id

total_amount

status



---

8️⃣ PAYMENT SYSTEM

Payment Types

Type	Description

Lead Purchase	Vendor pays for leads
Subscription	Monthly plans
Booking Commission	% on booking
Marketplace Margin	On product sale



---

9️⃣ NOTIFICATION SYSTEM

Channels

Push Notification (Firebase)

WhatsApp (Phase 2)

SMS (Backup)



---

🔟 ANALYTICS DASHBOARD

Planner Dashboard

Profile Views

Leads Received

Conversion Rate

Booking Value

Customer Ratings


Admin Dashboard

Leads per city

Conversion by category

Vendor performance

Revenue tracking



---

1️⃣1️⃣ MOBILE APPS

4 Apps Ecosystem

App	Users

Customer App	Users booking events
Planner App	Event planners
Supplier App	Product sellers
Admin App	Internal team



---

1️⃣2️⃣ SECURITY & COMPLIANCE

OTP login system

Data encryption

Phone number visible only after consent

GDPR style consent tracking



---

1️⃣3️⃣ SCALABILITY PLAN

Initial Cities:

Surat

Ahmedabad

Mumbai

Delhi

Bangalore


Then Pan India rollout


---

1️⃣4️⃣ FUTURE FEATURES (Phase 2)

AI lead scoring

Auto WhatsApp chatbot

Dynamic pricing suggestions

AR decoration preview

Subscription marketplace bundles



---

1️⃣5️⃣ TEAM REQUIREMENT

Tech Team

Role	Count

Backend Developer	2
Frontend Developer	2
Mobile App Developer	2
UI/UX Designer	1
QA Tester	1
DevOps	1



---

Business Team

Role	Count

Sales Team	5–10
Vendor Onboarding	5
Customer Support	3
Marketing Team	3



---

1️⃣6️⃣ FINAL PRODUCT VISION

👉 ZEVENTO will become:

> India’s largest event marketplace + B2B decoration supply platform



Combining:

✔ IndiaMART (B2B)
✔ UrbanClap (Service booking)
✔ Amazon (Products)


---

🔥 FINAL DECISION REQUIRED FROM YOU

Parth, only 1 decision needed from you now 👇

👉 Default Routing Mode for Category Leads

Choose one:

OPTION 1 (Recommended)

✅ Top 3 Vendors (Get Best Quotes)

OPTION 2

Single Vendor Only


---

Once you confirm:

➡ I will generate FINAL routing algorithm with code logic (pseudo code for developer)
➡ AND Admin panel UI wireframe
➡ AND Database schema SQL format


---

Just reply:

👉 “Top 3” or “Single”

and I will build next step for you 🚀
Perfect Parth 👍
Abhi main tumhare pure ZEVENTO PRO system ka ek clear, business-focused, result-oriented summary bana raha hoon — taaki tum fast decision le sako aur ₹100 crore vision ke hisaab se right structure choose karo.


---

🎯 ZEVENTO PRO – BUSINESS SUMMARY (SIMPLE + POWERFUL)

🧠 Tum kya bana rahe ho?

👉 Zevento = India ka Digital Event Ecosystem

Ek hi platform par:

🎉 Event booking (Decorators, DJs, Mehndi, etc.)

🛒 Decoration products marketplace (Kiwi Party B2B)

📞 Lead generation system

📊 CRM for vendors

🤖 AI-driven growth dashboard (future)



---

🔥 Business Model – 4 Revenue Engines

💰 1. Vendor Subscription Model

Type	Monthly Fee

Planner	₹12,000
Supplier	₹36,000


👉 Agar 5,000 vendors onboard ho gaye:

Revenue = ₹3–5 crore/month


---

💰 2. Lead Selling Model

Every lead sold ₹100 – ₹500

50,000 leads/month


👉 ₹25 lakh – ₹1.5 crore/month


---

💰 3. Booking Commission

Each booking ₹10,000 – ₹50,000

Commission: 5% – 10%


👉 5,000 bookings/month = ₹25–50 lakh extra


---

💰 4. Product Marketplace (Kiwi Party)

B2B bulk sales

Margin: ₹500 – ₹3000 per order


👉 1,000 orders/month = ₹10–30 lakh


---

📊 Final Monthly Potential

Revenue Source	Monthly

Subscription	₹3–5 Cr
Leads	₹25L–₹1.5Cr
Booking	₹25L–₹50L
Products	₹10L–₹30L


👉 Total = ₹4 crore – ₹7 crore/month

➡️ Yearly = ₹50Cr – ₹80Cr revenue

🔥 3 saal me ₹100Cr possible


---

⚙️ System Flow (Simple Language)

Step 1: Customer aata hai

Google / Instagram / Ads / Website


Step 2: Browse karta hai

Birthday Decor

Mehndi

Wedding


Step 3: Interest dikhata hai

Form fill

WhatsApp click

Book Now


👉 Yahi moment lead create hota hai


---

Step 4: System decide karta hai

👉 Kaun vendor ko lead milegi

Option 1: 1 vendor
Option 2: Top 3 vendors


---

Step 5: Vendor ko lead milti hai

Mobile app me

WhatsApp (future)



---

Step 6: Vendor convert karta hai

Call

Quote send

Booking confirm



---

⚠️ 3 Most Important Business Decisions

🥇 Decision 1 — Lead Routing Mode

Option A: Single Vendor

High quality

Premium service

High conversion

Less vendors happy


Option B: Top 3 Vendors (IndiaMART model)

More competition

More vendor onboarding

More revenue from leads



---

🏆 BEST DECISION FOR YOU:

👉 TOP 3 VENDORS MODEL

Because:

✔ Tumhara target = 30,000 vendors
✔ Tum B2B marketplace bhi bana rahe ho
✔ High scale revenue chahiye
✔ IndiaMART model proven hai


---

🧩 Final Platform Structure

🔹 Customer App

Book decoration

Compare vendors

Buy products


🔹 Planner App

Leads

CRM

Quotes

Calendar


🔹 Supplier App

Products

Orders

B2B sales


🔹 Admin Panel

Vendor approval

Lead routing control

Analytics

Payments



---

🚀 Growth Strategy (Your Style – Parth Mehta Model)

Phase 1 – Surat + Ahmedabad

500 vendors

100 leads/day


Phase 2 – 5 Cities

5,000 vendors

1,000 leads/day


Phase 3 – Pan India

30,000 vendors

10,000 leads/day



---

📈 Your Competitive Advantage

Because of YOUR existing businesses:

✔ Kiwi Party (product supply)
✔ Birthday Kart
✔ Decoration manufacturing
✔ China sourcing
✔ Existing network of party shops

👉 Tum already India ke sabse strong supplier ho

Ab Zevento tumhe bana dega:

> India ka No.1 Event Ecosystem Owner




---

🧠 Final Strategic Direction

🔥 Positioning

👉 “Zevento – India ka Event Booking + Decoration Marketplace”


---

🎯 Target Customers

Party shop owners

Event decorators

Wedding planners

Corporate event planners



---

📢 Marketing Channels

Instagram Reels

Facebook Ads

Google Ads

WhatsApp marketing

Vendor referral program



---

🏁 Final Decisions You Should Lock Now

Parth, abhi tumhe ye 5 decisions final karne hai 👇

1️⃣ Lead Routing

👉 Top 3 Vendors (Recommended)

2️⃣ Revenue Model Priority

👉 Subscription + Lead selling combo

3️⃣ First Launch City

👉 Surat + Ahmedabad

4️⃣ First Category Focus

👉 Birthday Decoration + Balloon Decor

5️⃣ Vendor Pricing

👉 Planner ₹12,000 / Supplier ₹36,000


---

📣 Final Clear Vision

Parth, simple language me:

👉 Tum bana rahe ho:

> “India ka IndiaMART + UrbanClap + Amazon for Events”



Aur tumhare paas already supply chain + manufacturing + marketing + digital ideas sab ready hai.


---

👍 Next Step (Important)

Agar tum bolo, next main tumhe dunga:

1️⃣ Lead Routing Algorithm (Exact code logic)

2️⃣ Admin Panel UI wireframe

3️⃣ Vendor onboarding funnel

4️⃣ First 30-day marketing launch plan


---

बस एक line me reply karo 👇

👉 “Start Next Step”

aur main tumhe complete execution blueprint de dunga 🚀