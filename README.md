# 🧠 Quotation AI

An AI-powered full-stack platform for analyzing contractor quotations, learning pricing patterns, and generating intelligent quote estimates from real-world data.

---

## 🎯 Overview

Quotation AI is a system designed for service providers who need to manage, analyze, and generate quotations efficiently.

The platform ingests unstructured documents (PDF, Word, Excel), extracts pricing data, learns from historical quotes, and uses AI to improve pricing accuracy and consistency.

Unlike simple document parsers, Quotation AI combines:

* File parsing
* Data normalization
* Historical learning
* AI-based interpretation and pricing calibration

---

## 🚀 Key Features

### 📄 Document Processing

* Upload PDF, DOCX, XLS/XLSX, CSV files
* Extract raw text using parsing libraries
* Support for messy, real-world contractor documents

### 🧩 Data Extraction

* Heuristic-based extraction of pricing lines
* AI-powered extraction using OpenAI
* Conversion of unstructured text into structured pricing items

### 📊 Pricing Intelligence

* Learn from historical quotations
* Build structured datasets from uploaded files
* Normalize item names and units across different formats

### 🤖 AI-Powered Pricing

* Use OpenAI models to:

  * Interpret unstructured pricing data
  * Extract relevant pricing lines
  * Calibrate and refine unit prices
* Improve accuracy beyond rule-based systems

### 🧾 Quote Generation

* Generate quotation estimates based on:

  * Historical data
  * Normalized items
  * Client requirements
* Output structured JSON for further processing

### 👥 Multi-Side System

* **Service Provider Portal**

  * Upload documents
  * Train system on past quotes
  * Manage pricing data

* **Client Interface**

  * Dynamic form generation
  * Submit quote requests
  * Receive structured estimates

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite

### Backend

* Node.js
* Express
* TypeScript

### AI & Processing

* OpenAI API (chat completions)
* pdf-parse (PDF parsing)
* mammoth (DOCX parsing)
* xlsx (Excel parsing)

### Infrastructure

* Firebase Authentication
* Firestore Database
* Firebase Admin SDK
* Multer (file uploads)
* dotenv / CORS

---

## ⚙️ System Flow

1. **Service Provider uploads quotation files**
2. Backend extracts raw text from documents
3. System attempts to extract pricing lines:

   * Heuristic extraction
   * AI-assisted extraction (OpenAI)
4. Data is normalized and stored
5. Historical pricing dataset is built
6. Client submits a request via dynamic form
7. System generates initial quote estimate
8. OpenAI refines/calibrates pricing based on context
9. Final structured quote is returned

---

## 🤖 AI Integration

Quotation AI uses the OpenAI API as a core component of the system.

AI is used to:

* Extract structured pricing data from unstructured text
* Understand context and relationships between items
* Normalize inconsistent quotation formats
* Refine and calibrate pricing suggestions

This allows the system to handle real-world data that is too inconsistent for traditional rule-based parsing alone.

---

## 📁 Project Structure

quotation-ai/
├── src/                     # React frontend
├── server/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # AI + parsing services
│   │   ├── controllers/     # Request handlers
│   │   └── models/          # Data models
│   └── config/              # Environment configuration

---

## 🚀 Getting Started

### 1. Clone the repository

git clone https://github.com/eli9400/quotation-ai.git
cd quotation-ai

---

### 2. Install dependencies

#### Frontend

npm install

#### Backend

cd server
npm install

---

### 3. Environment Variables

Create a `.env` file in the server directory:

OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1

---

### 4. Run the project

#### Start backend

npm run dev

#### Start frontend

npm run dev

---

## 💡 Highlights

* Full-stack system (React + Node.js + Firebase)
* AI-powered document understanding using OpenAI
* Handles messy, real-world contractor data
* Learns pricing patterns from historical data
* Combines heuristics + AI for better accuracy
* Real business use case (quotation analysis & generation)

---

## 📌 Future Improvements

* Advanced ML-based pricing models
* Better UI for comparing multiple quotations
* Analytics dashboard for pricing trends
* Improved prompt engineering and model tuning
* Support for additional industries

---

## 👤 Author

**Eli Blechman**
GitHub: https://github.com/eli9400
