import React, { useState, useRef } from 'react';
import { PRPReport } from './types';
import { improveSingleField, extractDataFromPSP } from './geminiService';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  RefreshCw,
  Wand2,
  Sparkles,
  Lock,
  FileSpreadsheet,
  Plus,
  Files,
  X,
  User,
  AlertCircle,
  Copy,
  Check,
  FileUp,
  AlertTriangle,
  ChevronDown,
  UserPlus,
  Trash2
} from 'lucide-react';

const createEmptyReport = (studentName = '', initialPSP = '', subject = ''): PRPReport & { id: string } => ({
  id: Math.random().toString(36).substr(2, 9),
  studentName: studentName,
  subject: subject,
  isTakingSubject: 'SÍ',
  responsibleTeacher: '',
  previousActions: '',
  difficultiesStrengths: '',
  unmetEvaluationCriteria: '',
  methodologicalProposal: '',
  detailedEvaluationPlan: '',
  rawPSP: initialPSP,
  status: 'idle'
});

const App: React.FC = () => {
  const [globalSubject, setGlobalSubject] = useState<string>('');
  const [reports, setReports] = useState<(PRPReport & { id: string })[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [copyMenu, setCopyMenu] = useState<{ fieldId: keyof PRPReport; reportId: string } | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeReport = reports.find(r => r.id === activeReportId) || null;
  const hasNotFoundReports = reports.some(r => r.status === 'notFound');

  const isReportComplete = (report: PRPReport) => {
    const requiredFields: (keyof PRPReport)[] = [
      'subject', 
      'isTakingSubject', 
      'responsibleTeacher', 
      'previousActions', 
      'difficultiesStrengths', 
      'unmetEvaluationCriteria', 
      'methodologicalProposal', 
      'detailedEvaluationPlan'
    ];
    return requiredFields.every(field => (report as any)[field]?.toString().trim().length > 0);
  };

  const allReportsComplete = reports.length > 0 && reports.every(isReportComplete);
  const activeComplete = activeReport ? isReportComplete(activeReport) : false;

  const handleInputChange = (field: keyof PRPReport, value: string) => {
    if (!activeReportId) return;
    setReports(prev => prev.map(r => r.id === activeReportId ? { ...r, [field]: value } : r));
  };

  const runExtraction = async (reportId: string, subject: string, rawText: string) => {
    if (!subject.trim() || !rawText.trim()) return;
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'extracting' } : r));
    try {
      const data = await extractDataFromPSP(subject, rawText);
      setReports(prev => prev.map(r => {
        if (r.id === reportId) {
          const hasFoundData = data && (data.previousActions?.trim().length > 0 || data.difficultiesStrengths?.trim().length > 0 || data.unmetEvaluationCriteria?.trim().length > 0);
          return {
            ...r,
            previousActions: data?.previousActions || '',
            difficultiesStrengths: data?.difficultiesStrengths || '',
            unmetEvaluationCriteria: data?.unmetEvaluationCriteria || '',
            status: hasFoundData ? 'completed' : 'notFound'
          };
        }
        return r;
      }));
    } catch (err) {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'notFound' } : r));
    }
  };

  const addNewReport = () => {
    const newReport = createEmptyReport('', '', globalSubject);
    setReports(prev => [...prev, newReport]);
    setActiveReportId(newReport.id);
    setIsListOpen(false);
  };

  const clearNotFoundReports = () => {
    setReports(prev => {
      const filtered = prev.filter(r => r.status !== 'notFound');
      if (activeReport && activeReport.status === 'notFound') {
        setActiveReportId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
    setIsListOpen(false);
  };

  const processFileContent = async (fileName: string, content: string) => {
    const cleanStudentName = fileName.replace(/\.[^/.]+$/, "").replace(/^.*[\\\/]/, "");
    const newReport = createEmptyReport(cleanStudentName, content, globalSubject);
    setReports(prev => [...prev, newReport]);
    if (!activeReportId) setActiveReportId(newReport.id);
    runExtraction(newReport.id, globalSubject, content);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let content = "";
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === "PSP");
        if (!sheetName) continue;
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        content = json.map(row => row.join(" ")).join("\n");
      } else {
        content = await file.text();
      }
      if (content) await processFileContent(file.name, content);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReports(prev => {
      const filtered = prev.filter(r => r.id !== id);
      if (activeReportId === id) setActiveReportId(filtered.length > 0 ? filtered[0].id : null);
      return filtered;
    });
  };

  const copyToOthers = (fieldId: keyof PRPReport, targetId: string | 'all') => {
    if (!activeReport) return;
    const valueToCopy = (activeReport as any)[fieldId];
    setReports(prev => prev.map(r => {
      if (targetId === 'all' && r.id !== activeReport.id) return { ...r, [fieldId]: valueToCopy };
      if (r.id === targetId) return { ...r, [fieldId]: valueToCopy };
      return r;
    }));
    setLastCopied(`${fieldId}-${Date.now()}`);
    setTimeout(() => setLastCopied(null), 2000);
  };

  const handleImproveField = async (field: keyof PRPReport, label: string) => {
    if (!activeReport) return;
    const content = (activeReport as any)[field];
    if (!content || content.toString().trim().length < 5) return;
    setLoadingField(field);
    try {
      const improvedText = await improveSingleField(label, content);
      handleInputChange(field, improvedText);
    } finally {
      setLoadingField(null);
    }
  };

  const generateExcelBlob = (reportData: PRPReport) => {
    const titles = ["MATERIA", "CURSA", "DOCENTE", "ACTUACIONES CURSO ANTERIOR", "DIFICULTADES / FORTALEZAS", "CRITERIOS NO SUPERADOS", "PROPUESTA METODOLÓGICA", "PLAN DE EVALUACIÓN DETALLADO"];
    const values = [
      reportData.subject, reportData.isTakingSubject, reportData.responsibleTeacher,
      reportData.previousActions, reportData.difficultiesStrengths, reportData.unmetEvaluationCriteria,
      reportData.methodologicalProposal, reportData.detailedEvaluationPlan
    ];
    
    // Usamos la API estándar de XLSX para máxima compatibilidad con Netlify
    const data = titles.map((title, i) => [title, values[i] || ""]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Configuración básica de columnas
    ws['!cols'] = [{ wch: 35 }, { wch: 80 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PRP");
    return wb;
  };

  const downloadAll = () => {
    reports.forEach(r => {
      const wb = generateExcelBlob(r);
      XLSX.writeFile(wb, `PRP_${r.studentName || 'Alumno'}.xlsx`);
    });
  };

  const PropagateButton = ({ fieldId }: { fieldId: keyof PRPReport }) => {
    if (reports.length <= 1 || !activeReport) return null;
    const isLast = lastCopied?.startsWith(fieldId);
    const isOpen = copyMenu?.fieldId === fieldId;
    const hasContent = (activeReport as any)[fieldId]?.toString().trim().length > 0;
    return (
      <div className="relative">
        <button onClick={() => setCopyMenu(isOpen ? null : { fieldId, reportId: activeReport.id })} disabled={!hasContent} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all ${!hasContent ? 'opacity-30 cursor-not-allowed' : isLast ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
          {isLast ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {isLast ? 'Copiado' : 'Propagar'}
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => { copyToOthers(fieldId, 'all'); setCopyMenu(null); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl flex items-center gap-2">
              <Files className="w-3.5 h-3.5" /> Todos
            </button>
            {reports.filter(r => r.id !== activeReport.id).map(r => (
              <button key={r.id} onClick={() => { copyToOthers(fieldId, r.id); setCopyMenu(null); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 rounded-xl truncate">
                {r.studentName || `Alumno ${reports.indexOf(r) + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col pb-44">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight hidden sm:block">PRP Express</h1>
          </div>

          <div className="flex items-center gap-2">
            {reports.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setIsListOpen(!isListOpen)}
                  className={`flex items-center gap-3 px-4 py-2.5 bg-white border-2 rounded-2xl shadow-sm transition-all text-[11px] font-black uppercase tracking-tight ${activeReport?.status === 'notFound' ? 'border-red-200 text-red-600 hover:border-red-400' : 'border-slate-100 text-slate-700 hover:border-indigo-200'}`}
                >
                  {activeReport?.status === 'notFound' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <User className="w-4 h-4 text-indigo-500" />}
                  <span className="max-w-[140px] truncate">{activeReport?.studentName || 'Seleccionar Alumno'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isListOpen ? 'rotate-180' : ''} ${activeReport?.status === 'notFound' ? 'text-red-400' : 'text-slate-400'}`} />
                </button>

                {isListOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-2 border-b border-slate-50 space-y-1">
                      <button 
                        onClick={addNewReport}
                        className="w-full flex items-center gap-2 px-3 py-3 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors uppercase tracking-widest"
                      >
                        <UserPlus className="w-4 h-4" /> Nuevo Informe
                      </button>
                      
                      {hasNotFoundReports && (
                        <button 
                          onClick={clearNotFoundReports}
                          className="w-full flex items-center gap-2 px-3 py-3 text-[10px] font-black text-red-600 hover:bg-red-50 rounded-2xl transition-colors uppercase tracking-widest border border-red-100"
                        >
                          <Trash2 className="w-4 h-4" /> Limpiar errores
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 no-scrollbar">
                      {reports.map((r) => (
                        <div key={r.id} className="flex items-center gap-1 group">
                          <button 
                            onClick={() => { setActiveReportId(r.id); setIsListOpen(false); }}
                            className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-2xl text-[10px] font-bold transition-all ${activeReportId === r.id ? (r.status === 'notFound' ? 'bg-red-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md') : (r.status === 'notFound' ? 'text-red-600 hover:bg-red-50 bg-red-50/30' : 'text-slate-600 hover:bg-slate-50')}`}
                          >
                            <span className="truncate flex items-center gap-2">
                              {r.status === 'notFound' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                              {r.studentName || 'Sin nombre'}
                            </span>
                            {r.status === 'extracting' && <RefreshCw className="w-3 h-3 animate-spin opacity-60" />}
                          </button>
                          <button 
                            onClick={(e) => removeReport(r.id, e)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-indigo-50 border border-indigo-100/50 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><FileText className="w-4 h-4" /> 1. Materia Principal</label>
            </div>
            <input 
              type="text" 
              value={globalSubject} 
              onChange={(e) => setGlobalSubject(e.target.value)} 
              disabled={reports.length > 0}
              placeholder="Ej: Matemáticas, Historia..." 
              className={`w-full px-6 py-4 text-lg rounded-2xl border-2 outline-none transition-all font-bold ${reports.length > 0 ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'border-indigo-100 bg-white focus:border-indigo-500 shadow-sm'}`} 
            />
          </div>
        </div>

        {!reports.length && (
          <div className={`glass-card rounded-[2rem] p-10 border-dashed border-2 transition-all ${globalSubject.trim() ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-200 opacity-50 grayscale'}`}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${globalSubject.trim() ? 'bg-indigo-600 text-white shadow-2xl rotate-3' : 'bg-slate-100 text-slate-400'}`}>
                <FileUp className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Carga masiva de PSPs</h2>
                <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">Sube uno o varios archivos Excel de alumnos. La IA detectará los apartados 4, 5 y 6 automáticamente.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={!globalSubject.trim()}
                  className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all ${globalSubject.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  Importar Excels (.xlsx)
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-xs uppercase font-black text-slate-300 tracking-[0.3em] bg-transparent px-2"><span className="bg-[#eff6ff] px-3">o bien</span></div>
                </div>
                <button 
                  onClick={addNewReport}
                  disabled={!globalSubject.trim()}
                  className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all border-2 ${globalSubject.trim() ? 'bg-white border-indigo-100 text-indigo-600 hover:border-indigo-400' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                >
                  Informe Manual
                </button>
              </div>
              <input type="file" multiple accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </div>
          </div>
        )}

        {activeReport && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {activeReport.status === 'notFound' && (
              <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[2rem] flex items-start gap-4">
                <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0"><AlertTriangle className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-black text-red-900 text-[10px] uppercase leading-none tracking-widest">Aviso de extracción</h3>
                  <p className="text-red-700 text-xs mt-2 font-semibold leading-relaxed">No se ha podido localizar información para la materia <strong>"{activeReport.subject}"</strong> en el texto del PSP.</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-indigo-50 border border-indigo-100/50">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4"><User className="w-4 h-4 text-indigo-400" /> Identificación del Alumno</label>
              <input type="text" value={activeReport.studentName} onChange={(e) => handleInputChange('studentName', e.target.value)} placeholder="Ej: Juan García Pérez..." className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-slate-50 bg-slate-50/50 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800" />
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl text-white space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                      <FileText className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Extracto PSP Vinculado</span>
                  </div>
                  {activeReport.status === 'extracting' && (
                    <span className="flex items-center gap-2 text-[10px] font-black text-amber-400 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin"/> IA Trabajando...</span>
                  )}
               </div>
               <textarea 
                 value={activeReport.rawPSP || ''} 
                 onChange={(e) => handleInputChange('rawPSP', e.target.value)} 
                 rows={4}
                 className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl p-5 text-[11px] font-medium text-slate-300 placeholder-slate-600 focus:border-indigo-500 outline-none resize-none"
                 placeholder="Copia aquí el PSP del alumno..."
               />
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. Cursa la materia</label>
                  <div className="flex gap-2">
                    {['SÍ', 'NO'].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => handleInputChange('isTakingSubject', opt)}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${activeReport.isTakingSubject === opt ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Docente</label>
                    <PropagateButton fieldId="responsibleTeacher" />
                  </div>
                  <input type="text" value={activeReport.responsibleTeacher} onChange={(e) => handleInputChange('responsibleTeacher', e.target.value)} placeholder="Nombre del docente..." className="w-full bg-slate-50 px-5 py-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
              </div>

              {[
                { id: 'previousActions', label: '4. Actuaciones Curso Anterior' },
                { id: 'difficultiesStrengths', label: '5. Dificultades / Fortalezas' },
                { id: 'unmetEvaluationCriteria', label: '6. Criterios No Superados' }
              ].map((field) => (
                <div key={field.id} className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none"><Lock className="w-3 h-3 text-slate-300" /> {field.label}</label>
                    <PropagateButton fieldId={field.id as keyof PRPReport} />
                  </div>
                  <div className={`p-7 rounded-[2.5rem] text-sm leading-relaxed min-h-[100px] border transition-all ${activeReport.status === 'notFound' ? 'bg-red-50/50 text-red-500 border-red-100' : (activeReport as any)[field.id] ? 'bg-slate-50 text-slate-600 border-slate-100' : 'bg-amber-50/30 text-amber-600 border-amber-100/50 italic'}`}>
                    {(activeReport as any)[field.id] || "Campo vacío."}
                  </div>
                </div>
              ))}

              {[
                { id: 'methodologicalProposal', label: '7. Propuesta Metodológica', placeholder: 'Estrategias...' },
                { id: 'detailedEvaluationPlan', label: '8. Plan de Evaluación Detallado', placeholder: 'Instrumentos...' }
              ].map((field) => (
                <div key={field.id} className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{field.label}</label>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleImproveField(field.id as keyof PRPReport, field.label)} 
                        disabled={loadingField === field.id || !(activeReport as any)[field.id]} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase border transition-all ${(activeReport as any)[field.id] ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:scale-105 active:scale-95' : 'opacity-20 cursor-not-allowed'}`}
                      >
                        <Wand2 className="w-3 h-3" /> {loadingField === field.id ? 'Puliedo...' : 'Pulir con IA'}
                      </button>
                      <PropagateButton fieldId={field.id as keyof PRPReport} />
                    </div>
                  </div>
                  <textarea rows={4} value={(activeReport as any)[field.id]} onChange={(e) => handleInputChange(field.id as keyof PRPReport, e.target.value)} placeholder={field.placeholder} className={`w-full px-7 py-6 rounded-[2.5rem] border-2 bg-white focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 shadow-sm leading-relaxed ${!(activeReport as any)[field.id] ? 'border-indigo-50/50 bg-indigo-50/5' : 'border-slate-50'}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {reports.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[60] flex flex-col gap-3">
            <div className="flex gap-4">
              <button 
                onClick={() => activeReport && XLSX.writeFile(generateExcelBlob(activeReport), `PRP_${activeReport.studentName || 'Alumno'}.xlsx`)} 
                disabled={!activeComplete} 
                className={`flex-1 flex items-center justify-center gap-4 px-8 py-6 rounded-[3rem] transition-all font-black shadow-2xl ${activeComplete ? 'bg-slate-900 text-white hover:bg-black hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                <div className="text-left leading-tight"><span className="block text-[9px] uppercase tracking-[0.2em] opacity-60">Descargar</span><span className="text-base">Excel Actual</span></div>
              </button>
              {reports.length > 1 && (
                <button 
                  onClick={downloadAll} 
                  disabled={!allReportsComplete} 
                  className={`flex items-center justify-center gap-4 px-8 py-6 rounded-[3rem] transition-all font-black shadow-2xl ${allReportsComplete ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1' : 'bg-slate-100 text-slate-300'}`}
                >
                  <Files className="w-6 h-6" />
                  <div className="text-left leading-tight"><span className="block text-[9px] uppercase tracking-[0.2em] opacity-60">Paquete</span><span className="text-base">Todos</span></div>
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      
      {(copyMenu || isListOpen) && <div className="fixed inset-0 z-40 bg-slate-900/5 backdrop-blur-[2px] transition-all" onClick={() => { setCopyMenu(null); setIsListOpen(false); }} />}
    </div>
  );
};

export default App;