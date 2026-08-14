import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsView from './Settings';

const styles = {
  card: {}, input: {}, label: {},
  btn: () => ({}),
};

describe('SettingsView - Esporta', () => {
  const config = { saldoStatoZero: 1000, dataStatoZero: '2026-01-01', coloreTema: '#4f46e5', percorsoSalvataggio: '/tmp', tags: [] };
  const spese = [{ id: '1', data: '2026-01-10', importo: 100, tags: [], nota: 'Test' }];

  let createObjectURLSpy;
  beforeEach(() => {
    // jsdom non implementa URL.createObjectURL: lo intercettiamo per catturare il Blob che il bottone genera
    createObjectURLSpy = vi.fn(() => 'blob:mock');
    URL.createObjectURL = createObjectURLSpy;
  });

  it('include sia config che spese nel file esportato, non solo la configurazione', async () => {
    render(
      <SettingsView
        config={config} spese={spese} setConfig={() => {}} user={{ username: 'admin' }}
        updateProfile={() => {}} importaJSON={() => {}} backupCartella={() => {}} styles={styles}
        newUsername="admin" setNewUsername={() => {}} newPassword="" setNewPassword={() => {}}
      />
    );

    await userEvent.click(screen.getByText('Esporta'));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0];
    const contenuto = JSON.parse(await blob.text());

    expect(contenuto.config).toEqual(config);
    expect(contenuto.spese).toEqual(spese);
  });
});
