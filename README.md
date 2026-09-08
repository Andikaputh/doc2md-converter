# MarkItDown Web Converter

A clean, full-stack web application that converts various document formats such as **PDF, DOCX, PPTX, XLSX**, and more into clean, structured **Markdown**.

Built specifically to prepare documents for **LLM (Large Language Model) ingestion**, making it easier to extract, clean, and reuse document content in AI-powered workflows.

Powered by **Microsoft MarkItDown**, **FastAPI**, and **React + Vite**.

Created by [@Andikaputh](https://github.com/Andikaputh).

---

## 🌐 Live Demo

The application has been deployed and is publicly accessible.

**Try it here:**

👉 **https://doc2md-nu.vercel.app/**

> No local installation is required to try the deployed version. Simply open the link, upload a supported document, and convert it into Markdown.

---

## ✨ Features

* Convert various document formats into Markdown
* Support for PDF, DOCX, PPTX, XLSX, and other formats supported by MarkItDown
* Clean and structured Markdown output
* Fast asynchronous file processing
* Copy converted Markdown directly to clipboard
* Temporary file management on the backend
* RESTful API built with FastAPI
* Modern frontend built with React and Vite
* Simple and clean user interface
* Publicly accessible web application

---

## 🏗️ Architecture

The application consists of two main components:

### Backend

Built with:

* **Python**
* **FastAPI**
* **Microsoft MarkItDown**
* **Uvicorn**

The backend is responsible for:

* Receiving uploaded documents
* Processing files using MarkItDown
* Converting documents into Markdown
* Managing temporary files
* Providing the conversion API

### Frontend

Built with:

* **React**
* **Vite**
* **JavaScript**
* **CSS**

The frontend is responsible for:

* File uploading
* Communicating with the backend API
* Displaying converted Markdown
* Managing application state
* Copying Markdown output to the clipboard

### Project Structure

```text
MarkItDown-Web-Converter/
├── backend/
│   └── main.py
│
├── frontend-react/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🚀 Getting Started

Follow the steps below to run the project locally.

### Prerequisites

Make sure the following are installed on your machine:

* Python 3.10+
* Node.js 18+
* npm
* Git

---

## 1. Start the Backend

Open a terminal and navigate to the backend directory:

```bash
cd backend
```

Install the required Python packages:

```bash
pip install fastapi uvicorn markitdown[all] python-multipart
```

Start the FastAPI development server:

```bash
python -m uvicorn main:app --reload
```

The backend API will be available at:

```text
http://localhost:8000
```

You can also access the FastAPI interactive API documentation at:

```text
http://localhost:8000/docs
```

---

## 2. Start the Frontend

Open a **new terminal** and navigate to the React frontend directory:

```bash
cd frontend-react
```

Install the required dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The web application will be available at:

```text
http://localhost:5173
```

---

## 🔗 API Reference

### `POST /api/convert`

Converts an uploaded document into a Markdown string.

#### Request

The endpoint expects a `multipart/form-data` request containing a file field.

**Field:**

```text
file
```

#### Example Response

```json
{
  "success": true,
  "filename": "document.pdf",
  "markdown_content": "# Parsed Text..."
}
```

### Response Fields

| Field              | Type      | Description                                     |
| ------------------ | --------- | ----------------------------------------------- |
| `success`          | `boolean` | Indicates whether the conversion was successful |
| `filename`         | `string`  | Original uploaded filename                      |
| `markdown_content` | `string`  | Converted Markdown content                      |

---

## 🔄 How It Works

The conversion process follows this flow:

```text
User uploads document
        ↓
React Frontend
        ↓
POST /api/convert
        ↓
FastAPI Backend
        ↓
Microsoft MarkItDown
        ↓
Markdown Conversion
        ↓
JSON Response
        ↓
React Frontend
        ↓
Display Markdown Output
```

---

## 📄 Supported Documents

The application supports document formats handled by Microsoft MarkItDown.

Common examples include:

* PDF
* Microsoft Word (`.docx`)
* Microsoft PowerPoint (`.pptx`)
* Microsoft Excel (`.xlsx`)
* CSV
* HTML
* XML
* Text files
* Other formats supported by MarkItDown

> Supported formats may depend on the installed MarkItDown dependencies and version.

---

## 🛠️ Technologies

| Layer                | Technology           |
| -------------------- | -------------------- |
| Frontend             | React                |
| Build Tool           | Vite                 |
| Backend              | FastAPI              |
| Programming Language | Python               |
| Document Conversion  | Microsoft MarkItDown |
| API Server           | Uvicorn              |
| Package Manager      | npm / pip            |

---

## 📌 Use Cases

This project is particularly useful for preparing documents for AI and LLM workflows.

Examples include:

* Converting research papers into Markdown
* Preparing documents for LLM ingestion
* Extracting structured content from office documents
* Creating Markdown datasets
* Preparing documents for Retrieval-Augmented Generation (RAG)
* Cleaning document content before AI processing
* Converting business documents into machine-readable text

---

## 🌍 Deployment

The application has been deployed as a publicly accessible web application.

### Frontend

The frontend is hosted and available at:

**https://doc2md-nu.vercel.app/**

Users can access the application directly from a web browser without installing the project locally.

### Local Development

For development purposes, the frontend and backend can still be run locally using the instructions provided in the [Getting Started](#-getting-started) section.

---

## 📤 Upload to GitHub

If you have already created an empty GitHub repository named:

```text
MarkItDown-Web-Converter
```

Navigate to the project root directory:

```bash
cd MarkItDown-Web-Converter
```

Then run the following commands.

### 1. Add all project files

```bash
git add .
```

### 2. Create a commit

```bash
git commit -m "feat: complete project migration to FastAPI and React/Vite"
```

### 3. Connect the GitHub repository

If the repository has not been connected previously:

```bash
git remote add origin https://github.com/Andikaputh/MarkItDown-Web-Converter.git
```

### 4. Push the project

```bash
git push -u origin main
```

After the push is completed, the project will be available on GitHub.

---

## 🔒 Security Notes

This project processes uploaded files temporarily on the backend.

For production deployment, consider implementing:

* File size limits
* File type validation
* Upload rate limiting
* Temporary file cleanup
* Authentication and authorization
* Input validation
* Secure file handling
* HTTPS
* Production-grade CORS configuration

---

## 📝 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

Created by **Andikaputh**

GitHub: [@Andikaputh](https://github.com/Andikaputh)
