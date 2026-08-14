import { useMemo } from 'react';

export function useFinance(spese, config, activeTab, searchTerm) {
  const listaAnni = useMemo(() => {
    const anniDaiDati = Array.isArray(spese) ? spese.map(s => s?.data?.substring(0, 4)).filter(Boolean) : [];
    const anniConfig = Array.isArray(config?.anniAttivi) ? config.anniAttivi : [];
    return Array.from(new Set([...anniConfig, ...anniDaiDati])).sort((a, b) => b - a);
  }, [spese, config]);

  const movimentiAnno = useMemo(() => (spese || []).filter(m => m?.data?.startsWith(activeTab)), [spese, activeTab]);

  const saldoAttuale = useMemo(() => {
    let base = Number(config?.saldoStatoZero || 0);
    (spese || []).forEach(m => {
      // Una sottovoce (collegata a una voce madre tramite contenitoreId) non tocca mai il saldo da sola:
      // l'importo è già contato una volta sulla voce madre (es. il prelievo). Le sottovoci servono solo
      // a categorizzare per tag dove sono finiti quei soldi.
      if (m?.contenitoreId) return;
      if (m?.data >= config?.dataStatoZero) {
        const tagInfos = (m.tags || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
        if (tagInfos.some(t => t.tipo === 'entrata')) base += Number(m.importo);
        else if (tagInfos.some(t => t.tipo === 'uscita')) base -= Number(m.importo);
      }
    });
    return base;
  }, [spese, config]);

  const speseFiltrateRicerca = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return (spese || []).filter(mov => {
      return !s || (mov.nota || '').toLowerCase().includes(s) || (mov.tags || []).some(t => t.toLowerCase().includes(s)) || (mov.data || '').includes(s);
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [spese, searchTerm]);

  const datiPatrimonioMese = useMemo(() => {
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    let tot = Number(config?.saldoStatoZero || 0);
    (spese || []).filter(m => !m?.contenitoreId && m?.data < `${activeTab}-01-01` && m?.data >= config?.dataStatoZero).forEach(m => {
      const tagInfos = (m.tags || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
      if (tagInfos.some(t => t.tipo === 'entrata')) tot += Number(m.importo);
      else if (tagInfos.some(t => t.tipo === 'uscita')) tot -= Number(m.importo);
    });

    return mesi.map((m, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      movimentiAnno.filter(mov => !mov?.contenitoreId && mov?.data?.substring(5, 7) === mStr).forEach(mov => {
        const tagInfos = (mov.tags || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
        if (tagInfos.some(t => t.tipo === 'entrata')) tot += Number(mov.importo);
        else if (tagInfos.some(t => t.tipo === 'uscita')) tot -= Number(mov.importo);
      });
      return { name: m, Valore: tot };
    });
  }, [movimentiAnno, config, activeTab, spese]);

  const datiTorta = useMemo(() => {
    // Una voce con sottovoci collegate non contribuisce più con il proprio tag: sono le sottovoci
    // a rappresentare, categoria per categoria, dove è finito quell'importo (già contato una volta sulla madre).
    const idConSottovoci = new Set(movimentiAnno.filter(m => m.contenitoreId).map(m => m.contenitoreId));

    const uscite = {};
    movimentiAnno.filter(m => !idConSottovoci.has(m.id)).forEach(m => {
      const tagUscita = (m.tags || []).filter(tagName => config.tags?.find(t => t.nome === tagName)?.tipo === 'uscita');
      if (tagUscita.length === 0) return;
      // Ripartisce l'importo in parti uguali tra i tag uscita del movimento, per non contare due volte la stessa spesa multi-tag
      const quota = Number(m.importo) / tagUscita.length;
      tagUscita.forEach(tagName => {
        uscite[tagName] = (uscite[tagName] || 0) + quota;
      });
    });
    return { uscite: Object.entries(uscite).map(([k, v]) => ({ name: k.toUpperCase(), value: v })) };
  }, [movimentiAnno, config.tags]);

  const topTags = useMemo(() => {
    const counts = {};
    const validTags = new Set(config.tags?.map(t => t.nome) || []);
    (spese || []).forEach(s => {
      (s.tags || []).forEach(t => {
        if (validTags.has(t)) counts[t] = (counts[t] || 0) + 1;
      });
    });
    
    const sortedUsed = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const defaults = ["condominio", "bollette", "stipendio"];
    return Array.from(new Set([...defaults, ...sortedUsed]))
      .filter(t => validTags.has(t))
      .slice(0, 10);
  }, [spese, config.tags]);

  return {
    listaAnni, movimentiAnno, saldoAttuale, speseFiltrateRicerca,
    datiPatrimonioMese, datiTorta, topTags
  };
}