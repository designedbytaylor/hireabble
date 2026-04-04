import { useState, useRef } from 'react';
import { BarChart3, AlertCircle, CheckCircle2, Upload, X, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const ACTION_VERBS = [
  'achieved','administered','analyzed','built','collaborated','coordinated','created','decreased',
  'delivered','designed','developed','directed','drove','eliminated','established','executed',
  'expanded','generated','grew','implemented','improved','increased','initiated','launched',
  'led','managed','mentored','negotiated','optimized','organized','oversaw','pioneered',
  'planned','produced','reduced','resolved','revamped','scaled','spearheaded','streamlined',
  'supervised','trained','transformed','unified',
];

const SECTION_KEYWORDS = ['experience', 'education', 'skills', 'summary', 'objective', 'contact', 'projects', 'certifications', 'awards'];

function analyze(text) {
  if (!text.trim()) return null;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = text.split('\n').filter(l => l.trim());
  const lower = text.toLowerCase();

  let lengthScore;
  if (words.length >= 400 && words.length <= 800) lengthScore = 15;
  else if (words.length >= 200 && words.length < 400) lengthScore = Math.round((words.length / 400) * 15);
  else if (words.length > 800 && words.length <= 1200) lengthScore = Math.round(15 - ((words.length - 800) / 400) * 5);
  else if (words.length < 200) lengthScore = Math.round((words.length / 400) * 15);
  else lengthScore = 5;

  const foundVerbs = new Set();
  ACTION_VERBS.forEach(v => { if (lower.includes(v)) foundVerbs.add(v); });
  const verbScore = Math.min(20, Math.round((foundVerbs.size / 8) * 20));

  const quantMatches = text.match(/\$[\d,.]+|\d+%|\d{2,}[\s,]*(users|customers|clients|projects|people|team|employees|members|revenue|sales|increase|decrease|reduction|improvement)/gi) || [];
  const numMatches = text.match(/\b\d+\b/g) || [];
  const quantCount = quantMatches.length + Math.floor(numMatches.length / 3);
  const achieveScore = Math.min(20, Math.round((quantCount / 5) * 20));

  const foundSections = SECTION_KEYWORDS.filter(s => lower.includes(s));
  const sectionScore = Math.min(15, Math.round((foundSections.length / 5) * 15));

  const buzzwords = ['team', 'leadership', 'communication', 'project', 'client', 'strategic', 'budget', 'stakeholder', 'deadline', 'cross-functional', 'agile', 'data-driven', 'results'];
  const foundBuzz = buzzwords.filter(b => lower.includes(b));
  const keywordScore = Math.min(15, Math.round((foundBuzz.length / 5) * 15));

  let formatScore = 0;
  const hasBullets = lines.some(l => /^[\s]*[-•*]/.test(l));
  if (hasBullets) formatScore += 5;
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(text);
  if (hasEmail) formatScore += 3;
  const hasPhone = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  if (hasPhone) formatScore += 3;
  const hasDatePattern = /\d{4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current)\b/i.test(text);
  if (hasDatePattern) formatScore += 4;
  formatScore = Math.min(15, formatScore);

  const total = lengthScore + verbScore + achieveScore + sectionScore + keywordScore + formatScore;

  return {
    total,
    categories: [
      { name: 'Length', score: lengthScore, max: 15, detail: `${words.length} words (ideal: 400-800)` },
      { name: 'Action Verbs', score: verbScore, max: 20, detail: `${foundVerbs.size} found: ${[...foundVerbs].slice(0, 5).join(', ')}${foundVerbs.size > 5 ? '...' : ''}` },
      { name: 'Quantified Achievements', score: achieveScore, max: 20, detail: `${quantCount} measurable results found` },
      { name: 'Section Headers', score: sectionScore, max: 15, detail: `Found: ${foundSections.join(', ') || 'none'}` },
      { name: 'Keywords', score: keywordScore, max: 15, detail: `${foundBuzz.length} industry keywords` },
      { name: 'Formatting', score: formatScore, max: 15, detail: `${[hasBullets && 'bullets', hasEmail && 'email', hasPhone && 'phone', hasDatePattern && 'dates'].filter(Boolean).join(', ') || 'needs improvement'}` },
    ],
    tips: generateTips({ lengthScore, verbScore, achieveScore, sectionScore, keywordScore, formatScore, words, foundVerbs, foundSections }),
  };
}

function generateTips({ lengthScore, verbScore, achieveScore, sectionScore, keywordScore, formatScore, words, foundVerbs, foundSections }) {
  const tips = [];
  if (lengthScore < 10) {
    if (words.length < 300) tips.push('Your resume is too short. Aim for 400-800 words with detailed accomplishments.');
    else tips.push('Your resume is too long. Trim to 1-2 pages focusing on the most relevant experience.');
  }
  if (verbScore < 12) tips.push(`Start bullet points with strong action verbs like "Led", "Developed", "Increased". You only used ${foundVerbs.size} — aim for 8+.`);
  if (achieveScore < 12) tips.push('Add measurable results: "Increased sales by 25%", "Managed a team of 12", "Reduced costs by $50K".');
  if (sectionScore < 10) {
    const missing = SECTION_KEYWORDS.filter(s => !foundSections.includes(s)).slice(0, 3);
    tips.push(`Add clear section headers. Consider adding: ${missing.join(', ')}.`);
  }
  if (keywordScore < 10) tips.push('Include more industry keywords relevant to your target role. Mirror language from job descriptions.');
  if (formatScore < 10) tips.push('Improve formatting: use bullet points for achievements, include contact info (email + phone), and add date ranges for each role.');
  if (tips.length === 0) tips.push('Your resume looks strong! Consider tailoring it for each specific job application.');
  return tips;
}

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  }

  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
}

export default function ResumeScore() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setResult(null);

    try {
      const extractedText = await extractTextFromFile(file);
      setText(extractedText);
      setFileName(file.name);
    } catch (err) {
      setUploadError(err.message || 'Failed to extract text from file.');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFileName('');
    setText('');
    setUploadError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = (e) => {
    e.preventDefault();
    setResult(analyze(text));
  };

  const scoreColor = (score, max) => {
    const pct = score / max;
    if (pct >= 0.7) return 'text-green-400';
    if (pct >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <ToolLayout title="Resume Score Checker" description="Upload your resume or paste the text to get an instant score with actionable tips to improve it.">
      <form onSubmit={handleAnalyze} className="glass-card rounded-2xl p-6 space-y-4">
        {/* File upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Upload Your Resume</label>
          {!fileName ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                {uploading ? 'Extracting text...' : 'Drop your resume here or click to upload'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">PDF, DOCX, or TXT</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-primary/5">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{fileName}</span>
              <button type="button" onClick={clearFile} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {uploadError && <p className="text-sm text-red-400 mt-1">{uploadError}</p>}
        </div>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <div className="flex-1 h-px bg-border" />
          <span>or paste your resume text</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Text paste */}
        <div>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
            placeholder="Paste the full text of your resume here..."
            value={text}
            onChange={e => { setText(e.target.value); setFileName(''); }}
          />
          <p className="text-xs text-muted-foreground mt-1">{text.split(/\s+/).filter(Boolean).length} words</p>
        </div>

        <Button type="submit" className="w-full" disabled={!text.trim() || uploading}>
          <BarChart3 className="w-4 h-4 mr-2" /> Analyze Resume
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className={`text-6xl font-bold font-['Outfit'] ${scoreColor(result.total, 100)}`}>{result.total}</p>
            <p className="text-muted-foreground mt-1">out of 100</p>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold font-['Outfit']">Score Breakdown</h3>
            {result.categories.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{cat.name}</span>
                  <span className={scoreColor(cat.score, cat.max)}>{cat.score}/{cat.max}</span>
                </div>
                <div className="w-full h-2 bg-border/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(cat.score / cat.max) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.detail}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3">Tips to Improve</h3>
            <div className="space-y-2">
              {result.tips.map((tip, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  {result.total >= 70 ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />}
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
