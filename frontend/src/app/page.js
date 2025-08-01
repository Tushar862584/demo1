'use client';

import { useState, useRef, useEffect } from 'react';

// --- SVG Icon Components for a professional look ---
const UploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
);

const DocumentIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// --- A more engaging, "fancy" loader ---
const FancyLoader = ({ statusText }) => (
    <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-lg font-medium text-gray-700">{statusText}</p>
    </div>
);

// --- Component to display the results in a clean table ---
const ResultsTable = ({ data }) => {
    // Function to format keys from camelCase to Title Case
    const formatKey = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg border shadow-sm">
            <table className="min-w-full">
                <tbody className="divide-y divide-gray-200">
                    {Object.entries(data).map(([key, value]) => value && (
                        <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-800 align-top w-1/3">{formatKey(key)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: key.includes('Address') && value ? String(value).replace(/\n/g, '<br>') : value }}></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- Main App Component ---
export default function InvoiceAnalyzerPage() {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [status, setStatus] = useState('idle'); // 'idle', 'processing', 'success', 'error'
    const [statusText, setStatusText] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // Effect for dynamic status text during processing
    useEffect(() => {
        let intervalId;
        if (status === 'processing') {
            const messages = [
                'Uploading file securely...',
                'Preprocessing document...',
                'AI engine is analyzing layout...',
                'Extracting key-value pairs...',
                'Finalizing results...'
            ];
            let messageIndex = 0;
            setStatusText(messages[messageIndex]);
            intervalId = setInterval(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                setStatusText(messages[messageIndex]);
            }, 2500);
        }
        return () => clearInterval(intervalId);
    }, [status]);

    const handleFileChange = (file) => {
        if (file && file.type === 'application/pdf') {
            setUploadedFile(file);
            setExtractedData(null);
            setStatus('idle');
        } else {
            setUploadedFile(null);
            if (file) {
                alert('Please upload a valid PDF file.');
            }
        }
    };
    
    // --- Drag and Drop Handlers ---
    const handleDragEnter = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDragOver = (e) => e.preventDefault(); // Necessary to allow drop
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
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
        setExtractedData(null);

        try {
            const formData = new FormData();
            formData.append('file', uploadedFile);
            
            // API Endpoint from environment variables for best practice
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://appealing-strength-production.up.railway.app/api/extract';

            const response = await fetch(apiUrl, { method: 'POST', body: formData });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unexpected error occurred on the server.');
            }

            const data = await response.json();
            setExtractedData(data);
            setStatus('success');
        } catch (error) {
            console.error("Error processing file:", error);
            setStatus('error');
            setStatusText(error.message || 'Failed to connect to the server.');
        }
    };
    
    const downloadCSV = () => {
        if (!extractedData) return;
        const headers = Object.keys(extractedData).filter(key => extractedData[key]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n';
        
        const values = headers.map(header => {
            let value = String(extractedData[header] || '').replace(/"/g, '""').replace(/\n/g, ' ');
            return `"${value}"`;
        });
        csvContent += values.join(',') + '\n';

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${uploadedFile?.name.replace('.pdf', '') || 'invoice'}_data.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reset = () => {
        setUploadedFile(null);
        setExtractedData(null);
        setStatus('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="bg-gray-50 text-gray-900 min-h-screen font-sans" onDragEnter={handleDragEnter}>
            {/* Full page drag-and-drop overlay */}
            {isDragging && (
                <div 
                    className="fixed inset-0 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50"
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="text-center text-white font-bold text-2xl">
                        <UploadIcon />
                        Drop PDF anywhere to upload
                    </div>
                </div>
            )}
            
            <div className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen">
                <div className="w-full max-w-2xl lg:max-w-3xl">
                    <header className="text-center mb-8">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Invoice Analyzer AI</h1>
                        <p className="mt-2 text-md sm:text-lg text-gray-600">Instantly extract data from your PDF invoices with our powerful AI.</p>
                    </header>

                    <main className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 transition-all">
                        {/* Show results if successful */}
                        {status === 'success' && extractedData ? (
                            <div>
                                <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Extraction Results</h2>
                                <ResultsTable data={extractedData} />
                                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-6">
                                    <button onClick={downloadCSV} className="w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors">Download CSV</button>
                                    <button onClick={reset} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">Analyze Another</button>
                                </div>
                            </div>
                        ) : (
                            // Show uploader and status views otherwise
                            <div>
                                <div
                                    className={`group border-2 border-dashed ${status === 'processing' ? 'border-gray-300' : 'border-gray-300 hover:border-blue-500'} rounded-xl p-6 text-center cursor-pointer transition-all mb-6`}
                                    onClick={() => status !== 'processing' && fileInputRef.current?.click()}
                                >
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                                    <UploadIcon />
                                    {uploadedFile ? (
                                        <div className="mt-4 flex items-center justify-center text-gray-700">
                                            <DocumentIcon />
                                            <span className="ml-2 font-semibold">{uploadedFile.name}</span>
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-gray-600">Drag & drop a file here or <span className="text-blue-600 font-semibold">browse</span></p>
                                    )}
                                </div>
                                
                                {status === 'idle' && (
                                    <div className="text-center">
                                        <button onClick={processFile} disabled={!uploadedFile} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg">Extract Data</button>
                                    </div>
                                )}

                                {status === 'processing' && <FancyLoader statusText={statusText} />}
                                
                                {status === 'error' && (
                                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="font-medium text-red-600">{statusText}</p>
                                        <button onClick={reset} className="mt-4 bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600">Try Again</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
