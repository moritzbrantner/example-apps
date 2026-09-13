export type DocumentFamily = 'Council' | 'Encyclical';
export type DocumentFamilyFilter = 'All' | DocumentFamily;

export type ChurchDocument = {
  slug: string;
  title: string;
  subtitle: string;
  family: DocumentFamily;
  issuedBy: string;
  publishedOn: string;
  topics: readonly string[];
  summary: string;
  officialSourceUrl: string;
};

export const documentFamilyFilters: readonly DocumentFamilyFilter[] = [
  'All',
  'Council',
  'Encyclical',
];

export const churchDocuments: readonly ChurchDocument[] = [
  {
    slug: 'sacrosanctum-concilium',
    title: 'Sacrosanctum Concilium',
    subtitle: 'Constitution on the Sacred Liturgy',
    family: 'Council',
    issuedBy: 'Second Vatican Council',
    publishedOn: '1963-12-04',
    topics: ['Liturgy', 'Sacraments', 'Worship'],
    summary:
      'Sets out the Council’s principles for the Church’s liturgical life, participation in worship, and the reform and development of the sacred liturgy.',
    officialSourceUrl:
      'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html',
  },
  {
    slug: 'lumen-gentium',
    title: 'Lumen Gentium',
    subtitle: 'Dogmatic Constitution on the Church',
    family: 'Council',
    issuedBy: 'Second Vatican Council',
    publishedOn: '1964-11-21',
    topics: ['Church', 'Episcopacy', 'Laity', 'Holiness'],
    summary:
      'Presents the Council’s teaching on the mystery, structure, mission, and universal call to holiness of the Church.',
    officialSourceUrl:
      'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html',
  },
  {
    slug: 'dei-verbum',
    title: 'Dei Verbum',
    subtitle: 'Dogmatic Constitution on Divine Revelation',
    family: 'Council',
    issuedBy: 'Second Vatican Council',
    publishedOn: '1965-11-18',
    topics: ['Revelation', 'Scripture', 'Tradition'],
    summary:
      'Explains divine revelation, its transmission in Scripture and Tradition, and the place of Sacred Scripture in the life of the Church.',
    officialSourceUrl:
      'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html',
  },
  {
    slug: 'humanae-vitae',
    title: 'Humanae Vitae',
    subtitle: 'Encyclical on the Regulation of Birth',
    family: 'Encyclical',
    issuedBy: 'Pope Paul VI',
    publishedOn: '1968-07-25',
    topics: ['Marriage', 'Family', 'Human life'],
    summary:
      'Addresses responsible parenthood, married love, and moral questions concerning the transmission of human life.',
    officialSourceUrl:
      'https://www.vatican.va/content/paul-vi/en/encyclicals/documents/hf_p-vi_enc_25071968_humanae-vitae.html',
  },
  {
    slug: 'rerum-novarum',
    title: 'Rerum Novarum',
    subtitle: 'Encyclical on Capital and Labor',
    family: 'Encyclical',
    issuedBy: 'Pope Leo XIII',
    publishedOn: '1891-05-15',
    topics: ['Work', 'Justice', 'Property', 'Society'],
    summary:
      'Treats the dignity and duties of workers and employers, private property, social justice, and the responsibilities of public authority.',
    officialSourceUrl:
      'https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_15051891_rerum-novarum.html',
  },
];

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function findDocument(slug: string | undefined) {
  return churchDocuments.find((document) => document.slug === slug);
}

export function filterDocuments(
  query: string,
  family: DocumentFamilyFilter,
): readonly ChurchDocument[] {
  const needle = normalized(query);

  return churchDocuments.filter((document) => {
    if (family !== 'All' && document.family !== family) {
      return false;
    }

    if (!needle) {
      return true;
    }

    const searchable = [
      document.title,
      document.subtitle,
      document.issuedBy,
      document.summary,
      ...document.topics,
    ]
      .join(' ')
      .toLocaleLowerCase();

    return searchable.includes(needle);
  });
}
