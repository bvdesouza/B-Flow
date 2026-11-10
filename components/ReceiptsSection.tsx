'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useFinance } from './FinanceContext';
import {
  FileText, Image as ImageIcon, Upload, Download, Eye, Trash2, Loader2,
  ChevronLeft, ChevronRight, X, FolderOpen, FileSpreadsheet, Plus
} from 'lucide-react';
import {
  Receipt, listReceipts, uploadReceipt, getReceiptUrl, deleteReceipt,
  todayISO, isAcceptedReceiptFile, MAX_RECEIPT_SIZE_MB
} from '@/lib/receipts';

type StudentOption = { id: string; name: string };

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatDateBR = (iso: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-');
  return d && m && y ? d + '/' + m + '/' + y : iso;
};

const parseMoney = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

export function ReceiptsSection({ initialStudentId = '' }: { initialStudentId?: string }) {
  const { formatCurrency } = useFinance();
  const [year, setYear] = useState(new Date().getFullYear());
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentFilter, setStudentFilter] = useState(initialStudentId);

  useEffect(() => {
    setStudentFilter(initialStudentId);
  }, [initialStudentId]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formStudentId, setFormStudentId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formDescription, setFormDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await listReceipts(year);
      setReceipts(data);
    } catch (err: any) {
      console.error('Error loading receipts:', err);
      const msg = String(err?.message || '');
      if (msg.includes('receipts') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
        setLoadError('A área de comprovantes ainda não foi ativada no banco de dados.');
      } else {
        setLoadError('Não foi possível carregar os comprovantes.');
      }
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    const loadStudents = async () => {
      const { data } = await supabase.from('students').select('id, name').order('name');
      if (data) setStudents(data as StudentOption[]);
    };
    loadStudents();
  }, []);

  const filtered = useMemo(() => {
    if (!studentFilter) return receipts;
    if (studentFilter === '__none__') return receipts.filter(r => !r.student_id && !r.student_name);
    return receipts.filter(r => r.student_id === studentFilter);
  }, [receipts, studentFilter]);

  const totalAmount = useMemo(() => filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [filtered]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<number, Receipt[]>();
    filtered.forEach(r => {
      const month = parseInt((r.payment_date || '').slice(5, 7), 10) - 1;
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(r);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const openUpload = () => {
    setFile(null);
    setFormStudentId(studentFilter && studentFilter !== '__none__' ? studentFilter : '');
    setFormAmount('');
    setFormDate(todayISO());
    setFormDescription('');
    setUploadError('');
    setIsUploadOpen(true);
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    if (!isAcceptedReceiptFile(chosen)) {
      setUploadError('Envie uma foto ou um arquivo PDF.');
      return;
    }
    if (chosen.size > MAX_RECEIPT_SIZE_MB * 1024 * 1024) {
      setUploadError('Arquivo muito grande. Máximo ' + MAX_RECEIPT_SIZE_MB + 'MB.');
      return;
    }
    setUploadError('');
    setFile(chosen);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Selecione a foto ou o PDF do comprovante.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    try {
      const student = students.find(s => s.id === formStudentId);
      await uploadReceipt(file, {
        studentId: student ? student.id : null,
        studentName: student ? student.name : null,
        amount: parseMoney(formAmount),
        paymentDate: formDate || todayISO(),
        description: formDescription.trim() || null,
      });
      setIsUploadOpen(false);
      const uploadedYear = parseInt((formDate || todayISO()).slice(0, 4), 10);
      if (uploadedYear !== year) setYear(uploadedYear);
      else await loadReceipts();
    } catch (err: any) {
      console.error('Error uploading receipt:', err);
      setUploadError(err?.message || 'Erro ao enviar comprovante.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpen = async (receipt: Receipt, download: boolean) => {
    setBusyId(receipt.id);
    const win = download ? null : window.open('', '_blank');
    try {
      const url = await getReceiptUrl(receipt, download);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = receipt.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (win) {
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      if (win) win.close();
      alert(err?.message || 'Não foi possível abrir o comprovante.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (receipt: Receipt) => {
    if (!confirm('Excluir este comprovante? Essa ação não pode ser desfeita.')) return;
    setBusyId(receipt.id);
    try {
      await deleteReceipt(receipt);
      setReceipts(prev => prev.filter(r => r.id !== receipt.id));
    } catch (err) {
      console.error('Error deleting receipt:', err);
      alert('Não foi possível excluir o comprovante.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = () => {
    const header = ['Data do pagamento', 'Aluno', 'Valor (R$)', 'Descrição', 'Arquivo'];
    const rows = [...filtered]
      .sort((a, b) => a.payment_date.localeCompare(b.payment_date))
      .map(r => [
        formatDateBR(r.payment_date),
        r.student_name || '',
        r.amount != null ? Number(r.amount).toFixed(2).replace('.', ',') : '',
        r.description || '',
        r.file_name,
      ]);
    const csv = [header, ...rows]
      .map(cols => cols.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comprovantes-' + year + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const currentYear = new Date().getFullYear();
  const inputClass = 'w-full bg-surface border border-outline-variant rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface';
  const labelClass = 'font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider';

  return (
    <section className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Comprovantes de pagamento</h3>
          <p className="text-sm text-on-surface-variant">Guarde fotos e PDFs dos pagamentos. Tudo organizado por ano para o IR.</p>
        </div>
        <button
          type="button"
          onClick={openUpload}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-sm hover:shadow-md transition-all shrink-0"
        >
          <Upload className="w-4 h-4" /> Enviar comprovante
        </button>
      </div>

      {/* Resumo do ano */}
      <div className="rounded-2xl p-5 text-white shadow-md bg-gradient-to-br from-[#0f766e] via-[#047857] to-[#065f46]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setYear(y => y - 1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-lg tracking-wide">{year}</span>
          <button
            type="button"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="Próximo ano"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70 font-bold">Total comprovado</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/70 font-bold">Comprovantes</p>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
          className={inputClass + ' sm:flex-1'}
        >
          <option value="">Todos os alunos</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="__none__">Sem aluno vinculado</option>
        </select>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-40"
        >
          <FileSpreadsheet className="w-4 h-4 text-primary" /> Exportar planilha {year}
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : loadError ? (
        <div className="p-5 rounded-2xl bg-error-container text-on-error-container text-sm font-bold text-center">
          {loadError}
        </div>
      ) : groupedByMonth.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 py-12 px-6 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest">
          <FolderOpen className="w-10 h-10 text-on-surface-variant opacity-50" />
          <p className="text-on-surface-variant">Nenhum comprovante em {year}.</p>
          <button
            type="button"
            onClick={openUpload}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Enviar o primeiro
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedByMonth.map(([month, items]) => {
            const monthTotal = items.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
            return (
              <div key={month} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <h4 className="font-bold text-on-surface">{MONTHS[month] || 'Sem data'}</h4>
                  <span className="text-xs font-bold text-on-surface-variant">
                    {items.length} {items.length === 1 ? 'comprovante' : 'comprovantes'} • {formatCurrency(monthTotal)}
                  </span>
                </div>
                <div className="flex flex-col rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden divide-y divide-outline-variant/50">
                  {items.map(r => {
                    const isPdf = r.file_type === 'application/pdf';
                    const isBusy = busyId === r.id;
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 sm:p-4">
                        <div className={'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ' + (isPdf ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dbeafe] text-[#1d4ed8]')}>
                          {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-on-surface truncate">{r.student_name || 'Sem aluno vinculado'}</p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {formatDateBR(r.payment_date)}{r.description ? ' • ' + r.description : ''}
                          </p>
                        </div>
                        {r.amount != null && (
                          <span className="font-bold text-on-surface text-sm shrink-0 hidden sm:block">{formatCurrency(Number(r.amount))}</span>
                        )}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isBusy ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary m-2" />
                          ) : (
                            <>
                              <button type="button" onClick={() => handleOpen(r, false)} className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" aria-label="Ver comprovante">
                                <Eye className="w-5 h-5" />
                              </button>
                              <button type="button" onClick={() => handleOpen(r, true)} className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" aria-label="Baixar comprovante">
                                <Download className="w-5 h-5" />
                              </button>
                              <button type="button" onClick={() => handleDelete(r)} className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors" aria-label="Excluir comprovante">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de envio */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={handleUpload}
            className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/40">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Enviar comprovante
              </h3>
              <button type="button" onClick={() => setIsUploadOpen(false)} className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChosen}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed transition-colors ' + (file ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-surface-container')}
              >
                {file ? (
                  <>
                    {file.type === 'application/pdf' ? <FileText className="w-8 h-8 text-primary" /> : <ImageIcon className="w-8 h-8 text-primary" />}
                    <span className="font-bold text-on-surface text-sm break-all text-center">{file.name}</span>
                    <span className="text-xs text-primary font-bold">Toque para trocar o arquivo</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-on-surface-variant" />
                    <span className="font-bold text-on-surface text-sm">Escolher foto ou PDF</span>
                    <span className="text-xs text-on-surface-variant">Até {MAX_RECEIPT_SIZE_MB}MB</span>
                  </>
                )}
              </button>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Aluno</label>
                <select value={formStudentId} onChange={(e) => setFormStudentId(e.target.value)} className={inputClass}>
                  <option value="">Sem aluno vinculado</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Valor (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className={inputClass}
                    placeholder="Ex: 150,00"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Data</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Observação</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Mensalidade de novembro (Pix)"
                />
              </div>

              {uploadError && (
                <p className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold">{uploadError}</p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-outline-variant/40">
              <button type="button" onClick={() => setIsUploadOpen(false)} className="flex-1 py-3 rounded-full font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isUploading} className="flex-1 py-3 rounded-full font-bold bg-primary text-on-primary flex items-center justify-center gap-2 disabled:opacity-60">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
