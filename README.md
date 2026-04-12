# 🧠 Quotation AI

An AI-powered system for analyzing contractor quotations and extracting structured data from unstructured files such as PDFs, Word documents, and spreadsheets.

---

## 🎯 Overview

Quotation AI is designed to help users analyze and understand contractor quotes by converting messy, unstructured documents into structured, usable data.

The system processes uploaded files and extracts meaningful information such as items, quantities, and pricing, enabling better comparison and decision-making.

---

## 🧩 Key Features

* 📄 Upload and analyze PDF, Word, and Excel files
* 🔍 Extract structured data from unstructured quotations
* 📊 Normalize and organize items for comparison
* ⚡ Backend processing with file parsing and data extraction
* 🔗 Integration with Firebase for data storage

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

### Data Processing

* pdf-parse – PDF parsing
* mammoth – Word document parsing
* xlsx – Excel processing

### Infrastructure

* Firebase / Firebase Admin
* Multer (file uploads)
* CORS / dotenv

---

## ⚙️ How It Works

1. User uploads a quotation file (PDF, DOCX, Excel)
2. Backend processes the file using parsing libraries
3. Extracted data is structured into usable format
4. Data can be stored and analyzed for insights

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

### 3. Run the project

#### Start backend

npm run dev

#### Start frontend

npm run dev

---

## 📁 Project Structure

quotation-ai/
├── src/                # React frontend
├── server/
│   ├── src/            # Backend logic
│   ├── routes/         # API endpoints
│   └── services/       # File parsing & processing

---

## 💡 Highlights

* Real-world use case: analyzing contractor quotations
* Handles multiple file formats (PDF, DOCX, XLSX)
* Combines frontend UI with backend data processing
* Demonstrates full-stack architecture

---

## 📌 Future Improvements

* AI-based price recommendations
* Better UI for comparison between quotations
* Support for additional file formats
* Advanced analytics and insights

---

## 👤 Author

**Eli Blechman**
GitHub: https://github.com/eli9400
