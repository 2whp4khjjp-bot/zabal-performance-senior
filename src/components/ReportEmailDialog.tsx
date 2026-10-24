import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { jsPDF } from 'jspdf';
import { ReportEmailPanel } from './ReportEmailPanel';

type Props = {
  label: string;
  createPdf: () => Promise<jsPDF>;
  canSchedule: boolean;
  onClose: () => void;
};

export function ReportEmailDialog({ label, createPdf, canSchedule, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div className="report-email-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="report-email-dialog" role="dialog" aria-modal="true" aria-label={`Enviar ${label} por correo`} tabIndex={-1} ref={dialogRef}>
        <ReportEmailPanel label={label} createPdf={createPdf} canSchedule={canSchedule} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
