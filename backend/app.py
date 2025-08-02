# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz  # PyMuPDF, for PDF processing
from PIL import Image # Pillow, for image handling
import pytesseract   # For OCR
import re            # For regular expressions
import io            # For handling in-memory file operations
import subprocess

# --- Initialize the Flask Application ---
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow your frontend to call this API.
CORS(app)

# --- The Intelligent Parsing Model (No spaCy) ---
# This function contains the advanced logic to extract data from the OCR text.
def intelligent_parse(text, paragraphs):
    # This is the final data structure we want to populate.
    data = {
        'Supplier Name': None,
        'Supplier Address': None,
        'Customer Name': None,
        'Customer Address': None,
        'Invoice ID': None,
        'Invoice Date': None,
        'Total Amount': None,
    }

    lines = text.split('\n')

    # Helper function to clean address blocks by removing irrelevant lines.
    def clean_address_block(paragraph):
        if not paragraph:
            return None
        lines = paragraph.split('\n')
        unwanted_keywords = ['phone', 'e-mail', 'gst', 'www', 'payment voucher', 'page']
        address_lines = [line for line in lines if line.strip() and not any(kw in line.lower() for kw in unwanted_keywords)]
        # Limit to a reasonable number of lines to keep it clean
        return '\n'.join(address_lines[:5])

    # --- Heuristic for Supplier and Customer Name & Address ---
    if paragraphs:
        data['Supplier Name'] = paragraphs[0].split('\n')[0].strip()
        data['Supplier Address'] = clean_address_block(paragraphs[0])

    if len(paragraphs) > 1:
        bill_to_regex = re.compile(r'(?:bill to|billed to|ship to|aarti drugs ltd)', re.IGNORECASE)
        customer_block = paragraphs[1] # Default to the second block
        for p in paragraphs:
            if bill_to_regex.search(p):
                customer_block = p
                break
        data['Customer Name'] = customer_block.split('\n')[0].strip()
        data['Customer Address'] = clean_address_block(customer_block)

    # --- Multi-layered extraction for mandatory fields ---
    # This uses a hierarchical approach: try the most specific pattern first, then fall back to more general ones.

    # 1. Invoice ID
    id_match = re.search(r'"Receipt No\.[\s\S]*?"\s*,\s*"([^"]+)"', text, re.IGNORECASE)
    if id_match:
        data['Invoice ID'] = id_match.group(1).replace('\n', ' ').strip()
    else:
        id_match = re.search(r'(?:invoice|receipt)\s?no[\s:.]*([a-z0-9\-\/]+)', text, re.IGNORECASE)
        if id_match:
            data['Invoice ID'] = id_match.group(1)

    # 2. Invoice Date
    date_match = re.search(r'"Document Date[\s\S]*?"\s*,\s*"([^"]+)"', text, re.IGNORECASE)
    if date_match:
        data['Invoice Date'] = date_match.group(1).replace('\n', ' ').strip()
    else:
        # Improved regex to handle more date formats like "29. November 2024"
        date_match = re.search(r'(\d{1,2}[-./\s]\s?\w+\s?[-./\s]\s?\d{4})', text, re.IGNORECASE)
        if date_match:
            data['Invoice Date'] = date_match.group(0)

    # 3. Total Amount (Smarter Contextual Search)
    amount_found = False
    for i, line in enumerate(lines):
        if 'payment amount' in line.lower():
            # Search the current line and the next few lines for the amount
            for subsequent_line in lines[i:i+4]:
                amount_match = re.search(r'([\d,]+\.\d{2})', subsequent_line)
                if amount_match:
                    data['Total Amount'] = amount_match.group(1)
                    amount_found = True
                    break
            if amount_found:
                break

    # Fallback if the contextual search fails
    if not amount_found:
        amounts = re.findall(r'(\d{1,3}(?:,?\d{3})*(?:\.\d{2}))', text)
        if amounts:
            numeric_amounts = [float(amount.replace(',', '')) for amount in amounts]
            data['Total Amount'] = f"{max(numeric_amounts):.2f}"

    return data

# --- The Main API Endpoint ---
@app.route('/api/extract', methods=['POST'])
def extract_invoice_data():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:

        print("Tesseract PATH:", subprocess.getoutput("nix-store --query $(which tesseract)"))
        print("Tesseract VERSION:\n", subprocess.getoutput("tesseract --version"))

        file_buffer = file.read()

        # Step 1: Use PyMuPDF to open the PDF from the buffer and render it as an image (CV Stage)
        pdf_document = fitz.open(stream=file_buffer, filetype="pdf")
        page = pdf_document.load_page(0)
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Step 2: Perform OCR on the image using pytesseract
        full_text = pytesseract.image_to_string(img)

        # Create a simplified list of paragraphs for the parser
        paragraphs = full_text.split('\n\n')

        # Step 3: Parse the OCR data with the intelligent model
        extracted_data = intelligent_parse(full_text, paragraphs)

        # Step 4: Return the clean, structured data to the frontend
        return jsonify(extracted_data), 200

    except Exception as e:
        print(f"API Error: {e}")
        return jsonify({'error': 'Failed to process the invoice on the server.'}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)

