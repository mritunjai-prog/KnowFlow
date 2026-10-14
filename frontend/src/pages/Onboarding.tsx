import { Link } from 'react-router-dom';
import { useAction } from '../api/hooks';
import { request, json } from '../api/client';
import type { Session } from '../api/types';
import { useAuth } from '../auth/context';
import { Page, Panel, ErrorNotice } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
export function Onboarding() {
  const auth = useAuth();
  const action = useAction();
  return (
    <Page
      title="Start your knowledge library"
      description="Three steps to your first source-backed answer."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Capture a note',
            text: 'Upload a supported document or photograph a clear, well-lit page. Review progress and any processing errors.',
            to: '/capture',
            label: 'Open capture',
          },
          {
            title: 'Review the result',
            text: 'Open your document to compare its source and extracted text. Correct its title, type or topics.',
            to: '/library',
            label: 'Open library',
          },
          {
            title: 'Ask your first question',
            text: 'Ask about a processed document. Follow the answer’s source links and check the evidence.',
            to: '/assistant',
            label: 'Open assistant',
          },
        ].map((step, i) => (
          <li key={step.to}>
            <Panel>
              <span className="font-mono text-secondary">0{i + 1}</span>
              <h2 className="my-3 text-xl font-bold">{step.title}</h2>
              <p className="mb-6">{step.text}</p>
              <Link className="font-semibold underline" to={step.to}>
                {step.label}
              </Link>
            </Panel>
          </li>
        ))}
      </ol>
      <ErrorNotice error={action.error} />
      <Button
        disabled={action.pending}
        onClick={() =>
          void action.run(
            (signal) =>
              request<Session>('/onboarding', { ...json('PATCH', { complete: true }), signal }),
            auth.accept,
            'Your introduction is marked complete.',
          )
        }
      >
        Mark introduction complete
      </Button>
      <p role="status">{action.message}</p>
    </Page>
  );
}
