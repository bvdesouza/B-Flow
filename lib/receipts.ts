import { supabase } from './supabase';

export const RECEIPTS_BUCKET = 'receipts';
export const MAX_RECEIPT_SIZE_MB = 10;

export type Receipt = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  amount: number | null;
  payment_date: string; // YYYY-MM-DD
  description: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  created_at: string;
};

export type NewReceiptMeta = {
  studentId?: string | null;
  studentName?: string | null;
  amount?: number | null;
  paymentDate?: string; // YYYY-MM-DD
  description?: string | null;
};

export const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const isAcceptedReceiptFile = (file: File) =>
  file.type.startsWith('image/') || file.type === 'application/pdf';

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);

// Reduz fotos grandes (ex.: tiradas pelo celular) para economizar espaço. PDFs são enviados como estão.
const compressImage = (file: File): Promise<Blob> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      if (width <= MAX && height <= MAX && file.size < 1024 * 1024) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      const ratio = Math.min(MAX / width, MAX / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || file);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

export async function uploadReceipt(file: File, meta: NewReceiptMeta): Promise<Receipt> {
  if (!isAcceptedReceiptFile(file)) {
    throw new Error('Envie uma foto ou um arquivo PDF.');
  }
  if (file.size > MAX_RECEIPT_SIZE_MB * 1024 * 1024) {
    throw new Error('Arquivo muito grande. Máximo ' + MAX_RECEIPT_SIZE_MB + 'MB.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Faça login novamente para enviar comprovantes.');
  const userId = userData.user.id;

  const paymentDate = meta.paymentDate || todayISO();
  const isPdf = file.type === 'application/pdf';
  const body = await compressImage(file);
  const contentType = isPdf ? 'application/pdf' : (body.type || file.type || 'image/jpeg');

  let fileName = sanitizeFileName(file.name || (isPdf ? 'comprovante.pdf' : 'comprovante.jpg'));
  if (!isPdf && contentType === 'image/jpeg' && !/\.jpe?g$/i.test(fileName)) {
    fileName = fileName.replace(/\.[^.]+$/, '') + '.jpg';
  }

  const year = paymentDate.slice(0, 4);
  const path = userId + '/' + year + '/' + Date.now() + '-' + fileName;

  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (uploadError) throw new Error('Não foi possível enviar o arquivo: ' + uploadError.message);

  const { data, error } = await supabase
    .from('receipts')
    .insert([{
      student_id: meta.studentId || null,
      student_name: meta.studentName || null,
      amount: meta.amount ?? null,
      payment_date: paymentDate,
      description: meta.description || null,
      file_path: path,
      file_name: file.name || fileName,
      file_type: contentType,
    }])
    .select()
    .single();

  if (error) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
    throw new Error('Não foi possível salvar o comprovante: ' + error.message);
  }
  return data as Receipt;
}

export async function listReceipts(year?: number): Promise<Receipt[]> {
  let query = supabase.from('receipts').select('*');
  if (year) {
    query = query.gte('payment_date', year + '-01-01').lte('payment_date', year + '-12-31');
  }
  const { data, error } = await query
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Receipt[];
}

export async function listReceiptsForStudent(studentId: string | null, studentName: string | null, limit = 5): Promise<Receipt[]> {
  let query = supabase.from('receipts').select('*');
  if (studentId) query = query.eq('student_id', studentId);
  else if (studentName) query = query.eq('student_name', studentName);
  else return [];
  const { data, error } = await query
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Receipt[];
}

export async function getReceiptUrl(receipt: Receipt, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(receipt.file_path, 60 * 10, download ? { download: receipt.file_name } : undefined);
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir o comprovante.');
  return data.signedUrl;
}

export async function deleteReceipt(receipt: Receipt): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', receipt.id);
  if (error) throw error;
  await supabase.storage.from(RECEIPTS_BUCKET).remove([receipt.file_path]);
}
