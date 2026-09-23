export async function mockBackend(page, backend, intercept) {
  await page.route('https://script.google.com/**', async route => {
    const request = route.request();
    const { action, ...data } = request.method() === 'POST' ? request.postDataJSON() : Object.fromEntries(new URL(request.url()).searchParams);
    const result = intercept?.(action, data) || backend.request(action, data, request.method());
    await route.fulfill({ json: result });
  });
}
export async function addNode(page, type, title) {
  await page.getByRole('button', { name: `Añadir ${type}`, exact: true }).click();
  if (title) await page.getByLabel('Título del nodo', { exact: true }).fill(title);
}
export async function connect(page, source, target, sourcePort = 'Inferior', targetPort = 'Superior') {
  await page.getByRole('combobox', { name: 'Nodo de origen', exact: true }).selectOption({ label: source });
  await page.getByRole('combobox', { name: 'Puerto de salida', exact: true }).selectOption({ label: sourcePort });
  await page.getByRole('combobox', { name: 'Nodo de destino', exact: true }).selectOption({ label: target });
  await page.getByRole('combobox', { name: 'Puerto de entrada', exact: true }).selectOption({ label: targetPort });
  await page.getByRole('button', { name: 'Añadir conexión', exact: true }).click();
}
