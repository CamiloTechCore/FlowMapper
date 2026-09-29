export function normalizeTeamTag(value) {
  const tag = String(value || '').trim().replace(/^#\{(.*)\}$/, '$1').replace(/^#+/, '');
  if (tag && !/^[\p{L}\p{N}_-]{1,48}$/u.test(tag)) throw new Error('La etiqueta admite hasta 48 letras, números, guiones o guiones bajos, sin espacios.');
  return tag ? '#' + tag : '';
}
export function matchesFlowSearch(flow, team, process, query) {
  const text = [flow.nombre, flow.descripcion, team?.nombre, process?.nombre, team?.etiqueta].join(' ').toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(term => {
    if (!term.startsWith('#')) return text.includes(term);
    try { return normalizeTeamTag(term).toLocaleLowerCase() === String(team?.etiqueta || '').toLocaleLowerCase(); }
    catch { return false; }
  });
}
