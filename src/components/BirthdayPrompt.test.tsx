import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BirthdayBanner, BirthdayPrompt } from './BirthdayPrompt';

describe('cumpleaños', () => {
  it('guarda la fecha una sola vez desde el aviso de acceso', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<BirthdayPrompt playerName="Adrián Vega" saving={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2008-08-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fecha' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('2008-08-20'));
    expect(screen.queryByText(/felicitarte|plantilla verá/i)).toBeNull();
  });

  it('muestra solo los nombres en la felicitación compartida', () => {
    render(<BirthdayBanner names={['Adrián Vega', 'Álvaro Torres']} onClose={() => undefined} />);
    expect(screen.getByText(/Es el cumpleaños de Adrián Vega y Álvaro Torres/)).toBeTruthy();
    expect(screen.queryByText(/2008/)).toBeNull();
  });
});
