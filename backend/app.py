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
    import re

    data = {
        'Supplier Name': None,
        'Supplier Address': None,
        'Customer Name': None,
        'Customer Address': None,
        'Invoice ID': None,
        'Invoice Date': None,
        'Total Amount': None,
    }

    lines = text.splitlines()
    lower_lines = [line.lower() for line in lines]

    # --- Supplier Name & Address ---
    if paragraphs:
        supplier_block = paragraphs[0].strip()
        supplier_lines = supplier_block.split('\n')
        data['Supplier Name'] = supplier_lines[0].strip()
        data['Supplier Address'] = '\n'.join([
            line.strip() for line in supplier_lines[1:]
            if line.strip() and not any(x in line.lower() for x in ['gstin', 'pan', 'email', 'phone', 'contact'])
        ][:5])

    # --- Customer Name & Address ---
    bill_to_keywords = ['bill to', 'billed to', 'ship to', 'deliver to', 'customer', 'sold to']
    customer_block = None

    for para in paragraphs[1:]:
        if any(keyword in para.lower() for keyword in bill_to_keywords):
            customer_block = para.strip()
            break

    if customer_block:
        cust_lines = customer_block.split('\n')
        data['Customer Name'] = cust_lines[0].strip()
        data['Customer Address'] = '\n'.join([
            line.strip() for line in cust_lines[1:]
            if line.strip() and not any(x in line.lower() for x in ['gstin', 'pan', 'email', 'phone', 'contact'])
        ][:5])

    # --- Invoice ID Extraction ---
    invoice_id = None
    id_patterns = [
        r'(?:invoice|receipt)\s*(?:no|number)[\s:.-]*([a-zA-Z0-9\-\/]+)',
        r'Invoice[\s\S]{0,15}?[:\-]?\s*([A-Z0-9\-\/]{4,})',
        r'"Receipt No\.[\s\S]*?"\s*,\s*"([^"]+)"'
    ]
    for pattern in id_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice_id = match.group(1).strip()
            break
    data['Invoice ID'] = invoice_id

    # --- Invoice Date Extraction ---
    invoice_date = None
    date_patterns = [
        r'\b(?:invoice|date|document date)[\s:]*([\d]{1,2}[\/\-.][\d]{1,2}[\/\-.][\d]{2,4})',
        r'\b(\d{1,2}[-/\s]\w+[-/\s]\d{2,4})',
        r'\b(\w+\s+\d{1,2},\s+\d{4})'
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice_date = match.group(1).strip()
            break
    data['Invoice Date'] = invoice_date

    # --- Total Amount Extraction ---
    total_keywords = ['grand total', 'total amount', 'amount due', 'amount payable', 'total', 'net amount']
    total_amount = None
    for i, line in enumerate(lower_lines):
        if any(k in line for k in total_keywords):
            for offset in range(0, 3):
                if i + offset < len(lines):
                    amt_match = re.search(r'₹?\s?([\d,]+\.\d{2})', lines[i + offset])
                    if amt_match:
                        total_amount = amt_match.group(1).strip()
                        break
            if total_amount:
                break

    # Fallback: Pick highest numeric value
    if not total_amount:
        all_amounts = re.findall(r'₹?\s?([\d]{1,3}(?:,?\d{3})*(?:\.\d{2}))', text)
        if all_amounts:
            numeric_vals = [float(a.replace(',', '')) for a in all_amounts]
            total_amount = f"{max(numeric_vals):.2f}"

    data['Total Amount'] = total_amount

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

