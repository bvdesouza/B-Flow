import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Excluir minha conta | B-Flow',
  description: 'Como solicitar a exclusão da sua conta e dos seus dados no B-Flow.',
};

const CONTACT_EMAIL = 'gerenciamento.bflow@gmail.com';

export default function DeleteAccount() {
  const subject = encodeURIComponent('Excluir minha conta no B-Flow');
  return (
    <main className="w-full max-w-3xl mx-auto px-5 py-10 text-on-surface leading-relaxed">
      <h1 className="text-3xl font-bold mb-6">Excluir minha conta no B-Flow</h1>

      <section className="space-y-3 mb-8">
        <p>Para excluir sua conta do B-Flow e todos os dados ligados a ela:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            Envie um e-mail para{' '}
            <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>{CONTACT_EMAIL}</a>{' '}
            com o assunto <strong>“Excluir minha conta no B-Flow”</strong>.
          </li>
          <li>Envie a mensagem a partir do mesmo e-mail usado para entrar no app, para confirmarmos que a conta é sua.</li>
          <li>A exclusão é concluída em até 7 dias, e você recebe uma confirmação por e-mail.</li>
        </ol>
      </section>

      <h2 className="text-xl font-bold mb-3">O que é apagado</h2>
      <section className="space-y-3 mb-8">
        <p>Seus dados de cadastro (nome, e-mail, telefone e foto), além de todos os alunos, turmas, planos, aulas,
          registros de presença, valores e comprovantes cadastrados na sua conta. Nada fica guardado depois da exclusão.</p>
        <p>Se quiser apagar apenas alguns dados sem excluir a conta, você pode remover alunos, turmas e registros
          diretamente no app, ou pedir pelo mesmo e-mail.</p>
      </section>

      <p className="text-sm text-on-surface-variant">
        Veja também a <Link className="text-primary underline" href="/privacidade">Política de Privacidade</Link>.
      </p>
    </main>
  );
}
