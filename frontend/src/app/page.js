'use client';

import { useState, useRef } from 'react';

// --- SVG Icon Components for a professional look ---
const UploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
);

const Loader = () => (
    <div className="border-4 border-gray-200 border-t-blue-600 rounded-full w-12 h-12 animate-spin"></div>
);

// --- Main App Component ---
export default function InvoiceAnalyzerPage() {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [status, setStatus] = useState('idle'); // 'idle', 'processing', 'success', 'error'
    const [statusText, setStatusText] = useState('');
    const fileInputRef = useRef(null);

    const handleFileChange = (file) => {
        if (file && file.type === 'application/pdf') {
            setUploadedFile(file);
            setExtractedData(null); // Clear previous results when a new file is selected
            setStatus('idle');
        } else {
            setUploadedFile(null);
            if (file) { // Alert only if a file was selected but it wasn't a PDF
                alert('Please upload a valid PDF file.');
            }
        }
    };

    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const processFile = async () => {
        if (!uploadedFile) {
            alert("Please select a file first.");
            return;
        }

        setStatus('processing');
        setStatusText('Sending to server for analysis...');
        setExtractedData(null);

        const formData = new FormData();
        formData.append('file', uploadedFile);

        try {
            // This URL should point to your separate Python backend
            const response = await fetch('http://127.0.0.1:5000/api/extract', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An error occurred on the server.');
            }

            const data = await response.json();
            setExtractedData(data);
            setStatus('success');
        } catch (error) {
            console.error("Error processing file:", error);
            setStatus('error');
            setStatusText(error.message || 'An unknown error occurred.');
        }
    };
    
    const downloadCSV = () => {
        if (!extractedData) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = Object.keys(extractedData).filter(key => extractedData[key]);
        csvContent += headers.join(',') + '\n';
        
        const values = headers.map(header => {
            let value = extractedData[header] || '';
            // For CSV, replace newlines with a space to keep each record on one line.
            value = String(value).replace(/\n/g, ' ');
            return `"${value}"`;
        });
        csvContent += values.join(',') + '\n';

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "invoice_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reset = () => {
        setUploadedFile(null);
        setExtractedData(null);
        setStatus('idle');
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="bg-gray-100 text-gray-900 min-h-screen flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-600">Invoice Analyzer</h1>
                    <p className="mt-2 text-lg text-gray-700">Upload a PDF to extract key information.</p>
                </header>

                <main className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
                    {/* --- Uploader Section --- */}
                    <div
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-all mb-6"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                        />
                        <UploadIcon />
                        <p className="mt-4 text-gray-600">
                            {uploadedFile ? `Selected: ${uploadedFile.name}` : 'Drag & drop a file here or '}
                            {!uploadedFile && <span className="text-blue-600 font-semibold">browse</span>}
                        </p>
                    </div>
                    
                    {/* --- Extract Button --- */}
                    <div className="text-center">
                        <button
                            onClick={processFile}
                            disabled={!uploadedFile || status === 'processing'}
                            className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
                        >
                            {status === 'processing' ? 'Analyzing...' : 'Extract Data'}
                        </button>
                    </div>

                    {/* --- Results Section --- */}
                    {status === 'processing' && (
                        <div className="text-center mt-8">
                            <Loader />
                            <p className="mt-4 text-lg font-medium text-gray-700">{statusText}</p>
                        </div>
                    )}

                    {status === 'error' && (
                         <div className="text-center mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-lg font-medium text-red-600">{statusText}</p>
                             <button onClick={reset} className="mt-4 bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600">Try Again</button>
                        </div>
                    )}

                    {status === 'success' && extractedData && (
                        <div className="mt-8">
                            <h2 className="text-2xl font-bold mb-4 text-center">Extraction Results</h2>
                            <div className="bg-gray-50 p-4 rounded-lg border">
                                <table className="min-w-full">
                                    <tbody className="divide-y divide-gray-200">
                                        {Object.entries(extractedData).map(([key, value]) => value && (
                                            <tr key={key}>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800 align-top">{key}</td>
                                                <td className="px-4 py-3 whitespace-normal text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: key.includes('Address') && value ? String(value).replace(/\n/g, '<br>') : value }}></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-center space-x-4 mt-6">
                                <button onClick={downloadCSV} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">Download CSV</button>
                                <button onClick={reset} className="bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600">Analyze Another</button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}