import { useCallback, useState } from 'react';
import { Upload, FileText, RefreshCw } from 'lucide-react';
import { parseCSV } from '../utils/csvParser';

export default function CSVUploader({ onDataLoaded, lastUpload }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tickets = await parseCSV(file);
      onDataLoaded(tickets, file.name);
    } catch (e) {
      setError('Failed to parse CSV: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  };

  return (
    <div className="csv-uploader">
      <label
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input type="file" accept=".csv" onChange={onInputChange} style={{ display: 'none' }} />
        {loading ? (
          <RefreshCw size={32} className="spin" />
        ) : lastUpload ? (
          <>
            <FileText size={28} />
            <span className="upload-label">Re-upload CSV to refresh data</span>
            <span className="upload-meta">Last loaded: {lastUpload}</span>
          </>
        ) : (
          <>
            <Upload size={32} />
            <span className="upload-label">Drop CSV here or click to upload</span>
          </>
        )}
      </label>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}
