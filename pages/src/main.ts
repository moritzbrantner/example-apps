import { apps, type AppCategory, type ExampleApp } from './catalog';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error('Missing required element: ' + selector);
  return element;
}

const appList = requiredElement<HTMLDivElement>('#app-list');
const searchInput = requiredElement<HTMLInputElement>('#search');
const categorySelect = requiredElement<HTMLSelectElement>('#category');
const resultStatus = requiredElement<HTMLParagraphElement>('#result-status');

const initialParams = new URLSearchParams(window.location.search);
searchInput.value = initialParams.get('q') ?? '';
const requestedCategory = initialParams.get('category');
if (requestedCategory === 'everyday' || requestedCategory === 'fine-arts') {
  categorySelect.value = requestedCategory;
}

function categoryLabel(category: AppCategory): string {
  return category === 'fine-arts' ? 'Fine arts' : 'Everyday';
}

function createLink(label: string, href: string, className?: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.textContent = label;
  link.href = href;
  if (className) link.className = className;
  return link;
}

function createCard(app: ExampleApp): HTMLElement {
  const article = document.createElement('article');
  article.className = 'app-card';

  const meta = document.createElement('div');
  meta.className = 'app-meta';
  const category = document.createElement('span');
  category.className = 'app-category';
  category.textContent = categoryLabel(app.category);
  meta.append(category);

  const heading = document.createElement('h3');
  heading.textContent = app.name;

  const description = document.createElement('p');
  description.textContent = app.description;

  const actions = document.createElement('div');
  actions.className = 'app-actions';
  actions.append(
    createLink('Open app', './apps/' + app.slug + '/'),
    createLink('Source', 'https://github.com/moritzbrantner/example-apps/tree/main/expo/' + app.slug, 'source-link'),
  );

  article.append(meta, heading, description, actions);
  return article;
}

function matches(app: ExampleApp, query: string, category: string): boolean {
  const categoryMatches = category === 'all' || app.category === category;
  const textMatches = !query || (app.name + ' ' + app.description).toLowerCase().includes(query);
  return categoryMatches && textMatches;
}

function syncUrl(query: string, category: string): void {
  const params = new URLSearchParams();
  if (query) params.set('q', searchInput.value.trim());
  if (category !== 'all') params.set('category', category);
  const suffix = params.size > 0 ? '?' + params.toString() : window.location.pathname;
  window.history.replaceState(null, '', suffix);
}

function render(): void {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const visibleApps = apps.filter((app) => matches(app, query, category));

  appList.replaceChildren(...visibleApps.map(createCard));
  if (visibleApps.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No applications match these filters.';
    appList.append(empty);
  }

  resultStatus.textContent = visibleApps.length + ' of ' + apps.length + ' apps';
  syncUrl(query, category);
}

searchInput.addEventListener('input', render);
categorySelect.addEventListener('change', render);
render();
